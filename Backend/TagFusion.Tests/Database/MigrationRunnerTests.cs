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
    public void ApplyMigrations_AdvancesVersionToLatest()
    {
        var runner = new MigrationRunner(_connection, NullLogger.Instance);
        runner.ApplyMigrations();

        var version = runner.GetCurrentVersion();
        Assert.That(version, Is.EqualTo(MigrationRunner.Migrations.Length));
    }

    [Test]
    public void ApplyMigrations_Idempotent_RunsTwiceWithoutError()
    {
        var runner = new MigrationRunner(_connection, NullLogger.Instance);

        // Run migrations twice — second run should be a no-op
        runner.ApplyMigrations();
        runner.ApplyMigrations();

        var expectedVersion = MigrationRunner.Migrations.Length;
        var version = runner.GetCurrentVersion();
        Assert.That(version, Is.EqualTo(expectedVersion));

        // Verify exactly one row per migration in SchemaVersion (no duplicates from re-run)
        using var cmd = _connection.CreateCommand();
        cmd.CommandText = "SELECT COUNT(*) FROM SchemaVersion";
        var count = Convert.ToInt32(cmd.ExecuteScalar());
        Assert.That(count, Is.EqualTo(expectedVersion));
    }

    [Test]
    public void MigrationV3_OldSchema_AddsAndBackfillsFileName()
    {
        // Simulate a pre-v3 database: Images table without FileName, with existing rows.
        // Simuliert eine Alt-DB: Images-Tabelle ohne FileName-Spalte, mit Bestandsdaten.
        using (var cmd = _connection.CreateCommand())
        {
            cmd.CommandText = @"
                CREATE TABLE Images (
                    Id INTEGER PRIMARY KEY AUTOINCREMENT,
                    Path TEXT NOT NULL UNIQUE,
                    LastModified TEXT NOT NULL,
                    Rating INTEGER DEFAULT 0,
                    Width INTEGER DEFAULT 0,
                    Height INTEGER DEFAULT 0,
                    DateTaken TEXT
                );
                INSERT INTO Images (Path, LastModified) VALUES ('C:\Fotos\Käfer Übung.jpg', '2026-01-01T00:00:00.0000000Z');
                INSERT INTO Images (Path, LastModified) VALUES ('D:\a\b\IMG_0001.JPG', '2026-01-01T00:00:00.0000000Z');";
            cmd.ExecuteNonQuery();
        }

        new MigrationRunner(_connection, NullLogger.Instance).ApplyMigrations();

        using var check = _connection.CreateCommand();
        check.CommandText = "SELECT FileName FROM Images ORDER BY Id";
        using var reader = check.ExecuteReader();
        var fileNames = new List<string>();
        while (reader.Read()) fileNames.Add(reader.GetString(0));

        Assert.That(fileNames, Is.EqualTo(new[] { "Käfer Übung.jpg", "IMG_0001.JPG" }));
    }

    [Test]
    public void MigrationV3_ColumnAlreadyExists_IsNoOp()
    {
        // Fresh databases get FileName via InitializeDatabase — migration must not fail.
        // Frische DBs haben FileName schon — die Migration darf dann nicht fehlschlagen.
        using (var cmd = _connection.CreateCommand())
        {
            cmd.CommandText = @"
                CREATE TABLE Images (
                    Id INTEGER PRIMARY KEY AUTOINCREMENT,
                    Path TEXT NOT NULL UNIQUE,
                    FileName TEXT NOT NULL DEFAULT '',
                    LastModified TEXT NOT NULL
                );
                INSERT INTO Images (Path, FileName, LastModified) VALUES ('C:\x.jpg', 'x.jpg', '2026-01-01T00:00:00.0000000Z');";
            cmd.ExecuteNonQuery();
        }

        var runner = new MigrationRunner(_connection, NullLogger.Instance);
        Assert.DoesNotThrow(() => runner.ApplyMigrations());

        using var check = _connection.CreateCommand();
        check.CommandText = "SELECT FileName FROM Images";
        Assert.That(check.ExecuteScalar(), Is.EqualTo("x.jpg"));
    }

    [Test]
    public void MigrationV4_CreatesPersonsAndFacesTables()
    {
        new MigrationRunner(_connection, NullLogger.Instance).ApplyMigrations();

        using var cmd = _connection.CreateCommand();
        cmd.CommandText = "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('Persons','Faces')";
        Assert.That(Convert.ToInt32(cmd.ExecuteScalar()), Is.EqualTo(2));
    }

    [Test]
    public void MigrationV4_AddsFaceScanColumnsWhenImagesTableExists()
    {
        // Simulate an existing Images table (post-v3 shape, FileName included).
        // Simuliert eine bestehende Images-Tabelle (Stand nach v3, mit FileName).
        using (var cmd = _connection.CreateCommand())
        {
            cmd.CommandText = @"
                CREATE TABLE Images (
                    Id INTEGER PRIMARY KEY AUTOINCREMENT,
                    Path TEXT NOT NULL UNIQUE,
                    FileName TEXT NOT NULL DEFAULT '',
                    LastModified TEXT NOT NULL
                );";
            cmd.ExecuteNonQuery();
        }

        new MigrationRunner(_connection, NullLogger.Instance).ApplyMigrations();

        using var check = _connection.CreateCommand();
        check.CommandText = "SELECT COUNT(*) FROM pragma_table_info('Images') WHERE name IN ('FaceScanAt','FaceScanFileTime')";
        Assert.That(Convert.ToInt32(check.ExecuteScalar()), Is.EqualTo(2));
    }
}
