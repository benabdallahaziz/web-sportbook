namespace CoachTrainingService.Dtos;

// ============================================================
//  COACH DTOs
// ============================================================

public record CreateCoachDto(
    string Name,
    string? Speciality,
    long? UserId
);

public record UpdateCoachDto(
    string? Name,
    string? Speciality
);

public record UpdateRatingDto(double Rating);

public record CoachAvailabilityDto(
    string Day,
    TimeSpan StartTime,
    TimeSpan EndTime
);

public record AvailabilityResponseDto(
    long Id,
    string Day,
    TimeSpan StartTime,
    TimeSpan EndTime
);

public record CoachResponseDto(
    long Id,
    string Name,
    string? Speciality,
    double Rating,
    long? UserId,
    IEnumerable<AvailabilityResponseDto> Availabilities,
    IEnumerable<CertificationResponseDto> Certifications
);

// ============================================================
//  CERTIFICATION DTOs
// ============================================================

public record CreateCertificationDto(
    string Name,
    DateOnly? IssueDate,
    DateOnly? ExpiryDate
);

public record CertificationResponseDto(
    long Id,
    string Name,
    DateOnly? IssueDate,
    DateOnly? ExpiryDate
);

// ============================================================
//  TRAINING PROGRAM DTOs
// ============================================================

public record CreateProgramDto(
    string Name,
    string? Description,
    int? DurationWeeks,
    long CoachId
);

public record UpdateProgramDto(
    string? Name,
    string? Description,
    int? DurationWeeks
);

public record ProgramResponseDto(
    long Id,
    string Name,
    string? Description,
    int? DurationWeeks,
    long CoachId,
    string? CoachName
);

// ============================================================
//  TRAINING SESSION DTOs
// ============================================================

public record CreateSessionDto(
    DateOnly Date,
    TimeSpan StartTime,
    long ProgramId
);

public record RegisterSessionDto(long UserId);

public record UpdateSessionStatusDto(string Status);

public record SessionResponseDto(
    long Id,
    DateOnly Date,
    TimeSpan StartTime,
    string Status,
    long ProgramId,
    string? ProgramName,
    long? UserId
);

// ============================================================
//  IDENTITY DTOs (consommés depuis identity-user-service)
// ============================================================

public record UserResponseDto(
    long Id,
    string Email,
    string Status,
    string? FirstName,
    string? LastName,
    string? Phone,
    string? Address,
    List<string>? Roles
);

// ============================================================
//  RABBITMQ EVENT DTOs (Atelier 6 - Communication Asynchrone)
// ============================================================

public record SessionBookedEvent(
    string EventId,
    string EventType,
    DateTime Timestamp,
    long SessionId,
    long ProgramId,
    string? ProgramName,
    DateOnly Date,
    TimeSpan StartTime,
    long UserId,
    string? UserEmail
);

