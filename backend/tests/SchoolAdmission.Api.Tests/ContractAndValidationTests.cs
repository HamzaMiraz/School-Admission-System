using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using SchoolAdmission.Api.Tests.Infrastructure;

namespace SchoolAdmission.Api.Tests;

public class ContractAndValidationTests : ApiTestBase
{
    [Fact]
    public async Task Responses_use_the_field_names_from_the_brief()
    {
        var created = await Client.PostAsJsonAsync("/classes", new { name = "Class 6 - Morning Shift", totalSeats = 120 });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var classJson = await JsonAsync(created);
        AssertHasFields(classJson, "id", "name", "totalSeats");
        Assert.Equal("Class 6 - Morning Shift", classJson.GetProperty("name").GetString());
        Assert.Equal(120, classJson.GetProperty("totalSeats").GetInt32());
        var classId = classJson.GetProperty("id").GetString()!;

        var list = await JsonAsync(await Client.GetAsync("/classes"));
        AssertHasFields(list[0], "id", "name", "totalSeats", "heldSeats", "confirmedSeats", "availableSeats");
        AssertHasFields(await JsonAsync(await Client.GetAsync($"/classes/{classId}")),
            "id", "name", "totalSeats", "heldSeats", "confirmedSeats", "availableSeats");

        var student = NewStudentId();
        var holdResponse = await PostHoldAsync(classId, student);
        Assert.Equal(HttpStatusCode.Created, holdResponse.StatusCode);
        var hold = await JsonAsync(holdResponse);
        AssertHasFields(hold, "holdId", "classId", "studentId", "status", "expiresAt");
        Assert.Equal(student, hold.GetProperty("studentId").GetString());
        Assert.EndsWith("Z", hold.GetProperty("expiresAt").GetString());
        var holdId = hold.GetProperty("holdId").GetString()!;

        AssertHasFields(await JsonAsync(await Client.GetAsync($"/holds/{holdId}")),
            "holdId", "classId", "status", "expiresAt");
        var mine = await JsonAsync(await SendAsStudent(Client, HttpMethod.Get, "/me/holds", student));
        AssertHasFields(mine[0], "holdId", "classId", "className", "status", "expiresAt");

        var confirmed = await JsonAsync(await ConfirmAsync(holdId, student));
        AssertHasFields(confirmed, "holdId", "status");
        Assert.Equal("CONFIRMED", confirmed.GetProperty("status").GetString());
    }

    [Theory]
    [InlineData("""{ "name": "", "totalSeats": 10 }""", "INVALID_CLASS_NAME")]
    [InlineData("""{ "name": "   ", "totalSeats": 10 }""", "INVALID_CLASS_NAME")]
    [InlineData("""{ "totalSeats": 10 }""", "INVALID_CLASS_NAME")]
    [InlineData("""{ "name": "Class 7", "totalSeats": 0 }""", "INVALID_TOTAL_SEATS")]
    [InlineData("""{ "name": "Class 7", "totalSeats": -5 }""", "INVALID_TOTAL_SEATS")]
    [InlineData("""{ "name": "Class 7" }""", "INVALID_TOTAL_SEATS")]
    [InlineData("""{ "name": "Class 7", "totalSeats": "many" }""", "INVALID_REQUEST")]
    [InlineData("""not json""", "INVALID_REQUEST")]
    public async Task Invalid_class_is_rejected_with_a_readable_error(string body, string expectedError)
    {
        var response = await Client.PostAsync("/classes", new StringContent(body, Encoding.UTF8, "application/json"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var error = (await response.Content.ReadFromJsonAsync<ErrorDto>())!;
        Assert.Equal(expectedError, error.Error);
        Assert.False(string.IsNullOrWhiteSpace(error.Message));
    }

    [Fact]
    public async Task Duplicate_class_name_is_rejected()
    {
        await CreateClassAsync(10, "Class 6 - Morning Shift");

        var response = await Client.PostAsJsonAsync("/classes", new { name = " class 6 - MORNING shift ", totalSeats = 5 });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("CLASS_ALREADY_EXISTS", await ErrorCodeAsync(response));
    }

    [Theory]
    [InlineData(null, "STUDENT_ID_REQUIRED")]
    [InlineData("", "STUDENT_ID_REQUIRED")]
    [InlineData("1234", "INVALID_STUDENT_ID")]
    [InlineData("2015269123456789X", "INVALID_STUDENT_ID")]
    [InlineData("201526912345678901", "INVALID_STUDENT_ID")]
    public async Task Student_id_must_be_a_17_digit_number(string? studentId, string expectedError)
    {
        var schoolClass = await CreateClassAsync(5);
        var hold = await HoldSeatAsync(schoolClass.Id, NewStudentId());

        var responses = new[]
        {
            await PostHoldAsync(schoolClass.Id, studentId!),
            await SendAsStudent(Client, HttpMethod.Post, $"/holds/{hold.HoldId}/confirm", studentId),
            await SendAsStudent(Client, HttpMethod.Delete, $"/holds/{hold.HoldId}", studentId),
            await SendAsStudent(Client, HttpMethod.Get, "/me/holds", studentId),
        };

        foreach (var response in responses)
        {
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal(expectedError, await ErrorCodeAsync(response));
        }
    }

    [Fact]
    public async Task Unknown_ids_return_404()
    {
        var student = NewStudentId();

        Assert.Equal("CLASS_NOT_FOUND", await ErrorCodeAsync(await Client.GetAsync("/classes/c_missing")));
        Assert.Equal("CLASS_NOT_FOUND", await ErrorCodeAsync(await PostHoldAsync("c_missing", student)));
        Assert.Equal("APPLICATION_NOT_FOUND", await ErrorCodeAsync(await Client.GetAsync("/holds/h_missing")));
        Assert.Equal("APPLICATION_NOT_FOUND", await ErrorCodeAsync(await ConfirmAsync("h_missing", student)));
        Assert.Equal("APPLICATION_NOT_FOUND", await ErrorCodeAsync(await CancelAsync("h_missing", student)));
    }

    private static async Task<JsonElement> JsonAsync(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

    private static void AssertHasFields(JsonElement json, params string[] names)
    {
        foreach (var name in names)
        {
            Assert.True(json.TryGetProperty(name, out _), $"Missing field '{name}' in {json}");
        }
    }
}
