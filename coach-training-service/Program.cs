using CoachTrainingService.Data;
using CoachTrainingService.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Steeltoe.Discovery.Client;
using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

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

// ── 3. Sécurité Keycloak / JWT Bearer (Atelier 9) ──────────────────────────────
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        // Docker : Security__KeycloakAuthority=http://keycloak:8080/realms/sportbook (jetons émis via localhost:8180)
        var authority = builder.Configuration["Security:KeycloakAuthority"] ?? "http://localhost:8180/realms/sportbook";
        var issuer = builder.Configuration["Security:KeycloakIssuer"] ?? "http://localhost:8180/realms/sportbook";
        options.Authority = authority;
        options.RequireHttpsMetadata = false; // Développement local
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateAudience = false, // Keycloak utilise des audiences spécifiques
            ValidateIssuer = true,
            ValidIssuer = issuer
        };
    });
builder.Services.AddAuthorization();

// ── 4. Enregistrement sur Eureka (Steeltoe) ──────────────────────────────────
builder.Services.AddDiscoveryClient(builder.Configuration);

// ── 5. Contrôleurs ───────────────────────────────────────────────────────────
builder.Services.AddControllers()
    // Le frontend Angular envoie les heures au format "HH:mm" (input type=time)
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new FlexibleTimeSpanConverter()));

// Keycloak : désactivé par défaut dans le projet intégré (le frontend s'authentifie
// via identity-user-service et n'envoie pas de jeton JWT). Mettre "Security:KeycloakEnabled"
// à true pour réactiver les [Authorize] (Atelier 9).
var keycloakEnabled = builder.Configuration.GetValue<bool>("Security:KeycloakEnabled", false);

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

var controllers = app.MapControllers();
if (!keycloakEnabled) controllers.AllowAnonymous();

app.Run();


/// <summary>Accepte "HH:mm", "HH:mm:ss" (et le format .NET standard) pour les TimeSpan.</summary>
public class FlexibleTimeSpanConverter : JsonConverter<TimeSpan>
{
    public override TimeSpan Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var s = reader.GetString();
        if (s != null && TimeSpan.TryParse(s, CultureInfo.InvariantCulture, out var ts)) return ts;
        throw new JsonException($"Heure invalide : '{s}' (format attendu HH:mm ou HH:mm:ss).");
    }

    public override void Write(Utf8JsonWriter writer, TimeSpan value, JsonSerializerOptions options)
        => writer.WriteStringValue(value.ToString(@"hh\:mm\:ss", CultureInfo.InvariantCulture));
}
