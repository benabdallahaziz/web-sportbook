using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CoachTrainingService.Models;

[Table("coach")]
public class Coach
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public long Id { get; set; }

    [Required]
    [MaxLength(120)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? Speciality { get; set; }

    public double Rating { get; set; } = 0;

    /// <summary>Référence vers l'ID utilisateur du microservice Identity (pas de FK physique).</summary>
    [Column("user_id")]
    public long? UserId { get; set; }

    // Navigation
    public ICollection<CoachAvailability> Availabilities { get; set; } = new List<CoachAvailability>();
    public ICollection<Certification> Certifications { get; set; } = new List<Certification>();
    public ICollection<TrainingProgram> Programs { get; set; } = new List<TrainingProgram>();
}

