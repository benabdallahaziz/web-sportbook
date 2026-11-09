using CoachTrainingService.Data;
using CoachTrainingService.Dtos;
using CoachTrainingService.Models;
using Microsoft.EntityFrameworkCore;

namespace CoachTrainingService.Services;

public class ProgramService
{
    private readonly CoachDbContext _db;

    public ProgramService(CoachDbContext db)
    {
        _db = db;
    }

    // ── Lister tous les programmes ──────────────────────────────────────────
    public async Task<IEnumerable<ProgramResponseDto>> GetAllAsync()
    {
        return await _db.TrainingPrograms
            .Include(p => p.Coach)
            .Select(p => ToDto(p))
            .ToListAsync();
    }

    // ── Programmes d'un coach donné ─────────────────────────────────────────
    public async Task<IEnumerable<ProgramResponseDto>> GetByCoachAsync(long coachId)
    {
        return await _db.TrainingPrograms
            .Where(p => p.CoachId == coachId)
            .Include(p => p.Coach)
            .Select(p => ToDto(p))
            .ToListAsync();
    }

    // ── Obtenir un programme par ID ─────────────────────────────────────────
    public async Task<ProgramResponseDto?> GetByIdAsync(long id)
    {
        var prog = await _db.TrainingPrograms
            .Include(p => p.Coach)
            .FirstOrDefaultAsync(p => p.Id == id);

        return prog == null ? null : ToDto(prog);
    }

    // ── Créer un programme ──────────────────────────────────────────────────
    public async Task<ProgramResponseDto?> CreateAsync(CreateProgramDto dto)
    {
        if (!await _db.Coaches.AnyAsync(c => c.Id == dto.CoachId)) return null;

        var prog = new TrainingProgram
        {
            Name = dto.Name,
            Description = dto.Description,
            Duration = dto.DurationWeeks,
            CoachId = dto.CoachId
        };
        _db.TrainingPrograms.Add(prog);
        await _db.SaveChangesAsync();

        prog.Coach = await _db.Coaches.FindAsync(prog.CoachId);
        return ToDto(prog);
    }

    // ── Modifier un programme ───────────────────────────────────────────────
    public async Task<ProgramResponseDto?> UpdateAsync(long id, UpdateProgramDto dto)
    {
        var prog = await _db.TrainingPrograms.Include(p => p.Coach).FirstOrDefaultAsync(p => p.Id == id);
        if (prog == null) return null;

        if (dto.Name != null) prog.Name = dto.Name;
        if (dto.Description != null) prog.Description = dto.Description;
        if (dto.DurationWeeks.HasValue) prog.Duration = dto.DurationWeeks.Value;

        await _db.SaveChangesAsync();
        return ToDto(prog);
    }

    // ── Supprimer un programme ──────────────────────────────────────────────
    public async Task<bool> DeleteAsync(long id)
    {
        var prog = await _db.TrainingPrograms.FindAsync(id);
        if (prog == null) return false;
        _db.TrainingPrograms.Remove(prog);
        await _db.SaveChangesAsync();
        return true;
    }

    private static ProgramResponseDto ToDto(TrainingProgram p) => new(
        p.Id, p.Name, p.Description, p.Duration, p.CoachId, p.Coach?.Name
    );
}

