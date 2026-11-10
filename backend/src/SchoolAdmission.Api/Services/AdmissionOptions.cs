namespace SchoolAdmission.Api.Services;

public sealed class AdmissionOptions
{
    /// <summary>How long a seat stays held. Env: HOLD_DURATION_SECONDS (default 600).</summary>
    public int HoldDurationSeconds { get; set; } = 600;

    /// <summary>How often stale HELD rows are rewritten to EXPIRED. Env: EXPIRY_SWEEP_INTERVAL_SECONDS (default 5).</summary>
    public int ExpirySweepIntervalSeconds { get; set; } = 5;

    public TimeSpan HoldDuration => TimeSpan.FromSeconds(HoldDurationSeconds);
    public TimeSpan ExpirySweepInterval => TimeSpan.FromSeconds(ExpirySweepIntervalSeconds);

    public static void Bind(AdmissionOptions options, IConfiguration config)
    {
        options.HoldDurationSeconds = config.GetValue("HOLD_DURATION_SECONDS", options.HoldDurationSeconds);
        options.ExpirySweepIntervalSeconds =
            config.GetValue("EXPIRY_SWEEP_INTERVAL_SECONDS", options.ExpirySweepIntervalSeconds);
    }
}
