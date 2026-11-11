using System.Net;
using System.Net.Http.Json;
using SchoolAdmission.Api.Tests.Infrastructure;

namespace SchoolAdmission.Api.Tests;

public class AdminHoldsTests : ApiTestBase
{
    private async Task<List<HoldDto>> AdminListAsync(string query = "") =>
        (await Client.GetFromJsonAsync<List<HoldDto>>($"/admin/holds{query}"))!;

    [Fact]
    public async Task Admin_sees_every_application_with_student_class_and_status()
    {
        var morning = await CreateClassAsync(10, "Class 6 - Morning Shift");
        var day = await CreateClassAsync(10, "Class 7 - Day Shift");
        var paid = NewStudentId();
        var pending = NewStudentId();
        var cancelled = NewStudentId();

        var paidHold = await HoldSeatAsync(morning.Id, paid);
        await ConfirmAsync(paidHold.HoldId, paid);
        await HoldSeatAsync(day.Id, pending);
        var cancelledHold = await HoldSeatAsync(day.Id, cancelled);
        await CancelAsync(cancelledHold.HoldId, cancelled);

        var all = await AdminListAsync();

        Assert.Equal(3, all.Count);
        Assert.Equal("CONFIRMED", all.Single(h => h.StudentId == paid).Status);
        Assert.Equal("Class 6 - Morning Shift", all.Single(h => h.StudentId == paid).ClassName);
        Assert.Equal("HELD", all.Single(h => h.StudentId == pending).Status);
        Assert.Equal("Class 7 - Day Shift", all.Single(h => h.StudentId == pending).ClassName);
        Assert.Equal("CANCELLED", all.Single(h => h.StudentId == cancelled).Status);
    }

    [Fact]
    public async Task Admin_can_filter_by_status_class_and_student()
    {
        var morning = await CreateClassAsync(10, "Class 6 - Morning Shift");
        var day = await CreateClassAsync(10, "Class 6 - Day Shift");
        var a = NewStudentId();
        var b = NewStudentId();
        var holdA = await HoldSeatAsync(morning.Id, a);
        await HoldSeatAsync(day.Id, b);
        await ConfirmAsync(holdA.HoldId, a);

        Assert.Equal([a], (await AdminListAsync("?status=CONFIRMED")).Select(h => h.StudentId));
        Assert.Equal([b], (await AdminListAsync("?status=held")).Select(h => h.StudentId));
        Assert.Equal([b], (await AdminListAsync($"?classId={day.Id}")).Select(h => h.StudentId));
        Assert.Equal([a], (await AdminListAsync($"?studentId={a}")).Select(h => h.StudentId));
    }

    [Fact]
    public async Task Timed_out_hold_is_listed_as_expired()
    {
        var schoolClass = await CreateClassAsync(5);
        var student = NewStudentId();
        await HoldSeatAsync(schoolClass.Id, student);

        Clock.Advance(TimeSpan.FromSeconds(HoldDurationSeconds + 1));

        Assert.Equal("EXPIRED", Assert.Single(await AdminListAsync()).Status);
        Assert.Single(await AdminListAsync("?status=EXPIRED"));
        Assert.Empty(await AdminListAsync("?status=HELD"));
    }

    [Fact]
    public async Task Unknown_status_filter_is_rejected()
    {
        var response = await Client.GetAsync("/admin/holds?status=PAID");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("INVALID_STATUS", await ErrorCodeAsync(response));
    }
}
