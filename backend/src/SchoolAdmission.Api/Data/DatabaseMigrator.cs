using System.Net.Sockets;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace SchoolAdmission.Api.Data;

public static class DatabaseMigrator
{
    /// <summary>
    /// Applies EF Core migrations on startup. Retries for a while because under
    /// docker compose PostgreSQL may still be starting when the API boots.
    /// </summary>
    public static async Task MigrateDatabaseAsync(this IServiceProvider services, CancellationToken ct = default)
    {
        const int maxAttempts = 30;
        var logger = services.GetRequiredService<ILoggerFactory>().CreateLogger(typeof(DatabaseMigrator));

        for (var attempt = 1; ; attempt++)
        {
            try
            {
                await using var scope = services.CreateAsyncScope();
                var db = scope.ServiceProvider.GetRequiredService<AdmissionDbContext>();
                await db.Database.MigrateAsync(ct);
                logger.LogInformation("Database is up to date");
                return;
            }
            catch (Exception ex) when (attempt < maxAttempts && IsTransient(ex))
            {
                logger.LogWarning("Database not reachable yet (attempt {Attempt}/{Max}): {Message}",
                    attempt, maxAttempts, ex.Message);
                await Task.Delay(TimeSpan.FromSeconds(2), ct);
            }
        }
    }

    private static bool IsTransient(Exception ex) => ex switch
    {
        NpgsqlException { IsTransient: true } => true,
        NpgsqlException { InnerException: SocketException } => true,
        // 57P03: the database system is starting up
        PostgresException { SqlState: "57P03" } => true,
        _ => ex.InnerException is not null && IsTransient(ex.InnerException),
    };
}
