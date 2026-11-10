using Microsoft.AspNetCore.Diagnostics;
using Npgsql;

namespace SchoolAdmission.Api.Api;

/// <summary>Turns every exception into a JSON error body the UI can show to people.</summary>
public sealed class ApiExceptionHandler(ILogger<ApiExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken ct)
    {
        var (status, error) = exception switch
        {
            ApiException api => (api.StatusCode, new ErrorResponse(api.Code, api.Message, api.Details)),
            BadHttpRequestException bad => (bad.StatusCode, new ErrorResponse(
                "INVALID_REQUEST", "The request body is missing or is not valid JSON of the expected shape.")),
            NpgsqlException => (StatusCodes.Status503ServiceUnavailable, new ErrorResponse(
                "DATABASE_UNAVAILABLE", "The database is not reachable right now. Please try again shortly.")),
            _ => (StatusCodes.Status500InternalServerError, new ErrorResponse(
                "INTERNAL_ERROR", "Something went wrong on the server. Please try again.")),
        };

        if (status >= 500)
        {
            logger.LogError(exception, "Unhandled error for {Method} {Path}", context.Request.Method, context.Request.Path);
        }

        context.Response.StatusCode = status;
        await context.Response.WriteAsJsonAsync(error, ct);
        return true;
    }
}
