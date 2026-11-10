namespace SchoolAdmission.Api.Domain;

public enum HoldStatus
{
    Held,
    Confirmed,
    Expired,
    Cancelled,
}

public static class HoldStatusNames
{
    public const string Held = "HELD";
    public const string Confirmed = "CONFIRMED";
    public const string Expired = "EXPIRED";
    public const string Cancelled = "CANCELLED";

    public static string ToName(HoldStatus status) => status switch
    {
        HoldStatus.Held => Held,
        HoldStatus.Confirmed => Confirmed,
        HoldStatus.Expired => Expired,
        HoldStatus.Cancelled => Cancelled,
        _ => throw new ArgumentOutOfRangeException(nameof(status), status, null),
    };

    public static HoldStatus FromName(string name) => name switch
    {
        Held => HoldStatus.Held,
        Confirmed => HoldStatus.Confirmed,
        Expired => HoldStatus.Expired,
        Cancelled => HoldStatus.Cancelled,
        _ => throw new ArgumentOutOfRangeException(nameof(name), name, null),
    };
}

/// <summary>
/// An application: a seat held for a student until <see cref="ExpiresAt"/>,
/// which becomes an admission once the fee is paid (confirmed).
/// </summary>
public class Hold
{
    public required string Id { get; init; }
    public required string ClassId { get; init; }
    public SchoolClass? Class { get; init; }
    public required string StudentId { get; init; }
    public HoldStatus Status { get; set; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset ExpiresAt { get; init; }
    public DateTimeOffset? ConfirmedAt { get; set; }
    public DateTimeOffset? CancelledAt { get; set; }

    /// <summary>
    /// The status as seen at <paramref name="now"/>. A HELD row whose time is up is
    /// EXPIRED even if the background sweeper has not rewritten it yet.
    /// </summary>
    public HoldStatus EffectiveStatus(DateTimeOffset now) =>
        Status == HoldStatus.Held && ExpiresAt <= now ? HoldStatus.Expired : Status;
}
