using System.Data.SQLite;
using Microsoft.Extensions.Logging.Abstractions;
using NUnit.Framework;
using TagFusion.Database;

namespace TagFusion.Tests.Database;

[TestFixture]
public class MigrationRunnerTests
{
    private SQLiteConnection _connection = null!;

    [SetUp]
    public void SetUp()
    {
        _connection = new SQLiteConnection("Data Source=:memory:;Version=3;");
        _connection.Open();
    }

    [TearDown]
    public void TearDown()
    {
        _connection?.Close();
        _connection?.Dispose();
    }

    [Test]
    public void ApplyMigrations_CreatesSchemaVersionTable()
    {
        var runner = new MigrationRunner(_connection, NullLogger.Instance);
        runner.ApplyMigrations();

        // SchemaVersion table should exist
        using var cmd = _connection.CreateCommand();
        cmd.CommandText = "SELECT name FROM sqlite_master WHERE type='table' AND name='SchemaVersion'";
        var result = cmd.ExecuteScalar();

        Assert.That(result, Is.EqualTo("SchemaVersion"));
    }

    [Test]
    public void ApplyMigrations_BaselineSetsVersionTo1()
    {
        var runner = new MigrationRunner(_connection, NullLogger.Instance);
        runner.ApplyMigrations();

        var version = runner.GetCurrentVersion();
        Assert.That(version, Is.EqualTo(1));
    }

    [Test]
    public void ApplyMigrations_Idempotent_RunsTwiceWithoutError()
    {
        var runner = new MigrationRunner(_connection, NullLogger.Instance);

        // Run migrations twice — second run should be a no-op
        runner.ApplyMigrations();
        runner.ApplyMigrations();

        var version = runner.GetCurrentVersion();
        Assert.That(version, Is.EqualTo(1));

        // Verify only one row in SchemaVersion
        using var cmd = _connection.CreateCommand();
        cmd.CommandText = "SELECT COUNT(*) FROM SchemaVersion";
        var count = Convert.ToInt32(cmd.ExecuteScalar());
        Assert.That(count, Is.EqualTo(1));
    }
}
