using Npgsql;

namespace SchoolAdmission.Api.Tests.Infrastructure;

/// <summary>
/// A throwaway PostgreSQL database for one test. The API's startup migrations create it;
/// disposing drops it. Server comes from TEST_DB_CONNECTION (defaults to a local postgres/postgres).
/// </summary>
public sealed class TestDatabase : IAsyncDisposable
{
    private const string DefaultServer = "Host=localhost;Port=5432;Username=postgres;Password=postgres";

    private readonly string _name = "school_admission_test_" + Guid.NewGuid().ToString("N")[..12];
    private readonly string _adminConnectionString;

    public TestDatabase()
    {
        var server = Environment.GetEnvironmentVariable("TEST_DB_CONNECTION") ?? DefaultServer;
        // Keep pools small: concurrency tests run two API instances against one server.
        ConnectionString = new NpgsqlConnectionStringBuilder(server) { Database = _name, MaxPoolSize = 40 }.ConnectionString;
        _adminConnectionString = new NpgsqlConnectionStringBuilder(server) { Database = "postgres", Pooling = false }.ConnectionString;
    }

    public string ConnectionString { get; }

    public async Task<long> ScalarAsync(string sql)
    {
        await using var connection = new NpgsqlConnection(ConnectionString);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand(sql, connection);
        return Convert.ToInt64(await command.ExecuteScalarAsync());
    }

    public async ValueTask DisposeAsync()
    {
        NpgsqlConnection.ClearAllPools();
        await using var connection = new NpgsqlConnection(_adminConnectionString);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand($"DROP DATABASE IF EXISTS \"{_name}\" WITH (FORCE)", connection);
        await command.ExecuteNonQueryAsync();
    }
}
