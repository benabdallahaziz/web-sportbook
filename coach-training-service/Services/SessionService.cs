using CoachTrainingService.Data;
using CoachTrainingService.Dtos;
using CoachTrainingService.Models;
using Microsoft.EntityFrameworkCore;

namespace CoachTrainingService.Services;

public class SessionService
{
    private static readonly HashSet<string> ValidStatuses = new() { "SCHEDULED", "COMPLETED", "CANCELLED" };
    private readonly CoachDbContext _db;
    private readonly IdentityServiceClient _identityClient;
    private readonly RabbitMQProducer _rabbitProducer;

    public SessionService(CoachDbContext db, IdentityServiceClient identityClient, RabbitMQProducer rabbitProducer)
    {
        _db = db;
        _identityClient = identityClient;
        _rabbitProducer = rabbitProducer;
    }

    // ── Toutes les séances d'un programme ───────────────────────────────────
    public async Task<IEnumerable<SessionResponseDto>> GetByProgramAsync(long programId)
    {
        return await _db.TrainingSessions
            .Where(s => s.ProgramId == programId)
            .Include(s => s.Program)
            .Select(s => ToDto(s))
            .ToListAsync();
    }

    // ── Séances inscrites d'un sportif (par userId) ─────────────────────────
    public async Task<IEnumerable<SessionResponseDto>> GetByUserAsync(long userId)
    {
        return await _db.TrainingSessions
            .Where(s => s.UserId == userId)
            .Include(s => s.Program)
            .Select(s => ToDto(s))
            .ToListAsync();
    }

    // ── Obtenir une séance par ID ───────────────────────────────────────────
    public async Task<SessionResponseDto?> GetByIdAsync(long id)
    {
        var session = await _db.TrainingSessions
            .Include(s => s.Program)
            .FirstOrDefaultAsync(s => s.Id == id);

        return session == null ? null : ToDto(session);
    }

    // ── Planifier une nouvelle séance ───────────────────────────────────────
    public async Task<SessionResponseDto?> CreateAsync(CreateSessionDto dto)
    {
        var program = await _db.TrainingPrograms.FindAsync(dto.ProgramId);
        if (program == null) return null;

        var session = new TrainingSession
        {
            Date = dto.Date,
            StartTime = dto.StartTime,
            ProgramId = dto.ProgramId,
            Status = "SCHEDULED"
        };
        _db.TrainingSessions.Add(session);
        await _db.SaveChangesAsync();

        session.Program = program;
        return ToDto(session);
    }

    // ── Inscrire un sportif à une séance ────────────────────────────────────
    public async Task<SessionResponseDto?> RegisterUserAsync(long sessionId, long userId)
    {
        var session = await _db.TrainingSessions.Include(s => s.Program).FirstOrDefaultAsync(s => s.Id == sessionId);
        if (session == null) return null;

        if (session.Status != "SCHEDULED")
            throw new InvalidOperationException("Impossible de s'inscrire à une séance non planifiée.");

        // 🔗 Communication Synchrone (Atelier 4) : Vérification auprès du microservice Identity
        var user = await _identityClient.GetUserByIdAsync(userId);
        if (user == null)
            throw new KeyNotFoundException($"Le sportif avec l'ID {userId} n'existe pas dans le microservice Identity.");

        if (user.Status != "ACTIVE")
            throw new InvalidOperationException($"Le compte du sportif {userId} est {user.Status}. Inscription impossible.");

        session.UserId = userId;
        await _db.SaveChangesAsync();

        // 📨 Communication Asynchrone (Atelier 6) : Publication de l'événement dans RabbitMQ
        var evt = new SessionBookedEvent(
            EventId: Guid.NewGuid().ToString(),
            EventType: "SESSION_BOOKED",
            Timestamp: DateTime.UtcNow,
            SessionId: session.Id,
            ProgramId: session.ProgramId,
            ProgramName: session.Program?.Name,
            Date: session.Date,
            StartTime: session.StartTime,
            UserId: user.Id,
            UserEmail: user.Email
        );
        _rabbitProducer.PublishSessionBooked(evt);

        return ToDto(session);
    }

    // ── Mettre à jour le statut d'une séance ────────────────────────────────
    public async Task<SessionResponseDto?> UpdateStatusAsync(long id, string status)
    {
        var s = status.ToUpper();
        if (!ValidStatuses.Contains(s))
            throw new ArgumentException($"Statut invalide. Valeurs autorisées : {string.Join(", ", ValidStatuses)}");

        var session = await _db.TrainingSessions.Include(s => s.Program).FirstOrDefaultAsync(x => x.Id == id);
        if (session == null) return null;

        session.Status = s;
        await _db.SaveChangesAsync();
        return ToDto(session);
    }

    // ── Supprimer une séance ─────────────────────────────────────────────────
    public async Task<bool> DeleteAsync(long id)
    {
        var session = await _db.TrainingSessions.FindAsync(id);
        if (session == null) return false;
        _db.TrainingSessions.Remove(session);
        await _db.SaveChangesAsync();
        return true;
    }

    private static SessionResponseDto ToDto(TrainingSession s) => new(
        s.Id, s.Date, s.StartTime, s.Status, s.ProgramId, s.Program?.Name, s.UserId
    );
}

