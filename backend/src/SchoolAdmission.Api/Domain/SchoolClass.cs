namespace SchoolAdmission.Api.Domain;

/// <summary>
/// One admission "class". Every shift is its own class with its own seat count,
/// e.g. "Class 6 - Morning Shift" and "Class 6 - Day Shift".
/// </summary>
public class SchoolClass
{
    public required string Id { get; init; }
    public required string Name { get; set; }

    /// <summary>Trimmed, upper-cased name used to keep class names unique.</summary>
    public required string NormalizedName { get; set; }

    public int TotalSeats { get; set; }
    public DateTimeOffset CreatedAt { get; init; }

    public static string NormalizeName(string name) => name.Trim().ToUpperInvariant();
}
