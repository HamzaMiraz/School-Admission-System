using System.Net;
using SchoolAdmission.Api.Tests.Infrastructure;

namespace SchoolAdmission.Api.Tests;

public class ConcurrencyTests : ApiTestBase
{
    private const string ActiveSeatsSql =
        "SELECT count(*) FROM holds WHERE class_id = '{0}' AND status IN ('HELD', 'CONFIRMED')";

    [Fact]
    public async Task Many_simultaneous_applications_never_hold_more_seats_than_exist()
    {
        const int seats = 10;
        const int requests = 150;
        var schoolClass = await CreateClassAsync(seats);

        var responses = await FireAtOnce(requests, _ => PostHoldAsync(schoolClass.Id, NewStudentId()));

        Assert.Equal(seats, responses.Count(r => r.StatusCode == HttpStatusCode.Created));
        Assert.Equal(requests - seats, responses.Count(r => r.StatusCode == HttpStatusCode.Conflict));
        foreach (var rejected in responses.Where(r => r.StatusCode == HttpStatusCode.Conflict))
        {
            Assert.Equal("NO_SEATS_AVAILABLE", await ErrorCodeAsync(rejected));
        }

        var after = await GetClassAsync(schoolClass.Id);
        Assert.Equal(seats, after.HeldSeats);
        Assert.Equal(0, after.AvailableSeats);
        Assert.Equal(seats, await Database.ScalarAsync(string.Format(ActiveSeatsSql, schoolClass.Id)));
    }

    [Fact]
    public async Task Two_api_processes_on_one_database_never_oversell()
    {
        const int seats = 15;
        const int requests = 120;
        var schoolClass = await CreateClassAsync(seats);
        // A second, independent API instance: its own DI container and connection pool.
        var secondClient = StartApiInstance().CreateClient();

        var responses = await FireAtOnce(requests, i =>
            PostHoldAsync(i % 2 == 0 ? Client : secondClient, schoolClass.Id, NewStudentId()));

        Assert.Equal(seats, responses.Count(r => r.StatusCode == HttpStatusCode.Created));
        Assert.Equal(seats, await Database.ScalarAsync(string.Format(ActiveSeatsSql, schoolClass.Id)));
    }

    [Fact]
    public async Task One_student_applying_many_times_at_once_gets_one_hold()
    {
        var schoolClass = await CreateClassAsync(50);
        var studentId = NewStudentId();

        var responses = await FireAtOnce(30, _ => PostHoldAsync(schoolClass.Id, studentId));

        Assert.Single(responses, r => r.StatusCode == HttpStatusCode.Created);
        foreach (var rejected in responses.Where(r => r.StatusCode != HttpStatusCode.Created))
        {
            Assert.Equal(HttpStatusCode.Conflict, rejected.StatusCode);
            Assert.Equal("ALREADY_APPLIED", await ErrorCodeAsync(rejected));
        }
        Assert.Equal(1, (await GetClassAsync(schoolClass.Id)).HeldSeats);
    }

    [Fact]
    public async Task Confirming_the_same_hold_many_times_at_once_counts_one_seat()
    {
        var schoolClass = await CreateClassAsync(5);
        var studentId = NewStudentId();
        var hold = await HoldSeatAsync(schoolClass.Id, studentId);

        var responses = await FireAtOnce(25, _ => ConfirmAsync(hold.HoldId, studentId));

        Assert.All(responses, r => Assert.Equal(HttpStatusCode.OK, r.StatusCode));
        var after = await GetClassAsync(schoolClass.Id);
        Assert.Equal(1, after.ConfirmedSeats);
        Assert.Equal(0, after.HeldSeats);
        Assert.Equal(4, after.AvailableSeats);
    }

    /// <summary>Starts all requests together (behind a gate) to maximise contention.</summary>
    private static async Task<HttpResponseMessage[]> FireAtOnce(int count, Func<int, Task<HttpResponseMessage>> send)
    {
        var gate = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var tasks = Enumerable.Range(0, count)
            .Select(i => Task.Run(async () =>
            {
                await gate.Task;
                return await send(i);
            }))
            .ToArray();
        gate.SetResult();
        return await Task.WhenAll(tasks);
    }
}
