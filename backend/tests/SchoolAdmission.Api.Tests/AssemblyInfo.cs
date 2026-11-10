// Tests share one PostgreSQL server; the concurrency tests open many connections at once.
// Running test classes one after another keeps us well below the server's max_connections.
[assembly: CollectionBehavior(DisableTestParallelization = true)]
