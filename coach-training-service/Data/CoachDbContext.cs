using CoachTrainingService.Models;
using Microsoft.EntityFrameworkCore;

namespace CoachTrainingService.Data;

public class CoachDbContext : DbContext
{
    public CoachDbContext(DbContextOptions<CoachDbContext> options) : base(options) { }

    public DbSet<Coach> Coaches => Set<Coach>();
    public DbSet<CoachAvailability> CoachAvailabilities => Set<CoachAvailability>();
    public DbSet<Certification> Certifications => Set<Certification>();
    public DbSet<TrainingProgram> TrainingPrograms => Set<TrainingProgram>();
    public DbSet<TrainingSession> TrainingSessions => Set<TrainingSession>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Coach -> CoachAvailability  (1 à plusieurs, suppression en cascade)
        modelBuilder.Entity<CoachAvailability>()
            .HasOne(a => a.Coach)
            .WithMany(c => c.Availabilities)
            .HasForeignKey(a => a.CoachId)
            .OnDelete(DeleteBehavior.Cascade);

        // Coach -> Certification  (1 à plusieurs, suppression en cascade)
        modelBuilder.Entity<Certification>()
            .HasOne(c => c.Coach)
            .WithMany(c => c.Certifications)
            .HasForeignKey(c => c.CoachId)
            .OnDelete(DeleteBehavior.Cascade);

        // Coach -> TrainingProgram  (1 à plusieurs, suppression en cascade)
        modelBuilder.Entity<TrainingProgram>()
            .HasOne(p => p.Coach)
            .WithMany(c => c.Programs)
            .HasForeignKey(p => p.CoachId)
            .OnDelete(DeleteBehavior.Cascade);

        // TrainingProgram -> TrainingSession  (1 à plusieurs, suppression en cascade)
        modelBuilder.Entity<TrainingSession>()
            .HasOne(s => s.Program)
            .WithMany(p => p.Sessions)
            .HasForeignKey(s => s.ProgramId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

