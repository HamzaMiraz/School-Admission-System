using System.Net.Http.Json;
using Microsoft.Extensions.Time.Testing;

namespace SchoolAdmission.Api.Tests.Infrastructure;

public sealed record ClassDto(string Id, string Name, int TotalSeats, int HeldSeats, int ConfirmedSeats, int AvailableSeats);

public sealed record HoldDto(
    string HoldId,
    string ClassId,
    string ClassName,
    string StudentId,
    string Status,
    DateTimeOffset ExpiresAt,
    DateTimeOffset CreatedAt,
    int RemainingSeconds);

public sealed record ErrorDto(string Error, string Message);

/// <summary>Each test gets a fresh database, a fresh API instance and a fake clock.</summary>
public abstract class ApiTestBase : IAsyncLifetime
{
    private readonly List<AdmissionApiFactory> _factories = [];
    private static long _studentCounter;

    protected TestDatabase Database { get; } = new();
    protected FakeTimeProvider Clock { get; } = new(DateTimeOffset.UtcNow);
    protected HttpClient Client { get; private set; } = null!;
    protected AdmissionApiFactory Factory { get; private set; } = null!;

    protected virtual int HoldDurationSeconds => 600;

    public Task InitializeAsync()
    {
        Factory = StartApiInstance();
        Client = Factory.CreateClient();
        return Task.CompletedTask;
    }

    /// <summary>Starts another API instance (separate DI container and connection pool) on the same database.</summary>
    protected AdmissionApiFactory StartApiInstance()
    {
        var factory = new AdmissionApiFactory(Database.ConnectionString, HoldDurationSeconds, Clock);
        _factories.Add(factory);
        return factory;
    }

    public async Task DisposeAsync()
    {
        foreach (var factory in _factories)
        {
            await factory.DisposeAsync();
        }
        await Database.DisposeAsync();
    }

    /// <summary>A unique, valid 17-digit birth registration number.</summary>
    protected static string NewStudentId() =>
        "2015" + Interlocked.Increment(ref _studentCounter).ToString("D13");

    protected async Task<ClassDto> CreateClassAsync(int totalSeats, string? name = null)
    {
        var response = await Client.PostAsJsonAsync("/classes",
            new { name = name ?? $"Class {Guid.NewGuid():N}", totalSeats });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<ClassDto>())!;
    }

    protected async Task<ClassDto> GetClassAsync(string classId) =>
        (await Client.GetFromJsonAsync<ClassDto>($"/classes/{classId}"))!;

    protected async Task<HoldDto> GetHoldAsync(string holdId) =>
        (await Client.GetFromJsonAsync<HoldDto>($"/holds/{holdId}"))!;

    protected static Task<HttpResponseMessage> PostHoldAsync(HttpClient client, string classId, string studentId) =>
        SendAsStudent(client, HttpMethod.Post, $"/classes/{classId}/holds", studentId);

    protected Task<HttpResponseMessage> PostHoldAsync(string classId, string studentId) =>
        PostHoldAsync(Client, classId, studentId);

    protected async Task<HoldDto> HoldSeatAsync(string classId, string studentId)
    {
        var response = await PostHoldAsync(classId, studentId);
        Assert.Equal(System.Net.HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<HoldDto>())!;
    }

    protected Task<HttpResponseMessage> ConfirmAsync(string holdId, string studentId) =>
        SendAsStudent(Client, HttpMethod.Post, $"/holds/{holdId}/confirm", studentId);

    protected Task<HttpResponseMessage> CancelAsync(string holdId, string studentId) =>
        SendAsStudent(Client, HttpMethod.Delete, $"/holds/{holdId}", studentId);

    protected static Task<HttpResponseMessage> SendAsStudent(
        HttpClient client, HttpMethod method, string url, string? studentId)
    {
        var request = new HttpRequestMessage(method, url);
        if (studentId is not null)
        {
            request.Headers.Add("X-Student-Id", studentId);
        }
        return client.SendAsync(request);
    }

    protected static async Task<string> ErrorCodeAsync(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<ErrorDto>())!.Error;
}
