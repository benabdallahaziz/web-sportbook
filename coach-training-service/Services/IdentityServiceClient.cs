using System.Net;
using System.Text.Json;
using CoachTrainingService.Dtos;

namespace CoachTrainingService.Services;

/// <summary>
/// Client HTTP synchrone pour consommer le microservice Identity & User.
/// Respecte le contrat REST de l'Atelier 4.
/// </summary>
public class IdentityServiceClient
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<IdentityServiceClient> _logger;

    public IdentityServiceClient(HttpClient httpClient, ILogger<IdentityServiceClient> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    /// <summary>
    /// Récupère les détails d'un utilisateur par son ID depuis identity-user-service.
    /// Retourne null si l'utilisateur n'existe pas (404).
    /// </summary>
    public async Task<UserResponseDto?> GetUserByIdAsync(long userId)
    {
        try
        {
            var response = await _httpClient.GetAsync($"/api/users/{userId}");

            if (response.StatusCode == HttpStatusCode.NotFound)
            {
                _logger.LogWarning("Utilisateur {UserId} introuvable sur Identity Service.", userId);
                return null;
            }

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Identity Service a renvoyé le statut HTTP {StatusCode} pour userId {UserId}.", response.StatusCode, userId);
                return null;
            }

            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            return await JsonSerializer.DeserializeAsync<UserResponseDto>(
                await response.Content.ReadAsStreamAsync(), options);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erreur lors de la communication synchrone avec Identity Service ({BaseAddress}) pour userId {UserId}.", _httpClient.BaseAddress, userId);
            throw new InvalidOperationException($"Le microservice Identity ({_httpClient.BaseAddress}) est injoignable ou a rencontré une erreur : {ex.Message}", ex);
        }
    }
}

