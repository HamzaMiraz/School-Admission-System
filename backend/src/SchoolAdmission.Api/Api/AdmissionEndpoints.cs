using Microsoft.AspNetCore.Mvc;
using SchoolAdmission.Api.Services;

namespace SchoolAdmission.Api.Api;

public static class AdmissionEndpoints
{
    public static IEndpointRouteBuilder MapAdmissionEndpoints(this IEndpointRouteBuilder app)
    {
        // 1. Create a class (one shift = one class)
        app.MapPost("/classes", async (CreateClassRequest? request, AdmissionService service, CancellationToken ct) =>
        {
            var created = await service.CreateClassAsync(request, ct);
            return Results.Created($"/classes/{created.Id}", created);
        });

        // 2. List classes with seat counts
        app.MapGet("/classes", (AdmissionService service, CancellationToken ct) => service.ListClassesAsync(ct));

        // 3. One class's seat counts
        app.MapGet("/classes/{classId}", (string classId, AdmissionService service, CancellationToken ct) =>
            service.GetClassAsync(classId, ct));

        // 4. Apply: hold a seat
        app.MapPost("/classes/{classId}/holds", async (
            string classId,
            [FromHeader(Name = StudentIdentity.HeaderName)] string? studentIdHeader,
            AdmissionService service,
            CancellationToken ct) =>
        {
            var studentId = StudentIdentity.Require(studentIdHeader);
            var hold = await service.CreateHoldAsync(classId, studentId, ct);
            return Results.Created($"/holds/{hold.HoldId}", hold);
        });

        // 5. Current state of an application
        app.MapGet("/holds/{holdId}", (string holdId, AdmissionService service, CancellationToken ct) =>
            service.GetHoldAsync(holdId, ct));

        // 6. Pay the fee: confirm admission
        app.MapPost("/holds/{holdId}/confirm", (
            string holdId,
            [FromHeader(Name = StudentIdentity.HeaderName)] string? studentIdHeader,
            AdmissionService service,
            CancellationToken ct) =>
            service.ConfirmHoldAsync(holdId, StudentIdentity.Require(studentIdHeader), ct));

        // 7. Cancel an application
        app.MapDelete("/holds/{holdId}", async (
            string holdId,
            [FromHeader(Name = StudentIdentity.HeaderName)] string? studentIdHeader,
            AdmissionService service,
            CancellationToken ct) =>
        {
            await service.CancelHoldAsync(holdId, StudentIdentity.Require(studentIdHeader), ct);
            return Results.NoContent();
        });

        // 8. All applications of the current student
        app.MapGet("/me/holds", (
            [FromHeader(Name = StudentIdentity.HeaderName)] string? studentIdHeader,
            AdmissionService service,
            CancellationToken ct) =>
            service.ListStudentHoldsAsync(StudentIdentity.Require(studentIdHeader), ct));

        // Extra (not in the brief): all applications for the admin panel, with optional filters.
        // e.g. /admin/holds?status=CONFIRMED&classId=c_123&studentId=2015
        app.MapGet("/admin/holds", (
            string? status,
            string? classId,
            string? studentId,
            AdmissionService service,
            CancellationToken ct) =>
            service.ListAllHoldsAsync(status, classId, studentId, ct));

        app.MapGet("/health",() => Results.Ok(new { status = "ok" }));

        return app;
    }
}
