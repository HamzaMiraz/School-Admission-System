using Microsoft.Extensions.Options;

namespace SchoolAdmission.Api.Services;

/// <summary>
/// Periodically persists EXPIRED on timed-out holds. Seat counts and API responses never
/// depend on this running (they compare expires_at with the current time), so a seat is
/// free the moment its hold runs out; this only keeps the stored status tidy.
/// </summary>
public sealed class HoldExpiryWorker(
    IServiceScopeFactory scopeFactory,
    IOptions<AdmissionOptions> options,
    ILogger<HoldExpiryWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(options.Value.ExpirySweepInterval);
        do
        {
            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                var service = scope.ServiceProvider.GetRequiredService<AdmissionService>();
                var expired = await service.ExpireStaleHoldsAsync(stoppingToken);
                if (expired > 0)
                {
                    logger.LogInformation("Expired {Count} hold(s)", expired);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Hold expiry sweep failed; will retry");
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
