using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CoachTrainingService.Models;

[Table("training_program")]
public class TrainingProgram
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public long Id { get; set; }

    [Required]
    [MaxLength(150)]
    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    /// <summary>Durée en semaines.</summary>
    public int? Duration { get; set; }

    [Column("coach_id")]
    public long CoachId { get; set; }

    // Navigation
    [ForeignKey("CoachId")]
    public Coach? Coach { get; set; }

    public ICollection<TrainingSession> Sessions { get; set; } = new List<TrainingSession>();
}

