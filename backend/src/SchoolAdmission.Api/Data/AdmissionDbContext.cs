using Microsoft.EntityFrameworkCore;
using SchoolAdmission.Api.Domain;

namespace SchoolAdmission.Api.Data;

public class AdmissionDbContext(DbContextOptions<AdmissionDbContext> options) : DbContext(options)
{
    public DbSet<SchoolClass> Classes => Set<SchoolClass>();
    public DbSet<Hold> Holds => Set<Hold>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<SchoolClass>(e =>
        {
            e.ToTable("classes", t => t.HasCheckConstraint("ck_classes_total_seats_positive", "total_seats > 0"));
            e.HasKey(c => c.Id);
            e.Property(c => c.Id).HasColumnName("id").HasMaxLength(40);
            e.Property(c => c.Name).HasColumnName("name").HasMaxLength(100).IsRequired();
            e.Property(c => c.NormalizedName).HasColumnName("normalized_name").HasMaxLength(100).IsRequired();
            e.Property(c => c.TotalSeats).HasColumnName("total_seats");
            e.Property(c => c.CreatedAt).HasColumnName("created_at");
            e.Property(c => c.ApplicationDeadline).HasColumnName("application_deadline");
            e.HasIndex(c => c.NormalizedName).IsUnique().HasDatabaseName("ux_classes_normalized_name");
        });

        modelBuilder.Entity<Hold>(e =>
        {
            e.ToTable("holds", t => t.HasCheckConstraint(
                "ck_holds_status", "status IN ('HELD', 'CONFIRMED', 'EXPIRED', 'CANCELLED')"));
            e.HasKey(h => h.Id);
            e.Property(h => h.Id).HasColumnName("id").HasMaxLength(40);
            e.Property(h => h.ClassId).HasColumnName("class_id").HasMaxLength(40);
            e.Property(h => h.StudentId).HasColumnName("student_id").HasMaxLength(17).IsRequired();
            e.Property(h => h.Status).HasColumnName("status").HasMaxLength(16)
                .HasConversion(s => HoldStatusNames.ToName(s), s => HoldStatusNames.FromName(s));
            e.Property(h => h.CreatedAt).HasColumnName("created_at");
            e.Property(h => h.ExpiresAt).HasColumnName("expires_at");
            e.Property(h => h.ConfirmedAt).HasColumnName("confirmed_at");
            e.Property(h => h.CancelledAt).HasColumnName("cancelled_at");

            e.HasOne(h => h.Class).WithMany().HasForeignKey(h => h.ClassId).OnDelete(DeleteBehavior.Restrict);

            // Safety net under the row lock: a student can have at most one HELD/CONFIRMED row per class.
            e.HasIndex(h => new { h.ClassId, h.StudentId }).IsUnique()
                .HasFilter("status IN ('HELD', 'CONFIRMED')")
                .HasDatabaseName("ux_holds_one_active_per_student_class");
            e.HasIndex(h => new { h.ClassId, h.Status }).HasDatabaseName("ix_holds_class_status");
            e.HasIndex(h => h.StudentId).HasDatabaseName("ix_holds_student_id");
            e.HasIndex(h => h.ExpiresAt).HasFilter("status = 'HELD'").HasDatabaseName("ix_holds_held_expires_at");
        });
    }
}
