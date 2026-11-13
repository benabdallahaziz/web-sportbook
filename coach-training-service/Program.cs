using System.Security.Claims;
using CoachTrainingService.Data;
using CoachTrainingService.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Steeltoe.Discovery.Client;

var builder = WebApplication.CreateBuilder(args);

// ── 1. Base de données MySQL ─────────────────────────────────────────────────
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<CoachDbContext>(options =>
    options.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString)));

// ── 2. Services métier, Client HTTP (Atelier 4) & RabbitMQ (Atelier 6) ────────
builder.Services.AddHttpClient<IdentityServiceClient>((sp, client) =>
{
    var config = sp.GetRequiredService<IConfiguration>();
    var url = config["Services:IdentityServiceUrl"] ?? "http://localhost:8081";
    client.BaseAddress = new Uri(url);
    client.Timeout = TimeSpan.FromSeconds(5);
});
builder.Services.AddSingleton<RabbitMQProducer>();
builder.Services.AddHostedService<NotificationConsumerService>();

builder.Services.AddScoped<CoachService>();
builder.Services.AddScoped<ProgramService>();
builder.Services.AddScoped<SessionService>();

// ── 3. Sécurité Keycloak / JWT Bearer avec RBAC (Rôles ADMIN, COACH, SPORTIF) ─
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = "http://localhost:8180/realms/sportbook";
        options.RequireHttpsMetadata = false; // Développement local
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateAudience = false, // Keycloak gère les audiences par client
            ValidateIssuer = true,
            ValidIssuer = "http://localhost:8180/realms/sportbook"
        };

        // Mappage automatique des rôles Keycloak (realm_access.roles) vers ASP.NET Core Roles
        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = context =>
            {
                if (context.Principal?.Identity is ClaimsIdentity identity)
                {
                    var realmAccess = identity.FindFirst("realm_access")?.Value;
                    if (!string.IsNullOrEmpty(realmAccess))
                    {
                        using var doc = System.Text.Json.JsonDocument.Parse(realmAccess);
                        if (doc.RootElement.TryGetProperty("roles", out var roles))
                        {
                            foreach (var role in roles.EnumerateArray())
                            {
                                var r = role.GetString();
                                if (!string.IsNullOrEmpty(r))
                                    identity.AddClaim(new Claim(ClaimTypes.Role, r));
                            }
                        }
                    }
                }
                return Task.CompletedTask;
            }
        };
    });
builder.Services.AddAuthorization();

// ── 4. Enregistrement sur Eureka (Steeltoe) ──────────────────────────────────
builder.Services.AddDiscoveryClient(builder.Configuration);

// ── 5. Contrôleurs ───────────────────────────────────────────────────────────
builder.Services.AddControllers();

// ── 6. Swagger avec support JWT Bearer ─────────────────────────────────────────
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new()
    {
        Title = "SportBook – Coach & Training Service",
        Version = "v1",
        Description = "API REST du microservice Coach & Training sécurisée par Keycloak (JWT). Port 8087."
    });

    // Bouton vert "Authorize" dans Swagger pour coller le Token JWT
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "Entrez votre token JWT Keycloak. Exemple : Bearer {votre_token}",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.Http,
        Scheme = "Bearer",
        BearerFormat = "JWT"
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

// ── 7. CORS (pour le front-end web / mobile) ─────────────────────────────────
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());
});

var app = builder.Build();

app.UseDeveloperExceptionPage();

// ── Swagger UI ───────────────────────────────────────────────────────────────
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "Coach & Training Service v1");
    c.RoutePrefix = "swagger";
});

app.UseCors();

// ── Authentification & Autorisation (Ordre crucial !) ─────────────────────────
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

