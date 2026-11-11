using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Npgsql;
using SchoolAdmission.Api.Api;
using SchoolAdmission.Api.Data;
using SchoolAdmission.Api.Domain;

namespace SchoolAdmission.Api.Services;

/// <summary>
/// All admission rules live here.
///
/// Seat-limit guarantee: every operation that can make a seat "taken" (creating a hold)
/// or keep it taken past its deadline (confirming a hold) first locks the class row in
/// PostgreSQL. Creating a hold takes <c>FOR UPDATE</c>, so hold creation for one class is
/// serialized; confirming takes <c>FOR SHARE</c>, so it cannot interleave with a creator
/// that is counting seats. The count and the insert happen under that lock, so
/// held + confirmed can never exceed total seats — no matter how many requests or how
/// many API processes hit the same database at once.
/// </summary>
public sealed class AdmissionService(AdmissionDbContext db, TimeProvider clock, IOptions<AdmissionOptions> options)
{
    private const int MaxClassNameLength = 100;
    private const int MaxTotalSeats = 100_000;

    public async Task<ClassResponse> CreateClassAsync(CreateClassRequest? request, CancellationToken ct)
    {
        var name = request?.Name?.Trim();
        if (string.IsNullOrEmpty(name))
        {
            throw ApiException.BadRequest("INVALID_CLASS_NAME", "Class name is required.");
        }
        if (name.Length > MaxClassNameLength)
        {
            throw ApiException.BadRequest("INVALID_CLASS_NAME",
                $"Class name must be at most {MaxClassNameLength} characters.");
        }
        if (request!.TotalSeats is not { } totalSeats || totalSeats < 1 || totalSeats > MaxTotalSeats)
        {
            throw ApiException.BadRequest("INVALID_TOTAL_SEATS",
                $"Total seats must be a whole number between 1 and {MaxTotalSeats}.");
        }

        var now = clock.GetUtcNow();
        var deadline = request.ApplicationDeadline?.ToUniversalTime();
        if (deadline is not null && deadline <= now)
        {
            throw ApiException.BadRequest("INVALID_DEADLINE", "The application deadline must be in the future.");
        }

        var normalizedName = SchoolClass.NormalizeName(name);
        if (await db.Classes.AnyAsync(c => c.NormalizedName == normalizedName, ct))
        {
            throw DuplicateClassName(name);
        }

        var schoolClass = new SchoolClass
        {
            Id = NewId("c"),
            Name = name,
            NormalizedName = normalizedName,
            TotalSeats = totalSeats,
            CreatedAt = now,
            ApplicationDeadline = deadline,
        };
        db.Classes.Add(schoolClass);

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex, "ux_classes_normalized_name"))
        {
            throw DuplicateClassName(name);
        }

        return new ClassResponse(schoolClass.Id, schoolClass.Name, totalSeats, 0, 0, totalSeats, deadline, true);
    }

    public async Task<IReadOnlyList<ClassResponse>> ListClassesAsync(CancellationToken ct) =>
        await QueryClassesWithCounts(db.Classes.OrderBy(c => c.CreatedAt).ThenBy(c => c.Name)).ToListAsync(ct);

    public async Task<ClassResponse> GetClassAsync(string classId, CancellationToken ct) =>
        await QueryClassesWithCounts(db.Classes.Where(c => c.Id == classId)).FirstOrDefaultAsync(ct)
        ?? throw ClassNotFound();

    public async Task<HoldResponse> CreateHoldAsync(string classId, string studentId, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var oneClassPerStudent = options.Value.OneClassPerStudent;

        if (oneClassPerStudent)
        {
            // Serialize this student's applications across all classes (and all processes), so two
            // simultaneous applications to different classes can't both pass the check below.
            // Always taken before the class lock, so the lock order stays consistent.
            await db.Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock(hashtext({studentId}))", ct);
        }

        var schoolClass = (await db.Classes
                .FromSql($"SELECT * FROM classes WHERE id = {classId} FOR UPDATE")
                .ToListAsync(ct))
            .SingleOrDefault() ?? throw ClassNotFound();

        // Read the clock only after the lock is ours, so "now" is ordered with other writers.
        var now = clock.GetUtcNow();

        if (!schoolClass.IsOpenForApplications(now))
        {
            throw ApiException.Conflict("APPLICATIONS_CLOSED",
                $"Applications for {schoolClass.Name} are closed: the deadline was " +
                $"{schoolClass.ApplicationDeadline:yyyy-MM-dd HH:mm} UTC.");
        }

        // This student's own timed-out hold may not be swept yet; retire it so the
        // one-active-hold-per-class unique index does not block re-applying.
        await db.Holds
            .Where(h => h.ClassId == classId && h.StudentId == studentId
                        && h.Status == HoldStatus.Held && h.ExpiresAt <= now)
            .ExecuteUpdateAsync(s => s.SetProperty(h => h.Status, HoldStatus.Expired), ct);

        var existing = await ActiveHolds(classId, now)
            .Where(h => h.StudentId == studentId)
            .Select(h => new { h.Id, h.Status })
            .FirstOrDefaultAsync(ct);
        if (existing is not null)
        {
            var message = existing.Status == HoldStatus.Confirmed
                ? "This student is already admitted to this class."
                : "This student already has an application in progress for this class.";
            throw ApiException.Conflict("ALREADY_APPLIED", message, new { holdId = existing.Id });
        }

        if (oneClassPerStudent)
        {
            var elsewhere = await db.Holds
                .Where(h => h.StudentId == studentId && h.ClassId != classId
                            && ((h.Status == HoldStatus.Held && h.ExpiresAt > now) || h.Status == HoldStatus.Confirmed))
                .Select(h => new { h.Id, h.Status, ClassName = h.Class!.Name })
                .FirstOrDefaultAsync(ct);
            if (elsewhere is not null)
            {
                var message = elsewhere.Status == HoldStatus.Confirmed
                    ? $"This student is already admitted to {elsewhere.ClassName}. A student can be admitted to only one class."
                    : $"This student already has an application for {elsewhere.ClassName}. A student can apply for only one class — cancel that application first to apply here.";
                throw ApiException.Conflict("ALREADY_APPLIED_ELSEWHERE", message,
                    new { holdId = elsewhere.Id, className = elsewhere.ClassName });
            }
        }

        var taken = await ActiveHolds(classId, now).CountAsync(ct);
        if (taken >= schoolClass.TotalSeats)
        {
            throw ApiException.Conflict("NO_SEATS_AVAILABLE",
                $"Sorry, all seats in {schoolClass.Name} are taken right now. " +
                "A seat may open up again if someone's hold expires.");
        }

        var hold = new Hold
        {
            Id = NewId("h"),
            ClassId = classId,
            StudentId = studentId,
            Status = HoldStatus.Held,
            CreatedAt = now,
            // Whole seconds so expiresAt round-trips exactly through the API's JSON format.
            ExpiresAt = TruncateToSeconds(now) + options.Value.HoldDuration,
        };
        db.Holds.Add(hold);

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex, "ux_holds_one_active_per_student_class"))
        {
            throw ApiException.Conflict("ALREADY_APPLIED",
                "This student already has an application in progress for this class.");
        }

        await tx.CommitAsync(ct);
        return HoldResponse.From(hold, schoolClass.Name, now);
    }

    public async Task<HoldResponse> GetHoldAsync(string holdId, CancellationToken ct)
    {
        var row = await db.Holds.AsNoTracking()
            .Where(h => h.Id == holdId)
            .Select(h => new { Hold = h, ClassName = h.Class!.Name })
            .FirstOrDefaultAsync(ct) ?? throw HoldNotFound();
        return HoldResponse.From(row.Hold, row.ClassName, clock.GetUtcNow());
    }

    public async Task<IReadOnlyList<HoldResponse>> ListStudentHoldsAsync(string studentId, CancellationToken ct)
    {
        var rows = await db.Holds.AsNoTracking()
            .Where(h => h.StudentId == studentId)
            .OrderByDescending(h => h.CreatedAt)
            .Select(h => new { Hold = h, ClassName = h.Class!.Name })
            .ToListAsync(ct);
        var now = clock.GetUtcNow();
        return rows.Select(r => HoldResponse.From(r.Hold, r.ClassName, now)).ToList();
    }

    public const int AdminListLimit = 1000;

    /// <summary>
    /// Every application, newest first, for the admin panel. Filters are optional; <paramref name="status"/>
    /// is matched against the effective status (a timed-out HELD row counts as EXPIRED).
    /// </summary>
    public async Task<IReadOnlyList<HoldResponse>> ListAllHoldsAsync(
        string? status, string? classId, string? studentId, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var query = db.Holds.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(classId))
        {
            query = query.Where(h => h.ClassId == classId);
        }
        if (!string.IsNullOrWhiteSpace(studentId))
        {
            var prefix = studentId.Trim();
            query = query.Where(h => h.StudentId.StartsWith(prefix));
        }
        if (!string.IsNullOrWhiteSpace(status))
        {
            query = status.Trim().ToUpperInvariant() switch
            {
                HoldStatusNames.Held => query.Where(h => h.Status == HoldStatus.Held && h.ExpiresAt > now),
                HoldStatusNames.Expired => query.Where(h =>
                    h.Status == HoldStatus.Expired || (h.Status == HoldStatus.Held && h.ExpiresAt <= now)),
                HoldStatusNames.Confirmed => query.Where(h => h.Status == HoldStatus.Confirmed),
                HoldStatusNames.Cancelled => query.Where(h => h.Status == HoldStatus.Cancelled),
                _ => throw ApiException.BadRequest("INVALID_STATUS",
                    "Status must be one of HELD, CONFIRMED, EXPIRED or CANCELLED."),
            };
        }

        var rows = await query
            .OrderByDescending(h => h.CreatedAt)
            .Take(AdminListLimit)
            .Select(h => new { Hold = h, ClassName = h.Class!.Name })
            .ToListAsync(ct);
        return rows.Select(r => HoldResponse.From(r.Hold, r.ClassName, now)).ToList();
    }

    public async Task<HoldResponse> ConfirmHoldAsync(string holdId, string studentId, CancellationToken ct)
    {
        var classId = await db.Holds.Where(h => h.Id == holdId).Select(h => h.ClassId).FirstOrDefaultAsync(ct)
                      ?? throw HoldNotFound();

        await using var tx = await db.Database.BeginTransactionAsync(ct);

        // Same lock order as CreateHoldAsync (class, then hold). FOR SHARE lets confirms run
        // side by side, but a seat-counting creator waits for us (and we for it), so a hold
        // that expires mid-confirm can't be handed to someone else and confirmed as well.
        await db.Database.ExecuteSqlAsync($"SELECT 1 FROM classes WHERE id = {classId} FOR SHARE", ct);
        var hold = await LockHoldAsync(holdId, ct);
        EnsureOwner(hold, studentId);

        var now = clock.GetUtcNow();
        switch (hold.EffectiveStatus(now))
        {
            case HoldStatus.Confirmed:
                // Paying twice is harmless: nothing changes, confirmedSeats stays the same.
                break;
            case HoldStatus.Cancelled:
                throw ApiException.Conflict("HOLD_CANCELLED",
                    "This application was cancelled, so the fee can no longer be paid.");
            case HoldStatus.Expired:
                await MarkExpiredAsync(hold, ct);
                await tx.CommitAsync(ct);
                throw HoldExpired("The time to pay the admission fee has run out. Please apply again if seats are available.");
            case HoldStatus.Held:
                hold.Status = HoldStatus.Confirmed;
                hold.ConfirmedAt = now;
                await db.SaveChangesAsync(ct);
                break;
        }

        await tx.CommitAsync(ct);
        var className = await db.Classes.Where(c => c.Id == hold.ClassId).Select(c => c.Name).SingleAsync(ct);
        return HoldResponse.From(hold, className, now);
    }

    public async Task CancelHoldAsync(string holdId, string studentId, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);

        var hold = await LockHoldAsync(holdId, ct);
        EnsureOwner(hold, studentId);

        var now = clock.GetUtcNow();
        switch (hold.EffectiveStatus(now))
        {
            case HoldStatus.Cancelled:
                // Already cancelled: DELETE is idempotent.
                break;
            case HoldStatus.Confirmed:
                throw ApiException.Conflict("ALREADY_CONFIRMED",
                    "This admission is already confirmed (fee paid) and cannot be cancelled here. Please contact the school.");
            case HoldStatus.Expired:
                await MarkExpiredAsync(hold, ct);
                await tx.CommitAsync(ct);
                throw HoldExpired("This application has already expired, so there is nothing to cancel.");
            case HoldStatus.Held:
                hold.Status = HoldStatus.Cancelled;
                hold.CancelledAt = now;
                await db.SaveChangesAsync(ct);
                break;
        }

        await tx.CommitAsync(ct);
    }

    /// <summary>Rewrites timed-out HELD rows to EXPIRED. Returns the number of rows changed.</summary>
    public Task<int> ExpireStaleHoldsAsync(CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        // SKIP LOCKED: never wait on (or deadlock with) a request that is working on a hold.
        return db.Database.ExecuteSqlAsync($"""
            UPDATE holds SET status = 'EXPIRED'
            WHERE id IN (
                SELECT id FROM holds
                WHERE status = 'HELD' AND expires_at <= {now}
                FOR UPDATE SKIP LOCKED)
            """, ct);
    }

    /// <summary>Holds that occupy a seat at <paramref name="now"/>: unexpired HELD plus CONFIRMED.</summary>
    private IQueryable<Hold> ActiveHolds(string classId, DateTimeOffset now) =>
        db.Holds.Where(h => h.ClassId == classId
                            && ((h.Status == HoldStatus.Held && h.ExpiresAt > now) || h.Status == HoldStatus.Confirmed));

    private IQueryable<ClassResponse> QueryClassesWithCounts(IQueryable<SchoolClass> classes)
    {
        var now = clock.GetUtcNow();
        return classes.AsNoTracking()
            .Select(c => new
            {
                c.Id,
                c.Name,
                c.TotalSeats,
                c.ApplicationDeadline,
                Held = db.Holds.Count(h => h.ClassId == c.Id && h.Status == HoldStatus.Held && h.ExpiresAt > now),
                Confirmed = db.Holds.Count(h => h.ClassId == c.Id && h.Status == HoldStatus.Confirmed),
            })
            .Select(c => new ClassResponse(
                c.Id, c.Name, c.TotalSeats, c.Held, c.Confirmed, c.TotalSeats - c.Held - c.Confirmed,
                c.ApplicationDeadline, c.ApplicationDeadline == null || c.ApplicationDeadline > now));
    }

    private async Task<Hold> LockHoldAsync(string holdId, CancellationToken ct) =>
        (await db.Holds.FromSql($"SELECT * FROM holds WHERE id = {holdId} FOR UPDATE").ToListAsync(ct))
        .SingleOrDefault() ?? throw HoldNotFound();

    private async Task MarkExpiredAsync(Hold hold, CancellationToken ct)
    {
        if (hold.Status == HoldStatus.Held)
        {
            hold.Status = HoldStatus.Expired;
            await db.SaveChangesAsync(ct);
        }
    }

    private static void EnsureOwner(Hold hold, string studentId)
    {
        if (hold.StudentId != studentId)
        {
            throw ApiException.Forbidden("NOT_YOUR_APPLICATION",
                "This application belongs to a different student.");
        }
    }

    private static DateTimeOffset TruncateToSeconds(DateTimeOffset t) =>
        new(t.UtcTicks - t.UtcTicks % TimeSpan.TicksPerSecond, TimeSpan.Zero);

    private static string NewId(string prefix) => $"{prefix}_{Guid.CreateVersion7():N}";

    private static bool IsUniqueViolation(DbUpdateException ex, string constraint) =>
        ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation } pg
        && pg.ConstraintName == constraint;

    private static ApiException ClassNotFound() =>
        ApiException.NotFound("CLASS_NOT_FOUND", "This class does not exist. It may have been removed.");

    private static ApiException HoldNotFound() =>
        ApiException.NotFound("APPLICATION_NOT_FOUND", "This application could not be found.");

    private static ApiException HoldExpired(string message) => ApiException.Conflict("HOLD_EXPIRED", message);

    private static ApiException DuplicateClassName(string name) =>
        ApiException.Conflict("CLASS_ALREADY_EXISTS", $"A class named \"{name}\" already exists.");
}
