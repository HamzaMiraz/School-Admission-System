using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection.Extensions;
using SchoolAdmission.Api.Api;
using SchoolAdmission.Api.Data;
using SchoolAdmission.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// Connection string comes from configuration: env var ConnectionStrings__Default.
builder.Services.AddDbContext<AdmissionDbContext>((sp, options) =>
{
    var connectionString = sp.GetRequiredService<IConfiguration>().GetConnectionString("Default")
        ?? throw new InvalidOperationException(
            "Database connection string is missing. Set the ConnectionStrings__Default environment variable.");
    options.UseNpgsql(connectionString);
});

builder.Services.AddOptions<AdmissionOptions>()
    .Configure<IConfiguration>(AdmissionOptions.Bind)
    .Validate(o => o.HoldDurationSeconds > 0, "HOLD_DURATION_SECONDS must be a positive number of seconds.")
    .Validate(o => o.ExpirySweepIntervalSeconds > 0, "EXPIRY_SWEEP_INTERVAL_SECONDS must be positive.")
    .ValidateOnStart();

builder.Services.TryAddSingleton(TimeProvider.System);
builder.Services.AddScoped<AdmissionService>();
builder.Services.AddHostedService<HoldExpiryWorker>();

// Every error, including malformed JSON bodies, is returned as { error, message }.
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ApiExceptionHandler>();
builder.Services.Configure<RouteHandlerOptions>(o => o.ThrowOnBadRequest = true);
builder.Services.ConfigureHttpJsonOptions(o => o.SerializerOptions.Converters.Add(new UtcDateTimeOffsetConverter()));

// The React app is served from another origin (e.g. http://localhost:3000).
// CORS_ALLOWED_ORIGINS: comma-separated list, or "*" (default) for any origin.
var allowedOrigins = (builder.Configuration["CORS_ALLOWED_ORIGINS"] ?? "*")
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
builder.Services.AddCors(o => o.AddDefaultPolicy(policy =>
{
    if (allowedOrigins.Contains("*"))
    {
        policy.AllowAnyOrigin();
    }
    else
    {
        policy.WithOrigins(allowedOrigins);
    }
    policy.AllowAnyHeader().AllowAnyMethod().WithExposedHeaders("Location");
}));

var app = builder.Build();

app.UseExceptionHandler();
app.UseStatusCodePages(async ctx =>
{
    var response = ctx.HttpContext.Response;
    var error = response.StatusCode switch
    {
        StatusCodes.Status404NotFound => new ErrorResponse("NOT_FOUND", "This address does not exist on the server."),
        StatusCodes.Status405MethodNotAllowed => new ErrorResponse("METHOD_NOT_ALLOWED", "This action is not supported here."),
        _ => new ErrorResponse("HTTP_" + response.StatusCode, "The request could not be completed."),
    };
    await response.WriteAsJsonAsync(error);
});
app.UseCors();

app.MapAdmissionEndpoints();

await app.Services.MigrateDatabaseAsync();

app.Run();

public partial class Program;
