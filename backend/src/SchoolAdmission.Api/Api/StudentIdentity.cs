using System.Text.RegularExpressions;

namespace SchoolAdmission.Api.Api;

public static partial class StudentIdentity
{
    public const string HeaderName = "X-Student-Id";

    [GeneratedRegex(@"^\d{17}$")]
    private static partial Regex BirthRegistrationNumber();

    /// <summary>Validates the X-Student-Id header: a 17-digit birth registration number.</summary>
    public static string Require(string? headerValue)
    {
        if (string.IsNullOrWhiteSpace(headerValue))
        {
            throw ApiException.BadRequest("STUDENT_ID_REQUIRED",
                "Student birth registration number is missing (X-Student-Id header).");
        }

        var studentId = headerValue.Trim();
        if (!BirthRegistrationNumber().IsMatch(studentId))
        {
            throw ApiException.BadRequest("INVALID_STUDENT_ID",
                "Birth registration number must be exactly 17 digits.");
        }

        return studentId;
    }
}
