using System.Text.Json.Serialization;

namespace SchoolAdmission.Api.Api;

/// <summary>
/// An expected, user-facing failure. Rendered as
/// <c>{ "error": "CODE", "message": "...", "details": {...} }</c> with <see cref="StatusCode"/>.
/// </summary>
public sealed class ApiException(int statusCode, string code, string message, object? details = null)
    : Exception(message)
{
    public int StatusCode { get; } = statusCode;
    public string Code { get; } = code;
    public object? Details { get; } = details;

    public static ApiException BadRequest(string code, string message) =>
        new(StatusCodes.Status400BadRequest, code, message);

    public static ApiException Forbidden(string code, string message) =>
        new(StatusCodes.Status403Forbidden, code, message);

    public static ApiException NotFound(string code, string message) =>
        new(StatusCodes.Status404NotFound, code, message);

    public static ApiException Conflict(string code, string message, object? details = null) =>
        new(StatusCodes.Status409Conflict, code, message, details);
}

public sealed record ErrorResponse(
    string Error,
    string Message,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] object? Details = null);
