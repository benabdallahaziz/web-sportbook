using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CoachTrainingService.Models;

[Table("training_session")]
public class TrainingSession
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public long Id { get; set; }

    [Required]
    [Column(TypeName = "date")]
    public DateOnly Date { get; set; }

    [Required]
    [Column("start_time", TypeName = "time")]
    public TimeSpan StartTime { get; set; }

    /// <summary>SCHEDULED | COMPLETED | CANCELLED</summary>
    [Required]
    [MaxLength(30)]
    public string Status { get; set; } = "SCHEDULED";

    [Column("program_id")]
    public long ProgramId { get; set; }

    /// <summary>Sportif inscrit - ID provenant du microservice Identity.</summary>
    [Column("user_id")]
    public long? UserId { get; set; }

    // Navigation
    [ForeignKey("ProgramId")]
    public TrainingProgram? Program { get; set; }
}

