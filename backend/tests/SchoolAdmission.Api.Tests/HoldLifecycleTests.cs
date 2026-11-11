using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using SchoolAdmission.Api.Services;
using SchoolAdmission.Api.Tests.Infrastructure;

namespace SchoolAdmission.Api.Tests;

public class HoldLifecycleTests : ApiTestBase
{
    [Fact]
    public async Task Hold_expires_on_its_own_and_the_seat_is_released()
    {
        var schoolClass = await CreateClassAsync(1);
        var first = NewStudentId();
        var second = NewStudentId();
        var hold = await HoldSeatAsync(schoolClass.Id, first);
        Assert.Equal("HELD", hold.Status);
        Assert.Equal(HttpStatusCode.Conflict, (await PostHoldAsync(schoolClass.Id, second)).StatusCode);

        Clock.Advance(TimeSpan.FromSeconds(HoldDurationSeconds + 1));

        var expired = await GetHoldAsync(hold.HoldId);
        Assert.Equal("EXPIRED", expired.Status);
        Assert.Equal(0, expired.RemainingSeconds);
        Assert.Equal(1, (await GetClassAsync(schoolClass.Id)).AvailableSeats);

        // The freed seat can be taken by someone else, and the expired hold can no longer be paid.
        Assert.Equal(HttpStatusCode.Created, (await PostHoldAsync(schoolClass.Id, second)).StatusCode);
        var confirm = await ConfirmAsync(hold.HoldId, first);
        Assert.Equal(HttpStatusCode.Conflict, confirm.StatusCode);
        Assert.Equal("HOLD_EXPIRED", await ErrorCodeAsync(confirm));
    }

    [Fact]
    public async Task Expiry_worker_persists_EXPIRED_status()
    {
        var schoolClass = await CreateClassAsync(3);
        await HoldSeatAsync(schoolClass.Id, NewStudentId());
        await HoldSeatAsync(schoolClass.Id, NewStudentId());
        Clock.Advance(TimeSpan.FromSeconds(HoldDurationSeconds));

        await using var scope = Factory.Services.CreateAsyncScope();
        var expired = await scope.ServiceProvider.GetRequiredService<AdmissionService>()
            .ExpireStaleHoldsAsync(CancellationToken.None);

        Assert.Equal(2, expired);
        Assert.Equal(2, await Database.ScalarAsync("SELECT count(*) FROM holds WHERE status = 'EXPIRED'"));
    }

    [Fact]
    public async Task Student_can_apply_again_after_own_hold_expired()
    {
        var schoolClass = await CreateClassAsync(1);
        var student = NewStudentId();
        var oldHold = await HoldSeatAsync(schoolClass.Id, student);

        Clock.Advance(TimeSpan.FromSeconds(HoldDurationSeconds + 1));
        var newHold = await HoldSeatAsync(schoolClass.Id, student);

        Assert.NotEqual(oldHold.HoldId, newHold.HoldId);
        Assert.Equal("EXPIRED", (await GetHoldAsync(oldHold.HoldId)).Status);
    }

    [Fact]
    public async Task Confirm_turns_hold_into_admission_and_repeating_it_counts_once()
    {
        var schoolClass = await CreateClassAsync(2);
        var student = NewStudentId();
        var hold = await HoldSeatAsync(schoolClass.Id, student);

        var first = await ConfirmAsync(hold.HoldId, student);
        var second = await ConfirmAsync(hold.HoldId, student);

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
        Assert.Equal("CONFIRMED", (await second.Content.ReadFromJsonAsync<HoldDto>())!.Status);
        var after = await GetClassAsync(schoolClass.Id);
        Assert.Equal(1, after.ConfirmedSeats);
        Assert.Equal(0, after.HeldSeats);

        // A confirmed admission does not expire and still blocks a second application.
        Clock.Advance(TimeSpan.FromSeconds(HoldDurationSeconds * 2));
        Assert.Equal("CONFIRMED", (await GetHoldAsync(hold.HoldId)).Status);
        Assert.Equal(1, (await GetClassAsync(schoolClass.Id)).ConfirmedSeats);
        var again = await PostHoldAsync(schoolClass.Id, student);
        Assert.Equal("ALREADY_APPLIED", await ErrorCodeAsync(again));
    }

    [Fact]
    public async Task Only_the_owner_can_confirm_or_cancel()
    {
        var schoolClass = await CreateClassAsync(2);
        var owner = NewStudentId();
        var stranger = NewStudentId();
        var hold = await HoldSeatAsync(schoolClass.Id, owner);

        var confirm = await ConfirmAsync(hold.HoldId, stranger);
        var cancel = await CancelAsync(hold.HoldId, stranger);

        Assert.Equal(HttpStatusCode.Forbidden, confirm.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, cancel.StatusCode);
        Assert.Equal("NOT_YOUR_APPLICATION", await ErrorCodeAsync(confirm));
        Assert.Equal("HELD", (await GetHoldAsync(hold.HoldId)).Status);
    }

    [Fact]
    public async Task Cancel_releases_the_seat_and_cancelled_hold_cannot_be_paid()
    {
        var schoolClass = await CreateClassAsync(1);
        var student = NewStudentId();
        var hold = await HoldSeatAsync(schoolClass.Id, student);

        Assert.Equal(HttpStatusCode.NoContent, (await CancelAsync(hold.HoldId, student)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await CancelAsync(hold.HoldId, student)).StatusCode);

        Assert.Equal("CANCELLED", (await GetHoldAsync(hold.HoldId)).Status);
        Assert.Equal(1, (await GetClassAsync(schoolClass.Id)).AvailableSeats);
        var confirm = await ConfirmAsync(hold.HoldId, student);
        Assert.Equal(HttpStatusCode.Conflict, confirm.StatusCode);
        Assert.Equal("HOLD_CANCELLED", await ErrorCodeAsync(confirm));

        // The student may apply again.
        await HoldSeatAsync(schoolClass.Id, student);
    }

    [Fact]
    public async Task Confirmed_admission_cannot_be_cancelled()
    {
        var schoolClass = await CreateClassAsync(1);
        var student = NewStudentId();
        var hold = await HoldSeatAsync(schoolClass.Id, student);
        await ConfirmAsync(hold.HoldId, student);

        var cancel = await CancelAsync(hold.HoldId, student);

        Assert.Equal(HttpStatusCode.Conflict, cancel.StatusCode);
        Assert.Equal("ALREADY_CONFIRMED", await ErrorCodeAsync(cancel));
    }

    [Fact]
    public async Task Hold_lasts_for_HOLD_DURATION_SECONDS()
    {
        var schoolClass = await CreateClassAsync(1);
        var hold = await HoldSeatAsync(schoolClass.Id, NewStudentId());

        var duration = hold.ExpiresAt - hold.CreatedAt;
        Assert.InRange(duration.TotalSeconds, HoldDurationSeconds - 1, HoldDurationSeconds);
        Assert.InRange(hold.RemainingSeconds, HoldDurationSeconds - 1, HoldDurationSeconds);
    }

    [Fact]
    public async Task Student_can_apply_for_only_one_class()
    {
        var morning = await CreateClassAsync(5, "Class 6 - Morning Shift");
        var day = await CreateClassAsync(5, "Class 7 - Day Shift");
        var student = NewStudentId();
        var hold = await HoldSeatAsync(morning.Id, student);

        var second = await PostHoldAsync(day.Id, student);

        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
        Assert.Equal("ALREADY_APPLIED_ELSEWHERE", await ErrorCodeAsync(second));
        Assert.Equal(0, (await GetClassAsync(day.Id)).HeldSeats);

        // Still blocked once the first one is paid ...
        await ConfirmAsync(hold.HoldId, student);
        Assert.Equal("ALREADY_APPLIED_ELSEWHERE", await ErrorCodeAsync(await PostHoldAsync(day.Id, student)));
    }

    [Fact]
    public async Task Student_can_apply_elsewhere_after_cancelling_or_expiry()
    {
        var a = await CreateClassAsync(5, "Class 6 - Morning Shift");
        var b = await CreateClassAsync(5, "Class 6 - Day Shift");
        var c = await CreateClassAsync(5, "Class 7 - Morning Shift");
        var student = NewStudentId();

        var first = await HoldSeatAsync(a.Id, student);
        await CancelAsync(first.HoldId, student);
        await HoldSeatAsync(b.Id, student);

        Clock.Advance(TimeSpan.FromSeconds(HoldDurationSeconds + 1));
        await HoldSeatAsync(c.Id, student);
    }

    [Fact]
    public async Task Same_student_applying_to_many_classes_at_once_gets_one_hold()
    {
        var classes = new List<ClassDto>();
        for (var i = 1; i <= 10; i++)
        {
            classes.Add(await CreateClassAsync(5, $"Class {i} - Morning Shift"));
        }
        var student = NewStudentId();
        var secondClient = StartApiInstance().CreateClient();

        var responses = await Task.WhenAll(classes.SelectMany(c => new[]
        {
            Task.Run(() => PostHoldAsync(Client, c.Id, student)),
            Task.Run(() => PostHoldAsync(secondClient, c.Id, student)),
        }));

        Assert.Single(responses, r => r.StatusCode == HttpStatusCode.Created);
        Assert.Equal(1, await Database.ScalarAsync(
            $"SELECT count(*) FROM holds WHERE student_id = '{student}' AND status IN ('HELD', 'CONFIRMED')"));
    }

    [Fact]
    public async Task My_holds_lists_only_this_students_applications_newest_first()
    {
        var morning = await CreateClassAsync(5, "Class 6 - Morning Shift");
        var day = await CreateClassAsync(5, "Class 6 - Day Shift");
        var student = NewStudentId();
        var older = await HoldSeatAsync(morning.Id, student);
        await CancelAsync(older.HoldId, student);
        Clock.Advance(TimeSpan.FromSeconds(5));
        var newer = await HoldSeatAsync(day.Id, student);
        await HoldSeatAsync(morning.Id, NewStudentId());

        var response = await SendAsStudent(Client, HttpMethod.Get, "/me/holds", student);
        var holds = (await response.Content.ReadFromJsonAsync<List<HoldDto>>())!;

        Assert.Equal([newer.HoldId, older.HoldId], holds.Select(h => h.HoldId));
        Assert.Equal(["Class 6 - Day Shift", "Class 6 - Morning Shift"], holds.Select(h => h.ClassName));
        Assert.Equal(["HELD", "CANCELLED"], holds.Select(h => h.Status));
    }
}

/// <summary>With ONE_CLASS_PER_STUDENT=false only the brief's per-class rule applies.</summary>
public class PerClassRuleOnlyTests : ApiTestBase
{
    protected override IReadOnlyDictionary<string, string?> ExtraSettings =>
        new Dictionary<string, string?> { ["ONE_CLASS_PER_STUDENT"] = "false" };

    [Fact]
    public async Task Student_may_hold_seats_in_different_classes_when_switched_off()
    {
        var morning = await CreateClassAsync(1, "Class 6 - Morning Shift");
        var day = await CreateClassAsync(1, "Class 6 - Day Shift");
        var student = NewStudentId();

        await HoldSeatAsync(morning.Id, student);
        await HoldSeatAsync(day.Id, student);
        Assert.Equal("ALREADY_APPLIED", await ErrorCodeAsync(await PostHoldAsync(morning.Id, student)));
    }
}

public class ConfiguredHoldDurationTests : ApiTestBase
{
    protected override int HoldDurationSeconds => 90;

    [Fact]
    public async Task Hold_duration_comes_from_configuration()
    {
        var schoolClass = await CreateClassAsync(1);
        var hold = await HoldSeatAsync(schoolClass.Id, NewStudentId());

        Assert.InRange((hold.ExpiresAt - hold.CreatedAt).TotalSeconds, 89, 90);

        Clock.Advance(TimeSpan.FromSeconds(91));
        Assert.Equal("EXPIRED", (await GetHoldAsync(hold.HoldId)).Status);
    }
}
