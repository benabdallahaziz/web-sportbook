using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CoachTrainingService.Models;

[Table("certification")]
public class Certification
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public long Id { get; set; }

    [Required]
    [MaxLength(150)]
    public string Name { get; set; } = string.Empty;

    [Column("issue_date", TypeName = "date")]
    public DateOnly? IssueDate { get; set; }

    [Column("expiry_date", TypeName = "date")]
    public DateOnly? ExpiryDate { get; set; }

    [Column("coach_id")]
    public long CoachId { get; set; }

    // Navigation
    [ForeignKey("CoachId")]
    public Coach? Coach { get; set; }
}

