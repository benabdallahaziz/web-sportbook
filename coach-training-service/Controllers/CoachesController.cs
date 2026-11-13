using CoachTrainingService.Dtos;
using CoachTrainingService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CoachTrainingService.Controllers;

[ApiController]
[Route("api/coaches")]
public class CoachesController : ControllerBase
{
    private readonly CoachService _service;

    public CoachesController(CoachService service)
    {
        _service = service;
    }

    /// <summary>Lister tous les coachs (filtrage optionnel par spécialité).</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? speciality)
    {
        var coaches = await _service.GetAllAsync(speciality);
        return Ok(coaches);
    }

    /// <summary>Obtenir le détail d'un coach avec ses disponibilités et certifications.</summary>
    [HttpGet("{id:long}")]
    public async Task<IActionResult> GetById(long id)
    {
        var coach = await _service.GetByIdAsync(id);
        return coach == null ? NotFound($"Coach {id} introuvable.") : Ok(coach);
    }

    /// <summary>Créer un nouveau profil de coach (Requiert Token JWT Keycloak).</summary>
    [HttpPost]
    [Authorize]
    public async Task<IActionResult> Create([FromBody] CreateCoachDto dto)
    {
        try
        {
            var created = await _service.CreateAsync(dto);
            return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>Modifier les informations d'un coach.</summary>
    [HttpPut("{id:long}")]
    public async Task<IActionResult> Update(long id, [FromBody] UpdateCoachDto dto)
    {
        var updated = await _service.UpdateAsync(id, dto);
        return updated == null ? NotFound($"Coach {id} introuvable.") : Ok(updated);
    }

    /// <summary>Mettre à jour la note d'un coach (0 à 5).</summary>
    [HttpPatch("{id:long}/rating")]
    public async Task<IActionResult> UpdateRating(long id, [FromBody] UpdateRatingDto dto)
    {
        try
        {
            var updated = await _service.UpdateRatingAsync(id, dto);
            return updated == null ? NotFound($"Coach {id} introuvable.") : Ok(updated);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    /// <summary>Supprimer un coach (Requiert Token JWT Keycloak).</summary>
    [HttpDelete("{id:long}")]
    [Authorize]
    public async Task<IActionResult> Delete(long id)
    {
        var deleted = await _service.DeleteAsync(id);
        return deleted ? NoContent() : NotFound($"Coach {id} introuvable.");
    }

    /// <summary>Ajouter un créneau de disponibilité à un coach.</summary>
    [HttpPost("{id:long}/availabilities")]
    public async Task<IActionResult> AddAvailability(long id, [FromBody] CoachAvailabilityDto dto)
    {
        var result = await _service.AddAvailabilityAsync(id, dto);
        return result == null ? NotFound($"Coach {id} introuvable.") : Ok(result);
    }

    /// <summary>Ajouter une certification à un coach.</summary>
    [HttpPost("{id:long}/certifications")]
    public async Task<IActionResult> AddCertification(long id, [FromBody] CreateCertificationDto dto)
    {
        var result = await _service.AddCertificationAsync(id, dto);
        return result == null ? NotFound($"Coach {id} introuvable.") : Ok(result);
    }
}

