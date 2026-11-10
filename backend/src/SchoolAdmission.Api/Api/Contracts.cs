using SchoolAdmission.Api.Domain;

namespace SchoolAdmission.Api.Api;

// Fields are nullable so missing values reach our validation (and a clear 400)
// instead of silently defaulting to "" / 0.
public sealed record CreateClassRequest(string? Name, int? TotalSeats);

public sealed record ClassResponse(
    string Id,
    string Name,
    int TotalSeats,
    int HeldSeats,
    int ConfirmedSeats,
    int AvailableSeats);

public sealed record HoldResponse(
    string HoldId,
    string ClassId,
    string ClassName,
    string StudentId,
    string Status,
    DateTimeOffset ExpiresAt,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ConfirmedAt,
    int RemainingSeconds)
{
    /// <param name="now">Current time, used to report HELD-but-timed-out rows as EXPIRED.</param>
    public static HoldResponse From(Hold hold, string className, DateTimeOffset now)
    {
        var status = hold.EffectiveStatus(now);
        var remaining = status == HoldStatus.Held ? (int)Math.Floor((hold.ExpiresAt - now).TotalSeconds) : 0;
        return new HoldResponse(
            hold.Id,
            hold.ClassId,
            className,
            hold.StudentId,
            HoldStatusNames.ToName(status),
            hold.ExpiresAt,
            hold.CreatedAt,
            hold.ConfirmedAt,
            Math.Max(0, remaining));
    }
}
