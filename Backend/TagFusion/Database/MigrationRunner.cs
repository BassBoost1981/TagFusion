using System.Data.SQLite;
using System.IO;
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
    /// Represents a single database migration step. DataStep runs after Sql
    /// inside the same transaction — for backfills that need C# logic.
    /// Ein Migrationsschritt. DataStep läuft nach dem SQL in derselben Transaktion.
    /// </summary>
    internal record Migration(int Version, string Description, string Sql,
        Action<SQLiteConnection, SQLiteTransaction>? DataStep = null);

    /// <summary>
    /// List of all migrations in order. Add new migrations at the end.
    /// </summary>
    internal static readonly Migration[] Migrations =
    [
        new(1, "Baseline — marks current schema as v1 (no-op)", ""),
        new(2, "ThumbnailAccess table — LRU tracking that doesn't rely on NTFS LastAccessTime",
            @"CREATE TABLE IF NOT EXISTS ThumbnailAccess (
                CacheKey TEXT PRIMARY KEY,
                LastAccessTicks INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS IX_ThumbnailAccess_LastAccessTicks
                ON ThumbnailAccess(LastAccessTicks);"),
        new(3, "FileName column on Images — enables global filename search (C# step, idempotent)",
            "",
            AddFileNameColumnAndBackfill),
        new(4, "Persons/Faces tables and face-scan columns on Images — local face recognition",
            @"CREATE TABLE IF NOT EXISTS Persons (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                Name TEXT NOT NULL UNIQUE
            );
            CREATE TABLE IF NOT EXISTS Faces (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                ImageId INTEGER NOT NULL,
                X REAL NOT NULL, Y REAL NOT NULL, W REAL NOT NULL, H REAL NOT NULL,
                Embedding BLOB NOT NULL,
                PersonId INTEGER,
                SuggestedPersonId INTEGER,
                SuggestionScore REAL,
                RejectedPersonId INTEGER,
                Status TEXT NOT NULL DEFAULT 'unnamed',
                ScannedAt TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_faces_imageid ON Faces(ImageId);
            CREATE INDEX IF NOT EXISTS idx_faces_status ON Faces(Status);",
            AddFaceScanColumnsToImages)
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

                // Run optional C# data step inside the same transaction (e.g. backfills).
                migration.DataStep?.Invoke(_connection, transaction);

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

    /// <summary>
    /// Adds Images.FileName and backfills it from Path. Skips gracefully when the
    /// Images table is absent (bare test connections) or the column already exists
    /// (fresh databases created with the current base schema).
    /// Ergänzt Images.FileName und befüllt sie aus Path — idempotent und tolerant
    /// gegenüber fehlender Tabelle (nackte Test-Verbindungen) oder vorhandener Spalte.
    /// </summary>
    private static void AddFileNameColumnAndBackfill(SQLiteConnection connection, SQLiteTransaction transaction)
    {
        if (!TableExists(connection, transaction, "Images")) return;
        if (ColumnExists(connection, transaction, "Images", "FileName")) return;

        using (var alter = connection.CreateCommand())
        {
            alter.Transaction = transaction;
            alter.CommandText = "ALTER TABLE Images ADD COLUMN FileName TEXT NOT NULL DEFAULT ''";
            alter.ExecuteNonQuery();
        }

        var updates = new List<(long Id, string FileName)>();
        using (var select = connection.CreateCommand())
        {
            select.Transaction = transaction;
            select.CommandText = "SELECT Id, Path FROM Images";
            using var reader = select.ExecuteReader();
            while (reader.Read())
                updates.Add((reader.GetInt64(0), Path.GetFileName(reader.GetString(1))));
        }

        using var update = connection.CreateCommand();
        update.Transaction = transaction;
        update.CommandText = "UPDATE Images SET FileName = @FileName WHERE Id = @Id";
        var nameParam = update.Parameters.Add("@FileName", System.Data.DbType.String);
        var idParam = update.Parameters.Add("@Id", System.Data.DbType.Int64);
        foreach (var (id, fileName) in updates)
        {
            nameParam.Value = fileName;
            idParam.Value = id;
            update.ExecuteNonQuery();
        }
    }

    /// <summary>
    /// Adds the face-scan bookkeeping columns to Images. Skips gracefully when the
    /// Images table is absent (bare test connections) or the columns already exist.
    /// Ergänzt die Face-Scan-Spalten auf Images — tolerant gegenüber fehlender
    /// Tabelle (nackte Test-Verbindungen) und bereits vorhandenen Spalten.
    /// </summary>
    private static void AddFaceScanColumnsToImages(SQLiteConnection connection, SQLiteTransaction transaction)
    {
        if (!TableExists(connection, transaction, "Images")) return;
        AddColumnIfMissing(connection, transaction, "Images", "FaceScanAt", "TEXT");
        AddColumnIfMissing(connection, transaction, "Images", "FaceScanFileTime", "TEXT");
    }

    private static void AddColumnIfMissing(SQLiteConnection connection, SQLiteTransaction transaction, string table, string column, string type)
    {
        if (ColumnExists(connection, transaction, table, column)) return;
        using var alter = connection.CreateCommand();
        alter.Transaction = transaction;
        alter.CommandText = $"ALTER TABLE {table} ADD COLUMN {column} {type}";
        alter.ExecuteNonQuery();
    }

    private static bool TableExists(SQLiteConnection connection, SQLiteTransaction transaction, string name)
    {
        using var cmd = connection.CreateCommand();
        cmd.Transaction = transaction;
        cmd.CommandText = "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=@name";
        cmd.Parameters.AddWithValue("@name", name);
        return Convert.ToInt32(cmd.ExecuteScalar()) > 0;
    }

    private static bool ColumnExists(SQLiteConnection connection, SQLiteTransaction transaction, string table, string column)
    {
        using var cmd = connection.CreateCommand();
        cmd.Transaction = transaction;
        cmd.CommandText = $"PRAGMA table_info({table})";
        using var reader = cmd.ExecuteReader();
        while (reader.Read())
        {
            if (string.Equals(reader.GetString(1), column, StringComparison.OrdinalIgnoreCase))
                return true;
        }
        return false;
    }
}
