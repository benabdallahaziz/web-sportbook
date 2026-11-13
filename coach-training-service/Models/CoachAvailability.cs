using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CoachTrainingService.Models;

[Table("coach_availability")]
public class CoachAvailability
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public long Id { get; set; }

    [Required]
    [MaxLength(15)]
    public string Day { get; set; } = string.Empty;

    [Required]
    [Column("start_time", TypeName = "time")]
    public TimeSpan StartTime { get; set; }

    [Required]
    [Column("end_time", TypeName = "time")]
    public TimeSpan EndTime { get; set; }

    [Column("coach_id")]
    public long CoachId { get; set; }

    // Navigation
    [ForeignKey("CoachId")]
    public Coach? Coach { get; set; }
}

