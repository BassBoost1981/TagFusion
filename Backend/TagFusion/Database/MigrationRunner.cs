using System.Data.SQLite;
using Microsoft.Extensions.Logging;

namespace TagFusion.Database;

/// <summary>
/// Simple sequential database migration runner.
/// Tracks applied migrations in a SchemaVersion table.
/// Einfacher sequenzieller Datenbank-Migrationsrunner.
/// </summary>
public class MigrationRunner
{
    private readonly SQLiteConnection _connection;
    private readonly ILogger _logger;

    /// <summary>
    /// Represents a single database migration step.
    /// </summary>
    internal record Migration(int Version, string Description, string Sql);

    /// <summary>
    /// List of all migrations in order. Add new migrations at the end.
    /// </summary>
    internal static readonly Migration[] Migrations =
    [
        new(1, "Baseline — marks current schema as v1 (no-op)", "")
    ];

    public MigrationRunner(SQLiteConnection connection, ILogger logger)
    {
        _connection = connection;
        _logger = logger;
    }

    /// <summary>
    /// Ensures the SchemaVersion table exists, then applies any pending migrations.
    /// Stellt sicher, dass die SchemaVersion-Tabelle existiert und wendet ausstehende Migrationen an.
    /// </summary>
    public void ApplyMigrations()
    {
        EnsureSchemaVersionTable();

        var currentVersion = GetCurrentVersion();
        _logger.LogInformation("Database schema version: {CurrentVersion}, available: {AvailableVersion}",
            currentVersion, Migrations.Length);

        foreach (var migration in Migrations)
        {
            if (migration.Version <= currentVersion)
                continue;

            _logger.LogInformation("Applying migration v{Version}: {Description}", migration.Version, migration.Description);

            using var transaction = _connection.BeginTransaction();
            try
            {
                // Execute migration SQL (skip for no-op baseline)
                if (!string.IsNullOrWhiteSpace(migration.Sql))
                {
                    using var cmd = _connection.CreateCommand();
                    cmd.Transaction = transaction;
                    cmd.CommandText = migration.Sql;
                    cmd.ExecuteNonQuery();
                }

                // Record the applied migration
                using var versionCmd = _connection.CreateCommand();
                versionCmd.Transaction = transaction;
                versionCmd.CommandText = "INSERT INTO SchemaVersion (Version, Description, AppliedAt) VALUES (@Version, @Description, @AppliedAt)";
                versionCmd.Parameters.AddWithValue("@Version", migration.Version);
                versionCmd.Parameters.AddWithValue("@Description", migration.Description);
                versionCmd.Parameters.AddWithValue("@AppliedAt", DateTime.UtcNow.ToString("o"));
                versionCmd.ExecuteNonQuery();

                transaction.Commit();
                _logger.LogInformation("Migration v{Version} applied successfully", migration.Version);
            }
            catch
            {
                transaction.Rollback();
                _logger.LogError("Migration v{Version} failed — rolled back", migration.Version);
                throw;
            }
        }
    }

    private void EnsureSchemaVersionTable()
    {
        using var cmd = _connection.CreateCommand();
        cmd.CommandText = @"
            CREATE TABLE IF NOT EXISTS SchemaVersion (
                Version INTEGER PRIMARY KEY,
                Description TEXT NOT NULL,
                AppliedAt TEXT NOT NULL
            )";
        cmd.ExecuteNonQuery();
    }

    internal int GetCurrentVersion()
    {
        using var cmd = _connection.CreateCommand();
        cmd.CommandText = "SELECT MAX(Version) FROM SchemaVersion";
        var result = cmd.ExecuteScalar();
        return result is DBNull || result == null ? 0 : Convert.ToInt32(result);
    }
}
