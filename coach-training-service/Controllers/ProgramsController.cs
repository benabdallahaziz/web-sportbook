using CoachTrainingService.Dtos;
using CoachTrainingService.Services;
using Microsoft.AspNetCore.Mvc;

namespace CoachTrainingService.Controllers;

[ApiController]
[Route("api/programs")]
public class ProgramsController : ControllerBase
{
    private readonly ProgramService _service;

    public ProgramsController(ProgramService service)
    {
        _service = service;
    }

    /// <summary>Lister tous les programmes d'entraînement.</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        return Ok(await _service.GetAllAsync());
    }

    /// <summary>Obtenir le détail d'un programme.</summary>
    [HttpGet("{id:long}")]
    public async Task<IActionResult> GetById(long id)
    {
        var prog = await _service.GetByIdAsync(id);
        return prog == null ? NotFound($"Programme {id} introuvable.") : Ok(prog);
    }

    /// <summary>Lister tous les programmes d'un coach donné.</summary>
    [HttpGet("coach/{coachId:long}")]
    public async Task<IActionResult> GetByCoach(long coachId)
    {
        return Ok(await _service.GetByCoachAsync(coachId));
    }

    /// <summary>Créer un nouveau programme d'entraînement.</summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateProgramDto dto)
    {
        var created = await _service.CreateAsync(dto);
        return created == null
            ? NotFound($"Coach {dto.CoachId} introuvable.")
            : CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    /// <summary>Modifier un programme existant.</summary>
    [HttpPut("{id:long}")]
    public async Task<IActionResult> Update(long id, [FromBody] UpdateProgramDto dto)
    {
        var updated = await _service.UpdateAsync(id, dto);
        return updated == null ? NotFound($"Programme {id} introuvable.") : Ok(updated);
    }

    /// <summary>Supprimer un programme (et toutes ses séances associées).</summary>
    [HttpDelete("{id:long}")]
    public async Task<IActionResult> Delete(long id)
    {
        var deleted = await _service.DeleteAsync(id);
        return deleted ? NoContent() : NotFound($"Programme {id} introuvable.");
    }
}

