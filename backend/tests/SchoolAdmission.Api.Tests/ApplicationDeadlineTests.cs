using System.Net;
using System.Net.Http.Json;
using SchoolAdmission.Api.Tests.Infrastructure;

namespace SchoolAdmission.Api.Tests;

public class ApplicationDeadlineTests : ApiTestBase
{
    private async Task<ClassDto> CreateClassWithDeadlineAsync(int seats, DateTimeOffset deadline)
    {
        var response = await Client.PostAsJsonAsync("/classes",
            new { name = $"Class {Guid.NewGuid():N}", totalSeats = seats, applicationDeadline = deadline });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<ClassDto>())!;
    }

    [Fact]
    public async Task Class_shows_its_deadline_and_is_open_before_it()
    {
        var deadline = Clock.GetUtcNow().AddDays(7);
        var created = await CreateClassWithDeadlineAsync(10, deadline);

        var schoolClass = await GetClassAsync(created.Id);

        Assert.True(schoolClass.IsOpen);
        Assert.Equal(deadline.UtcDateTime, schoolClass.ApplicationDeadline!.Value.UtcDateTime, TimeSpan.FromSeconds(1));
        Assert.Equal(HttpStatusCode.Created, (await PostHoldAsync(created.Id, NewStudentId())).StatusCode);
    }

    [Fact]
    public async Task After_the_deadline_the_class_is_closed_and_nobody_can_apply()
    {
        var created = await CreateClassWithDeadlineAsync(10, Clock.GetUtcNow().AddHours(1));

        Clock.Advance(TimeSpan.FromHours(1) + TimeSpan.FromSeconds(1));

        Assert.False((await GetClassAsync(created.Id)).IsOpen);
        var response = await PostHoldAsync(created.Id, NewStudentId());
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("APPLICATIONS_CLOSED", await ErrorCodeAsync(response));
    }

    [Fact]
    public async Task A_hold_made_before_the_deadline_can_still_be_paid_after_it()
    {
        var created = await CreateClassWithDeadlineAsync(10, Clock.GetUtcNow().AddMinutes(5));
        var student = NewStudentId();
        var hold = await HoldSeatAsync(created.Id, student);

        Clock.Advance(TimeSpan.FromMinutes(6)); // past the deadline, but within the 10-minute hold

        Assert.Equal(HttpStatusCode.OK, (await ConfirmAsync(hold.HoldId, student)).StatusCode);
    }

    [Fact]
    public async Task Deadline_in_the_past_is_rejected()
    {
        var response = await Client.PostAsJsonAsync("/classes",
            new { name = "Class 6 - Morning Shift", totalSeats = 10, applicationDeadline = Clock.GetUtcNow().AddMinutes(-1) });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("INVALID_DEADLINE", await ErrorCodeAsync(response));
    }

    [Fact]
    public async Task Class_without_deadline_stays_open()
    {
        var created = await CreateClassAsync(5);

        Clock.Advance(TimeSpan.FromDays(365));

        var schoolClass = await GetClassAsync(created.Id);
        Assert.True(schoolClass.IsOpen);
        Assert.Null(schoolClass.ApplicationDeadline);
    }
}
