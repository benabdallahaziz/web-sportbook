using CoachTrainingService.Dtos;
using CoachTrainingService.Services;
using Microsoft.AspNetCore.Mvc;

namespace CoachTrainingService.Controllers;

[ApiController]
[Route("api/sessions")]
public class SessionsController : ControllerBase
{
    private readonly SessionService _service;

    public SessionsController(SessionService service)
    {
        _service = service;
    }

    /// <summary>Obtenir le détail d'une séance.</summary>
    [HttpGet("{id:long}")]
    public async Task<IActionResult> GetById(long id)
    {
        var session = await _service.GetByIdAsync(id);
        return session == null ? NotFound($"Séance {id} introuvable.") : Ok(session);
    }

    /// <summary>Planning des séances pour un programme donné.</summary>
    [HttpGet("program/{programId:long}")]
    public async Task<IActionResult> GetByProgram(long programId)
    {
        return Ok(await _service.GetByProgramAsync(programId));
    }

    /// <summary>Séances d'un sportif (par son userId venant du service Identity).</summary>
    [HttpGet("user/{userId:long}")]
    public async Task<IActionResult> GetByUser(long userId)
    {
        return Ok(await _service.GetByUserAsync(userId));
    }

    /// <summary>Planifier une nouvelle séance de coaching.</summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateSessionDto dto)
    {
        var created = await _service.CreateAsync(dto);
        return created == null
            ? NotFound($"Programme {dto.ProgramId} introuvable.")
            : CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    /// <summary>Inscrire un sportif (userId) à une séance (valide le sportif sur Identity Service).</summary>
    [HttpPost("{id:long}/register")]
    public async Task<IActionResult> Register(long id, [FromBody] RegisterSessionDto dto)
    {
        try
        {
            var updated = await _service.RegisterUserAsync(id, dto.UserId);
            return updated == null ? NotFound(new { message = $"Séance {id} introuvable." }) : Ok(updated);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Erreur interne", details = ex.Message });
        }
    }

    /// <summary>Mettre à jour le statut d'une séance (SCHEDULED, COMPLETED, CANCELLED).</summary>
    [HttpPatch("{id:long}/status")]
    public async Task<IActionResult> UpdateStatus(long id, [FromBody] UpdateSessionStatusDto dto)
    {
        try
        {
            var updated = await _service.UpdateStatusAsync(id, dto.Status);
            return updated == null ? NotFound($"Séance {id} introuvable.") : Ok(updated);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    /// <summary>Supprimer une séance.</summary>
    [HttpDelete("{id:long}")]
    public async Task<IActionResult> Delete(long id)
    {
        var deleted = await _service.DeleteAsync(id);
        return deleted ? NoContent() : NotFound($"Séance {id} introuvable.");
    }
}

