using CoachTrainingService.Data;
using CoachTrainingService.Dtos;
using CoachTrainingService.Models;
using Microsoft.EntityFrameworkCore;

namespace CoachTrainingService.Services;

public class CoachService
{
    private readonly CoachDbContext _db;
    private readonly IdentityServiceClient _identityClient;

    public CoachService(CoachDbContext db, IdentityServiceClient identityClient)
    {
        _db = db;
        _identityClient = identityClient;
    }

    // ── Lister tous les coachs (filtrage optionnel par spécialité) ──────────
    public async Task<IEnumerable<CoachResponseDto>> GetAllAsync(string? speciality = null)
    {
        var query = _db.Coaches
            .Include(c => c.Availabilities)
            .Include(c => c.Certifications)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(speciality))
            query = query.Where(c => c.Speciality != null && c.Speciality.ToLower().Contains(speciality.ToLower()));

        return await query.Select(c => ToDto(c)).ToListAsync();
    }

    // ── Obtenir un coach par ID ─────────────────────────────────────────────
    public async Task<CoachResponseDto?> GetByIdAsync(long id)
    {
        var coach = await _db.Coaches
            .Include(c => c.Availabilities)
            .Include(c => c.Certifications)
            .FirstOrDefaultAsync(c => c.Id == id);

        return coach == null ? null : ToDto(coach);
    }

    // ── Créer un coach ──────────────────────────────────────────────────────
    public async Task<CoachResponseDto> CreateAsync(CreateCoachDto dto)
    {
        // 🔗 Communication Synchrone (Atelier 4) : Valider le userId sur Identity Service s'il est renseigné
        if (dto.UserId.HasValue)
        {
            var user = await _identityClient.GetUserByIdAsync(dto.UserId.Value);
            if (user == null)
                throw new KeyNotFoundException($"L'utilisateur avec l'ID {dto.UserId.Value} n'existe pas dans le microservice Identity.");

            if (user.Status != "ACTIVE")
                throw new InvalidOperationException($"L'utilisateur {dto.UserId.Value} a un statut {user.Status}. Création impossible.");
        }

        if (dto.Rating is < 0 or > 5)
            throw new InvalidOperationException("La note doit être comprise entre 0 et 5.");

        var coach = new Coach
        {
            Name = dto.Name,
            Speciality = dto.Speciality,
            UserId = dto.UserId,
            Rating = dto.Rating ?? 0
        };
        _db.Coaches.Add(coach);
        await _db.SaveChangesAsync();
        return ToDto(coach);
    }

    // ── Mettre à jour un coach ──────────────────────────────────────────────
    public async Task<CoachResponseDto?> UpdateAsync(long id, UpdateCoachDto dto)
    {
        var coach = await _db.Coaches.Include(c => c.Availabilities).Include(c => c.Certifications).FirstOrDefaultAsync(c => c.Id == id);
        if (coach == null) return null;

        if (dto.Name != null) coach.Name = dto.Name;
        if (dto.Speciality != null) coach.Speciality = dto.Speciality;
        if (dto.Rating is >= 0 and <= 5) coach.Rating = dto.Rating.Value;

        await _db.SaveChangesAsync();
        return ToDto(coach);
    }

    // ── Mettre à jour la note ───────────────────────────────────────────────
    public async Task<CoachResponseDto?> UpdateRatingAsync(long id, UpdateRatingDto dto)
    {
        var coach = await _db.Coaches.Include(c => c.Availabilities).Include(c => c.Certifications).FirstOrDefaultAsync(c => c.Id == id);
        if (coach == null) return null;

        if (dto.Rating < 0 || dto.Rating > 5)
            throw new ArgumentException("La note doit être comprise entre 0 et 5.");

        coach.Rating = dto.Rating;
        await _db.SaveChangesAsync();
        return ToDto(coach);
    }

    // ── Supprimer un coach ──────────────────────────────────────────────────
    public async Task<bool> DeleteAsync(long id)
    {
        var coach = await _db.Coaches.FindAsync(id);
        if (coach == null) return false;
        _db.Coaches.Remove(coach);
        await _db.SaveChangesAsync();
        return true;
    }

    // ── Ajouter une disponibilité ───────────────────────────────────────────
    public async Task<AvailabilityResponseDto?> AddAvailabilityAsync(long coachId, CoachAvailabilityDto dto)
    {
        if (!await _db.Coaches.AnyAsync(c => c.Id == coachId)) return null;

        var av = new CoachAvailability
        {
            CoachId = coachId,
            Day = dto.Day,
            StartTime = dto.StartTime,
            EndTime = dto.EndTime
        };
        _db.CoachAvailabilities.Add(av);
        await _db.SaveChangesAsync();
        return new AvailabilityResponseDto(av.Id, av.Day, av.StartTime, av.EndTime);
    }

    // ── Ajouter une certification ───────────────────────────────────────────
    public async Task<CertificationResponseDto?> AddCertificationAsync(long coachId, CreateCertificationDto dto)
    {
        if (!await _db.Coaches.AnyAsync(c => c.Id == coachId)) return null;

        var cert = new Certification
        {
            CoachId = coachId,
            Name = dto.Name,
            IssueDate = dto.IssueDate,
            ExpiryDate = dto.ExpiryDate
        };
        _db.Certifications.Add(cert);
        await _db.SaveChangesAsync();
        return new CertificationResponseDto(cert.Id, cert.Name, cert.IssueDate, cert.ExpiryDate);
    }

    // ── Mappage entité → DTO ────────────────────────────────────────────────
    private static CoachResponseDto ToDto(Coach c) => new(
        c.Id, c.Name, c.Speciality, c.Rating, c.UserId,
        c.Availabilities.Select(a => new AvailabilityResponseDto(a.Id, a.Day, a.StartTime, a.EndTime)),
        c.Certifications.Select(cert => new CertificationResponseDto(cert.Id, cert.Name, cert.IssueDate, cert.ExpiryDate))
    );
}

