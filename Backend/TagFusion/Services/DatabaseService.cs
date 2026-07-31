using System.Data.SQLite;
using System.Globalization;
using System.IO;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using TagFusion.Configuration;
using TagFusion.Database;
using TagFusion.Models;

namespace TagFusion.Services;

public class DatabaseService : IDatabaseService, IDisposable
{
    private readonly SQLiteConnection _connection;
    private readonly SQLiteConnection _readConnection;
    private readonly SemaphoreSlim _writeSemaphore = new(1, 1);
    // One command at a time on the shared read connection — a SQLiteConnection
    // instance is not safe for concurrent use from multiple threads. WAL-parallel
    // reads would need one connection per reader, not more permits here.
    // Nur ein Kommando zugleich auf der geteilten Lese-Verbindung — eine
    // SQLiteConnection ist nicht für parallelen Zugriff aus mehreren Threads
    // ausgelegt. Parallele WAL-Reads bräuchten eigene Verbindungen pro Leser.
    private readonly SemaphoreSlim _readSemaphore = new(1, 1);
    private readonly ILogger<DatabaseService> _logger;
    private readonly int _chunkSize;
    private bool _disposed;

    public DatabaseService(ILogger<DatabaseService> logger, IOptions<DatabaseSettings> options)
    {
        _logger = logger;
        var settings = options.Value;
        _chunkSize = settings.ChunkSize;
        var appDir = AppContext.BaseDirectory ?? string.Empty;
        var dbPath = Path.Combine(appDir, settings.DbFileName);
        var connectionString = $"Data Source={dbPath};Version=3;";

        _connection = new SQLiteConnection(connectionString);
        _connection.Open();

        // === PERF: Batch all PRAGMAs in one command for faster init ===
        // WAL mode + performance tuning — reduces startup I/O significantly
        using (var pragmaCmd = _connection.CreateCommand())
        {
            pragmaCmd.CommandText = @"
                PRAGMA journal_mode = WAL;
                PRAGMA synchronous = NORMAL;
                PRAGMA temp_store = MEMORY;
                PRAGMA mmap_size = 268435456;
                PRAGMA cache_size = -8000;";
            pragmaCmd.ExecuteNonQuery();
        }

        // Separate read connection for concurrent reads (WAL supports this)
        _readConnection = new SQLiteConnection(connectionString);
        _readConnection.Open();
        using (var readPragma = _readConnection.CreateCommand())
        {
            readPragma.CommandText = @"
                PRAGMA journal_mode = WAL;
                PRAGMA synchronous = NORMAL;
                PRAGMA temp_store = MEMORY;
                PRAGMA mmap_size = 268435456;
                PRAGMA cache_size = -8000;";
            readPragma.ExecuteNonQuery();
        }

        InitializeDatabase();
        new MigrationRunner(_connection, _logger).ApplyMigrations();
        _logger.LogInformation("Database initialized at {DbPath}", dbPath);
    }

    /// <summary>
    /// Internal constructor for testing — accepts custom connection string (e.g. in-memory DB).
    /// </summary>
    /// <summary>
    /// Internal constructor for testing — accepts custom connection string (e.g. in-memory DB).
    /// Interner Konstruktor für Tests — akzeptiert benutzerdefinierten Connection String.
    /// </summary>
    internal DatabaseService(string connectionString)
    {
        _logger = Microsoft.Extensions.Logging.Abstractions.NullLogger<DatabaseService>.Instance;
        _chunkSize = 500;
        _connection = new SQLiteConnection(connectionString);
        _connection.Open();

        // For in-memory DBs (:memory:), a second connection creates a separate DB.
        // Use shared cache URI so both connections access the same in-memory DB.
        if (connectionString.Contains(":memory:", StringComparison.OrdinalIgnoreCase))
        {
            _readConnection = _connection; // Share connection for in-memory testing
            _readSemaphore = _writeSemaphore; // Serialize to avoid concurrent access on same connection
        }
        else
        {
            _readConnection = new SQLiteConnection(connectionString);
            _readConnection.Open();
        }

        InitializeDatabase();
        new MigrationRunner(_connection, _logger).ApplyMigrations();
    }

    private void InitializeDatabase()
    {
        using var command = _connection.CreateCommand();
        command.CommandText = @"
            CREATE TABLE IF NOT EXISTS Images (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                Path TEXT NOT NULL UNIQUE,
                FileName TEXT NOT NULL DEFAULT '',
                -- Persisted lowercase twins — the search LIKEs run against these because
                -- SQLite's built-in lower()/LIKE is ASCII-only case-insensitive (Ä→ä needs C#).
                -- Persistierte Kleinschreib-Spalten — die Such-LIKEs laufen dagegen, weil
                -- SQLites lower()/LIKE keine Umlaute case-insensitiv vergleichen kann.
                FileNameLower TEXT NOT NULL DEFAULT '',
                DescriptionLower TEXT,
                LastModified TEXT NOT NULL,
                Rating INTEGER DEFAULT 0,
                Width INTEGER DEFAULT 0,
                Height INTEGER DEFAULT 0,
                DateTaken TEXT
            );

            CREATE TABLE IF NOT EXISTS Tags (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                Name TEXT NOT NULL UNIQUE,
                NameLower TEXT NOT NULL DEFAULT ''
            );

            CREATE TABLE IF NOT EXISTS ImageTags (
                ImageId INTEGER NOT NULL,
                TagId INTEGER NOT NULL,
                PRIMARY KEY (ImageId, TagId),
                FOREIGN KEY (ImageId) REFERENCES Images(Id) ON DELETE CASCADE,
                FOREIGN KEY (TagId) REFERENCES Tags(Id) ON DELETE CASCADE
            );

            -- No index on Images(Path): the UNIQUE constraint already creates one.
            -- Kein Index auf Images(Path) — UNIQUE erzeugt bereits einen.
            CREATE INDEX IF NOT EXISTS idx_tags_name ON Tags(Name);
        ";
        command.ExecuteNonQuery();
    }

    /// <summary>
    /// Parse a timestamp stored via DateTime.ToString("o"), preserving both the value and
    /// the DateTimeKind. Bare DateTime.Parse uses the current culture and converts "...Z"
    /// values to local time, silently shifting stored timestamps.
    /// Liest einen mit ToString("o") gespeicherten Zeitstempel zurück — kultur-invariant
    /// und unter Beibehaltung von Wert und DateTimeKind.
    /// </summary>
    internal static DateTime ParseStoredDateTime(string value)
        => DateTime.Parse(value, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind);

    public async Task<ImageFile?> GetImageAsync(string path, CancellationToken cancellationToken = default)
    {
        await _readSemaphore.WaitAsync(cancellationToken);
        try
        {
            using var command = _readConnection.CreateCommand();
            command.CommandText = "SELECT * FROM Images WHERE Path = @Path";
            command.Parameters.AddWithValue("@Path", path);

            using var reader = await command.ExecuteReaderAsync(cancellationToken);
            if (await reader.ReadAsync(cancellationToken))
            {
                var image = new ImageFile
                {
                    Path = reader.GetString(reader.GetOrdinal("Path")),
                    Rating = reader.GetInt32(reader.GetOrdinal("Rating")),
                    Width = reader.GetInt32(reader.GetOrdinal("Width")),
                    Height = reader.GetInt32(reader.GetOrdinal("Height")),
                    DateModified = ParseStoredDateTime(reader.GetString(reader.GetOrdinal("LastModified")))
                };

                if (!reader.IsDBNull(reader.GetOrdinal("DateTaken")))
                {
                    image.DateTaken = ParseStoredDateTime(reader.GetString(reader.GetOrdinal("DateTaken")));
                }

                var imageId = reader.GetInt64(reader.GetOrdinal("Id"));
                reader.Close(); // Close reader before next command on same connection
                image.Tags = await GetTagsInternalAsync(imageId, _readConnection, cancellationToken);

                return image;
            }

            return null;
        }
        finally
        {
            _readSemaphore.Release();
        }
    }

    private async Task<List<string>> GetTagsInternalAsync(long imageId, SQLiteConnection connection, CancellationToken cancellationToken = default)
    {
        var tags = new List<string>();
        using var command = connection.CreateCommand();
        command.CommandText = @"
            SELECT t.Name
            FROM Tags t
            JOIN ImageTags it ON t.Id = it.TagId
            WHERE it.ImageId = @ImageId";
        command.Parameters.AddWithValue("@ImageId", imageId);

        using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            tags.Add(reader.GetString(0));
        }
        return tags;
    }

    /// <summary>
    /// Load the tags of many images in one query per chunk (avoids N+1 on search results).
    /// Lädt die Tags vieler Bilder gebündelt pro Chunk (vermeidet N+1 bei Suchtreffern).
    /// </summary>
    private async Task<Dictionary<long, List<string>>> GetTagsForImagesAsync(List<long> imageIds, SQLiteConnection connection, CancellationToken cancellationToken = default)
    {
        var result = new Dictionary<long, List<string>>();
        if (imageIds.Count == 0) return result;

        for (int i = 0; i < imageIds.Count; i += _chunkSize)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var chunk = imageIds.Skip(i).Take(_chunkSize).ToList();
            var placeholders = string.Join(",", chunk.Select((_, idx) => $"@p{idx}"));

            using var command = connection.CreateCommand();
            command.CommandText = $@"
                SELECT it.ImageId, t.Name
                FROM ImageTags it
                JOIN Tags t ON t.Id = it.TagId
                WHERE it.ImageId IN ({placeholders})";
            for (int j = 0; j < chunk.Count; j++)
            {
                command.Parameters.AddWithValue($"@p{j}", chunk[j]);
            }

            using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                var imageId = reader.GetInt64(0);
                if (!result.TryGetValue(imageId, out var tags))
                    result[imageId] = tags = new List<string>();
                tags.Add(reader.GetString(1));
            }
        }
        return result;
    }

    public async Task SaveImageAsync(ImageFile image, CancellationToken cancellationToken = default)
    {
        await _writeSemaphore.WaitAsync(cancellationToken);
        try
        {
            await SaveImageInternalAsync(image, cancellationToken);
        }
        finally
        {
            _writeSemaphore.Release();
        }
    }

    private async Task SaveImageInternalAsync(ImageFile image, CancellationToken cancellationToken = default)
    {
        using var transaction = _connection.BeginTransaction();
        try
        {
            await SaveImageInternalNoTxAsync(image, cancellationToken);
            transaction.Commit();
        }
        catch
        {
            transaction.Rollback();
            throw;
        }
    }

    /// <summary>
    /// Persist a single image without opening its own transaction.
    /// Caller is responsible for the enclosing transaction (used by batch save).
    /// </summary>
    private async Task SaveImageInternalNoTxAsync(ImageFile image, CancellationToken cancellationToken = default)
    {
        var fileName = string.IsNullOrEmpty(image.FileName) ? Path.GetFileName(image.Path) : image.FileName;

        using (var cmd = _connection.CreateCommand())
        {
            cmd.CommandText = @"
                INSERT INTO Images (Path, FileName, FileNameLower, LastModified, Rating, Width, Height, DateTaken)
                VALUES (@Path, @FileName, @FileNameLower, @LastModified, @Rating, @Width, @Height, @DateTaken)
                ON CONFLICT(Path) DO UPDATE SET
                    FileName = @FileName,
                    FileNameLower = @FileNameLower,
                    LastModified = @LastModified,
                    Rating = @Rating,
                    Width = @Width,
                    Height = @Height,
                    DateTaken = @DateTaken,
                    -- This upsert only runs after OUR OWN metadata writes (tags/rating), which
                    -- bump the file mtime without touching pixels — keep the face scan valid.
                    -- Pixel edits (rotate/flip) never route through here, so real changes
                    -- still trigger a rescan.
                    -- Läuft nur nach EIGENEN Metadaten-Schreibvorgängen (mtime ändert sich,
                    -- Pixel nicht) — der Gesichts-Scan bleibt gültig. Pixel-Änderungen
                    -- (Drehen/Spiegeln) laufen nie über diesen Pfad.
                    FaceScanFileTime = CASE WHEN Images.FaceScanAt IS NOT NULL
                                            THEN @FaceScanTime
                                            ELSE Images.FaceScanFileTime END
                RETURNING Id;
            ";
            cmd.Parameters.AddWithValue("@Path", image.Path);
            cmd.Parameters.AddWithValue("@FileName", fileName);
            cmd.Parameters.AddWithValue("@FileNameLower", fileName.ToLowerInvariant());
            cmd.Parameters.AddWithValue("@LastModified", image.DateModified.ToString("o"));
            // Always normalized UTC — the scan writer stores UTC ("Z") and DateModified
            // usually comes from FileInfo.LastWriteTime, which is LOCAL kind.
            // Immer normalisiertes UTC — der Scan speichert UTC ("Z"), DateModified
            // kommt aus FileInfo.LastWriteTime und ist LOKAL.
            cmd.Parameters.AddWithValue("@FaceScanTime", image.DateModified.ToUniversalTime().ToString("o"));
            cmd.Parameters.AddWithValue("@Rating", image.Rating);
            cmd.Parameters.AddWithValue("@Width", image.Width);
            cmd.Parameters.AddWithValue("@Height", image.Height);
            cmd.Parameters.AddWithValue("@DateTaken", image.DateTaken?.ToString("o") ?? (object)DBNull.Value);

            var result = await cmd.ExecuteScalarAsync(cancellationToken);
            var imageId = result != null ? (long)result : 0;

            if (imageId == 0) throw new Exception("Failed to insert/update image");

            using (var deleteCmd = _connection.CreateCommand())
            {
                deleteCmd.CommandText = "DELETE FROM ImageTags WHERE ImageId = @ImageId";
                deleteCmd.Parameters.AddWithValue("@ImageId", imageId);
                await deleteCmd.ExecuteNonQueryAsync(cancellationToken);
            }

            var uniqueTags = TagHelper.DeduplicateTags(image.Tags);

            foreach (var tag in uniqueTags)
            {
                cancellationToken.ThrowIfCancellationRequested();

                long tagId;
                using (var tagCmd = _connection.CreateCommand())
                {
                    tagCmd.CommandText = "INSERT OR IGNORE INTO Tags (Name, NameLower) VALUES (@Name, @NameLower); SELECT Id FROM Tags WHERE Name = @Name;";
                    tagCmd.Parameters.AddWithValue("@Name", tag);
                    tagCmd.Parameters.AddWithValue("@NameLower", tag.ToLowerInvariant());
                    var tagResult = await tagCmd.ExecuteScalarAsync(cancellationToken);
                    tagId = tagResult != null ? (long)tagResult : 0;
                }

                if (tagId == 0) continue;

                using (var linkCmd = _connection.CreateCommand())
                {
                    linkCmd.CommandText = "INSERT OR IGNORE INTO ImageTags (ImageId, TagId) VALUES (@ImageId, @TagId)";
                    linkCmd.Parameters.AddWithValue("@ImageId", imageId);
                    linkCmd.Parameters.AddWithValue("@TagId", tagId);
                    await linkCmd.ExecuteNonQueryAsync(cancellationToken);
                }
            }
        }
    }

    public async Task<Dictionary<string, ImageMetadata>> GetMetadataForPathsAsync(List<string> paths, CancellationToken cancellationToken = default)
    {
        var result = new Dictionary<string, ImageMetadata>();
        if (paths.Count == 0) return result;

        await _readSemaphore.WaitAsync(cancellationToken);
        try
        {
            // Process in chunks to avoid parameter limits
            var chunkSize = _chunkSize;
            for (int i = 0; i < paths.Count; i += chunkSize)
            {
                cancellationToken.ThrowIfCancellationRequested();

                var chunk = paths.Skip(i).Take(chunkSize).ToList();
                var placeholders = string.Join(",", chunk.Select((_, idx) => $"@p{idx}"));

                using var command = _readConnection.CreateCommand();
                command.CommandText = $@"
                    SELECT i.Path, i.Rating, GROUP_CONCAT(t.Name, '||') as TagList,
                           i.LastModified, i.Width, i.Height, i.DateTaken,
                           (i.FaceScanAt IS NOT NULL) as FaceScanned,
                           (i.Description IS NOT NULL AND i.Description != '') as HasDescription
                    FROM Images i
                    LEFT JOIN ImageTags it ON i.Id = it.ImageId
                    LEFT JOIN Tags t ON it.TagId = t.Id
                    WHERE i.Path IN ({placeholders})
                    GROUP BY i.Id, i.Path, i.Rating, i.LastModified, i.Width, i.Height, i.DateTaken,
                             i.FaceScanAt, i.Description";

                for (int j = 0; j < chunk.Count; j++)
                {
                    command.Parameters.AddWithValue($"@p{j}", chunk[j]);
                }

                using var reader = await command.ExecuteReaderAsync(cancellationToken);
                while (await reader.ReadAsync(cancellationToken))
                {
                    var path = reader.GetString(0);
                    var rating = reader.GetInt32(1);
                    var tagList = reader.IsDBNull(2) ? null : reader.GetString(2);
                    var lastModified = ParseStoredDateTime(reader.GetString(3));
                    var width = reader.GetInt32(4);
                    var height = reader.GetInt32(5);
                    var dateTaken = reader.IsDBNull(6) ? (DateTime?)null : ParseStoredDateTime(reader.GetString(6));
                    // SQLite returns boolean expressions as 0/1 integers.
                    // SQLite liefert boolesche Ausdrücke als 0/1-Integer.
                    var faceScanned = reader.GetInt64(7) != 0;
                    var hasDescription = reader.GetInt64(8) != 0;

                    var tags = tagList?.Split("||", StringSplitOptions.RemoveEmptyEntries)?.ToList()
                        ?? new List<string>();

                    result[path] = new ImageMetadata(tags, rating, lastModified, width, height, dateTaken, faceScanned, hasDescription);
                }
            }

            return result;
        }
        finally
        {
            _readSemaphore.Release();
        }
    }

    public async Task TouchThumbnailAccessAsync(string cacheKey, CancellationToken cancellationToken = default)
    {
        await _writeSemaphore.WaitAsync(cancellationToken);
        try
        {
            using var cmd = _connection.CreateCommand();
            cmd.CommandText = @"
                INSERT INTO ThumbnailAccess (CacheKey, LastAccessTicks) VALUES (@k, @t)
                ON CONFLICT(CacheKey) DO UPDATE SET LastAccessTicks = excluded.LastAccessTicks;";
            cmd.Parameters.AddWithValue("@k", cacheKey);
            cmd.Parameters.AddWithValue("@t", DateTime.UtcNow.Ticks);
            await cmd.ExecuteNonQueryAsync(cancellationToken);
        }
        finally { _writeSemaphore.Release(); }
    }

    public async Task<List<string>> GetOldestThumbnailKeysAsync(int limit, CancellationToken cancellationToken = default)
    {
        var keys = new List<string>();
        await _readSemaphore.WaitAsync(cancellationToken);
        try
        {
            using var cmd = _readConnection.CreateCommand();
            cmd.CommandText = "SELECT CacheKey FROM ThumbnailAccess ORDER BY LastAccessTicks ASC LIMIT @lim;";
            cmd.Parameters.AddWithValue("@lim", limit);
            using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
                keys.Add(reader.GetString(0));
        }
        finally { _readSemaphore.Release(); }
        return keys;
    }

    public async Task ForgetThumbnailAccessAsync(IEnumerable<string> cacheKeys, CancellationToken cancellationToken = default)
    {
        var list = cacheKeys.ToList();
        if (list.Count == 0) return;

        await _writeSemaphore.WaitAsync(cancellationToken);
        try
        {
            using var transaction = _connection.BeginTransaction();
            try
            {
                using var cmd = _connection.CreateCommand();
                cmd.Transaction = transaction;
                cmd.CommandText = "DELETE FROM ThumbnailAccess WHERE CacheKey = @k;";
                var p = cmd.Parameters.Add("@k", System.Data.DbType.String);
                foreach (var key in list)
                {
                    cancellationToken.ThrowIfCancellationRequested();
                    p.Value = key;
                    await cmd.ExecuteNonQueryAsync(cancellationToken);
                }
                transaction.Commit();
            }
            catch
            {
                transaction.Rollback();
                throw;
            }
        }
        finally { _writeSemaphore.Release(); }
    }

    public async Task DeleteImagesAsync(List<string> paths, CancellationToken cancellationToken = default)
    {
        if (paths.Count == 0) return;

        await _writeSemaphore.WaitAsync(cancellationToken);
        try
        {
            using var transaction = _connection.BeginTransaction();
            try
            {
                using var faceCmd = _connection.CreateCommand();
                faceCmd.Transaction = transaction;
                faceCmd.CommandText = "DELETE FROM Faces WHERE ImageId IN (SELECT Id FROM Images WHERE Path = @Path)";
                var faceParam = faceCmd.Parameters.Add("@Path", System.Data.DbType.String);

                using var linkCmd = _connection.CreateCommand();
                linkCmd.Transaction = transaction;
                linkCmd.CommandText = "DELETE FROM ImageTags WHERE ImageId IN (SELECT Id FROM Images WHERE Path = @Path)";
                var linkParam = linkCmd.Parameters.Add("@Path", System.Data.DbType.String);

                using var imgCmd = _connection.CreateCommand();
                imgCmd.Transaction = transaction;
                imgCmd.CommandText = "DELETE FROM Images WHERE Path = @Path";
                var imgParam = imgCmd.Parameters.Add("@Path", System.Data.DbType.String);

                foreach (var path in paths)
                {
                    cancellationToken.ThrowIfCancellationRequested();
                    faceParam.Value = path;
                    await faceCmd.ExecuteNonQueryAsync(cancellationToken);
                    linkParam.Value = path;
                    await linkCmd.ExecuteNonQueryAsync(cancellationToken);
                    imgParam.Value = path;
                    await imgCmd.ExecuteNonQueryAsync(cancellationToken);
                }
                transaction.Commit();
            }
            catch
            {
                transaction.Rollback();
                throw;
            }
        }
        finally
        {
            _writeSemaphore.Release();
        }
    }

    public async Task SaveImagesBatchAsync(List<ImageFile> images, CancellationToken cancellationToken = default)
    {
        if (images.Count == 0) return;

        await _writeSemaphore.WaitAsync(cancellationToken);
        try
        {
            // Wrap the entire batch in a single transaction to avoid one fsync per image
            // (e.g. importing 1000 files was 1000 commits previously).
            // Gesamten Batch in einer einzigen Transaktion — drastisch weniger fsync-Aufrufe.
            using var transaction = _connection.BeginTransaction();
            try
            {
                foreach (var image in images)
                {
                    cancellationToken.ThrowIfCancellationRequested();
                    await SaveImageInternalNoTxAsync(image, cancellationToken);
                }
                transaction.Commit();
            }
            catch
            {
                transaction.Rollback();
                throw;
            }
        }
        finally
        {
            _writeSemaphore.Release();
        }
    }

    public async Task<List<ImageFile>> SearchImagesAsync(List<string>? terms, int? minRating, int limit = 200, int offset = 0, CancellationToken cancellationToken = default)
    {
        await _readSemaphore.WaitAsync(cancellationToken);
        try
        {
            var conditions = new List<string>();
            using var command = _readConnection.CreateCommand();

            if (minRating.HasValue && minRating.Value > 0)
            {
                conditions.Add("i.Rating >= @MinRating");
                command.Parameters.AddWithValue("@MinRating", minRating.Value);
            }

            if (terms != null && terms.Count > 0)
            {
                // Each term must match at least one tag name, filename, or description (substring, case-insensitive).
                // Terms are AND-combined. The LIKEs run against the persisted lowercase columns —
                // SQLite's own LIKE is ASCII-only case-insensitive, umlauts need the C#-lowered
                // twins. DescriptionLower may be NULL — NULL LIKE ... yields NULL, which the
                // surrounding OR/WHERE treats as no match.
                // Jeder Begriff muss Tag, Dateinamen oder Beschreibung treffen; UND-verknüpft.
                // Die LIKEs laufen gegen die persistierten Kleinschreib-Spalten — SQLites LIKE
                // kann Umlaute nicht case-insensitiv. DescriptionLower kann NULL sein —
                // NULL LIKE ... ergibt NULL und gilt in OR/WHERE als kein Treffer.
                for (int t = 0; t < terms.Count; t++)
                {
                    conditions.Add($@"(EXISTS (
                        SELECT 1 FROM ImageTags it
                        JOIN Tags tg ON it.TagId = tg.Id
                        WHERE it.ImageId = i.Id AND tg.NameLower LIKE @term{t} ESCAPE '\')
                    OR i.FileNameLower LIKE @term{t} ESCAPE '\'
                    OR i.DescriptionLower LIKE @term{t} ESCAPE '\')");
                    command.Parameters.AddWithValue($"@term{t}",
                        "%" + EscapeLikePattern(terms[t].ToLowerInvariant()) + "%");
                }
            }

            var whereClause = conditions.Count > 0 ? "WHERE " + string.Join(" AND ", conditions) : "";

            command.CommandText = $@"
                SELECT i.Id, i.Path, i.LastModified, i.Rating, i.Width, i.Height, i.DateTaken
                FROM Images i
                {whereClause}
                ORDER BY i.LastModified DESC
                LIMIT @Limit OFFSET @Offset";
            command.Parameters.AddWithValue("@Limit", limit);
            command.Parameters.AddWithValue("@Offset", offset);

            var results = new List<ImageFile>();
            using var reader = await command.ExecuteReaderAsync(cancellationToken);

            var imageIds = new List<(long id, ImageFile image)>();
            while (await reader.ReadAsync(cancellationToken))
            {
                var imageId = reader.GetInt64(0);
                var image = new ImageFile
                {
                    Path = reader.GetString(1),
                    FileName = System.IO.Path.GetFileName(reader.GetString(1)),
                    Extension = System.IO.Path.GetExtension(reader.GetString(1)),
                    DateModified = ParseStoredDateTime(reader.GetString(2)),
                    Rating = reader.GetInt32(3),
                    Width = reader.GetInt32(4),
                    Height = reader.GetInt32(5),
                };
                if (!reader.IsDBNull(6))
                    image.DateTaken = ParseStoredDateTime(reader.GetString(6));

                imageIds.Add((imageId, image));
                results.Add(image);
            }
            reader.Close();

            // Load tags for all hits in one query instead of one per hit.
            // Tags aller Treffer in einer Abfrage statt einzeln pro Treffer.
            var tagsByImageId = await GetTagsForImagesAsync(
                imageIds.Select(x => x.id).ToList(), _readConnection, cancellationToken);
            foreach (var (id, image) in imageIds)
            {
                if (tagsByImageId.TryGetValue(id, out var tags))
                    image.Tags = tags;
            }

            return results;
        }
        finally
        {
            _readSemaphore.Release();
        }
    }

    public async Task<bool> HealthCheckAsync(CancellationToken cancellationToken = default)
    {
        await _readSemaphore.WaitAsync(cancellationToken);
        try
        {
            using var command = _readConnection.CreateCommand();
            command.CommandText = "SELECT 1";
            await command.ExecuteScalarAsync(cancellationToken);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Database health check failed");
            return false;
        }
        finally
        {
            _readSemaphore.Release();
        }
    }

    public async Task SetImageDescriptionAsync(string imagePath, string description, CancellationToken cancellationToken = default)
    {
        await _writeSemaphore.WaitAsync(cancellationToken);
        try
        {
            using var cmd = _connection.CreateCommand();
            cmd.CommandText = "UPDATE Images SET Description = @Desc, DescriptionLower = @DescLower WHERE Path = @Path";
            cmd.Parameters.AddWithValue("@Desc", description);
            cmd.Parameters.AddWithValue("@DescLower", description.ToLowerInvariant());
            cmd.Parameters.AddWithValue("@Path", imagePath);
            await cmd.ExecuteNonQueryAsync(cancellationToken);
        }
        finally
        {
            _writeSemaphore.Release();
        }
    }

    public async Task<string?> GetImageDescriptionAsync(string path, CancellationToken cancellationToken = default)
    {
        await _readSemaphore.WaitAsync(cancellationToken);
        try
        {
            using var command = _readConnection.CreateCommand();
            command.CommandText = "SELECT Description FROM Images WHERE Path = @Path";
            command.Parameters.AddWithValue("@Path", path);

            // No row → null; DBNull → not a string → null. / Keine Zeile oder DBNull → null.
            var result = await command.ExecuteScalarAsync(cancellationToken);
            var description = result as string;
            return string.IsNullOrEmpty(description) ? null : description;
        }
        finally
        {
            _readSemaphore.Release();
        }
    }

    /// <summary>
    /// Escape LIKE wildcards in user input so they match literally (used with ESCAPE '\').
    /// Escaped LIKE-Wildcards in Nutzereingaben, damit sie wörtlich matchen.
    /// </summary>
    internal static string EscapeLikePattern(string term)
        => term.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_");

    public async Task SaveFacesAsync(string imagePath, IReadOnlyList<NewFace> faces, DateTime fileLastWriteUtc, CancellationToken cancellationToken = default)
    {
        await _writeSemaphore.WaitAsync(cancellationToken);
        try
        {
            using var transaction = _connection.BeginTransaction();
            try
            {
                // Ensure the Images row exists; a face scan may hit images never browsed before.
                // Stellt die Images-Zeile sicher — der Scan kann Bilder vor dem ersten Browsen treffen.
                long imageId;
                using (var ensure = _connection.CreateCommand())
                {
                    ensure.Transaction = transaction;
                    ensure.CommandText = @"
                        INSERT INTO Images (Path, FileName, FileNameLower, LastModified)
                        VALUES (@Path, @FileName, @FileNameLower, @LastModified)
                        ON CONFLICT(Path) DO NOTHING;
                        SELECT Id FROM Images WHERE Path = @Path;";
                    ensure.Parameters.AddWithValue("@Path", imagePath);
                    ensure.Parameters.AddWithValue("@FileName", Path.GetFileName(imagePath));
                    ensure.Parameters.AddWithValue("@FileNameLower", Path.GetFileName(imagePath).ToLowerInvariant());
                    ensure.Parameters.AddWithValue("@LastModified", fileLastWriteUtc.ToString("o"));
                    imageId = (long)(await ensure.ExecuteScalarAsync(cancellationToken))!;
                }

                using (var del = _connection.CreateCommand())
                {
                    del.Transaction = transaction;
                    del.CommandText = "DELETE FROM Faces WHERE ImageId = @ImageId";
                    del.Parameters.AddWithValue("@ImageId", imageId);
                    await del.ExecuteNonQueryAsync(cancellationToken);
                }

                using (var ins = _connection.CreateCommand())
                {
                    ins.Transaction = transaction;
                    ins.CommandText = @"
                        INSERT INTO Faces (ImageId, X, Y, W, H, Embedding, Status, ScannedAt)
                        VALUES (@ImageId, @X, @Y, @W, @H, @Embedding, @Status, @ScannedAt)";
                    var pImg = ins.Parameters.Add("@ImageId", System.Data.DbType.Int64);
                    var pX = ins.Parameters.Add("@X", System.Data.DbType.Single);
                    var pY = ins.Parameters.Add("@Y", System.Data.DbType.Single);
                    var pW = ins.Parameters.Add("@W", System.Data.DbType.Single);
                    var pH = ins.Parameters.Add("@H", System.Data.DbType.Single);
                    var pEmb = ins.Parameters.Add("@Embedding", System.Data.DbType.Binary);
                    var pStatus = ins.Parameters.Add("@Status", System.Data.DbType.String);
                    var pAt = ins.Parameters.Add("@ScannedAt", System.Data.DbType.String);

                    var now = DateTime.UtcNow.ToString("o");
                    foreach (var face in faces)
                    {
                        cancellationToken.ThrowIfCancellationRequested();
                        pImg.Value = imageId;
                        pX.Value = face.X; pY.Value = face.Y; pW.Value = face.W; pH.Value = face.H;
                        pEmb.Value = EmbeddingConverter.ToBytes(face.Embedding);
                        pStatus.Value = FaceStatus.Unnamed;
                        pAt.Value = now;
                        await ins.ExecuteNonQueryAsync(cancellationToken);
                    }
                }

                using (var mark = _connection.CreateCommand())
                {
                    mark.Transaction = transaction;
                    mark.CommandText = "UPDATE Images SET FaceScanAt = @At, FaceScanFileTime = @FileTime WHERE Id = @Id";
                    mark.Parameters.AddWithValue("@At", DateTime.UtcNow.ToString("o"));
                    mark.Parameters.AddWithValue("@FileTime", fileLastWriteUtc.ToString("o"));
                    mark.Parameters.AddWithValue("@Id", imageId);
                    await mark.ExecuteNonQueryAsync(cancellationToken);
                }

                transaction.Commit();
            }
            catch
            {
                transaction.Rollback();
                throw;
            }
        }
        finally
        {
            _writeSemaphore.Release();
        }
    }

    public async Task<Dictionary<string, string>> GetFaceScanTimesAsync(List<string> paths, CancellationToken cancellationToken = default)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (paths.Count == 0) return result;

        await _readSemaphore.WaitAsync(cancellationToken);
        try
        {
            for (int i = 0; i < paths.Count; i += _chunkSize)
            {
                cancellationToken.ThrowIfCancellationRequested();
                var chunk = paths.Skip(i).Take(_chunkSize).ToList();
                var placeholders = string.Join(",", chunk.Select((_, idx) => $"@p{idx}"));

                using var cmd = _readConnection.CreateCommand();
                cmd.CommandText = $"SELECT Path, FaceScanFileTime FROM Images WHERE FaceScanFileTime IS NOT NULL AND Path IN ({placeholders})";
                for (int j = 0; j < chunk.Count; j++) cmd.Parameters.AddWithValue($"@p{j}", chunk[j]);

                using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
                while (await reader.ReadAsync(cancellationToken))
                    result[reader.GetString(0)] = reader.GetString(1);
            }
            return result;
        }
        finally
        {
            _readSemaphore.Release();
        }
    }

    private const string FaceSelectColumns = @"
        f.Id, f.ImageId, i.Path, f.X, f.Y, f.W, f.H, f.Embedding,
        f.PersonId, f.SuggestedPersonId, f.SuggestionScore, f.RejectedPersonId, f.Status";

    private static StoredFace ReadStoredFace(System.Data.Common.DbDataReader reader)
    {
        return new StoredFace(
            reader.GetInt64(0),
            reader.GetInt64(1),
            reader.GetString(2),
            reader.GetFloat(3), reader.GetFloat(4), reader.GetFloat(5), reader.GetFloat(6),
            EmbeddingConverter.ToFloats((byte[])reader[7]),
            reader.IsDBNull(8) ? null : reader.GetInt64(8),
            reader.IsDBNull(9) ? null : reader.GetInt64(9),
            reader.IsDBNull(10) ? null : reader.GetDouble(10),
            reader.IsDBNull(11) ? null : reader.GetInt64(11),
            reader.GetString(12));
    }

    public async Task<List<StoredFace>> GetFacesForFolderAsync(string folderPath, bool includeSubfolders = false, CancellationToken cancellationToken = default)
    {
        var results = new List<StoredFace>();
        var normalized = folderPath.TrimEnd('\\');

        await _readSemaphore.WaitAsync(cancellationToken);
        try
        {
            using var cmd = _readConnection.CreateCommand();
            // Load all faces from images whose path starts with the folder prefix.
            // Non-recursive callers get the exact directory check in C#; recursive
            // callers keep the whole subtree the prefix already matched.
            // Lädt alle Gesichter, deren Pfad mit dem Ordner-Präfix beginnt.
            // Ohne Rekursion filtert C# auf das exakte Verzeichnis; mit Rekursion
            // bleibt der gesamte Teilbaum aus dem Präfix-Match erhalten.
            cmd.CommandText = $@"
                SELECT {FaceSelectColumns}
                FROM Faces f JOIN Images i ON f.ImageId = i.Id
                WHERE i.Path LIKE @Prefix ESCAPE '\'";
            cmd.Parameters.AddWithValue("@Prefix", EscapeLikePattern(normalized) + "\\\\%");

            using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                var face = ReadStoredFace(reader);
                if (includeSubfolders || string.Equals(Path.GetDirectoryName(face.ImagePath), normalized, StringComparison.OrdinalIgnoreCase))
                    results.Add(face);
            }
            return results;
        }
        finally
        {
            _readSemaphore.Release();
        }
    }

    public async Task<List<StoredFace>> GetFacesByIdsAsync(List<long> faceIds, CancellationToken cancellationToken = default)
    {
        var results = new List<StoredFace>();
        if (faceIds.Count == 0) return results;

        await _readSemaphore.WaitAsync(cancellationToken);
        try
        {
            for (int i = 0; i < faceIds.Count; i += _chunkSize)
            {
                cancellationToken.ThrowIfCancellationRequested();
                var chunk = faceIds.Skip(i).Take(_chunkSize).ToList();
                var placeholders = string.Join(",", chunk.Select((_, idx) => $"@p{idx}"));

                using var cmd = _readConnection.CreateCommand();
                cmd.CommandText = $@"
                    SELECT {FaceSelectColumns}
                    FROM Faces f JOIN Images i ON f.ImageId = i.Id
                    WHERE f.Id IN ({placeholders})";
                for (int j = 0; j < chunk.Count; j++) cmd.Parameters.AddWithValue($"@p{j}", chunk[j]);

                using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
                while (await reader.ReadAsync(cancellationToken))
                    results.Add(ReadStoredFace(reader));
            }
            return results;
        }
        finally
        {
            _readSemaphore.Release();
        }
    }

    public async Task<List<PersonInfo>> GetPersonsAsync(CancellationToken cancellationToken = default)
    {
        var persons = new List<PersonInfo>();
        await _readSemaphore.WaitAsync(cancellationToken);
        try
        {
            using var cmd = _readConnection.CreateCommand();
            cmd.CommandText = @"
                SELECT p.Id, p.Name, COUNT(f.Id)
                FROM Persons p
                LEFT JOIN Faces f ON f.PersonId = p.Id AND f.Status = 'confirmed'
                GROUP BY p.Id, p.Name
                ORDER BY p.Name";
            using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
                persons.Add(new PersonInfo(reader.GetInt64(0), reader.GetString(1), reader.GetInt32(2)));
            return persons;
        }
        finally { _readSemaphore.Release(); }
    }

    public async Task<long> GetOrCreatePersonAsync(string name, CancellationToken cancellationToken = default)
    {
        await _writeSemaphore.WaitAsync(cancellationToken);
        try
        {
            using var cmd = _connection.CreateCommand();
            cmd.CommandText = "INSERT OR IGNORE INTO Persons (Name) VALUES (@Name); SELECT Id FROM Persons WHERE Name = @Name;";
            cmd.Parameters.AddWithValue("@Name", name);
            return (long)(await cmd.ExecuteScalarAsync(cancellationToken))!;
        }
        finally { _writeSemaphore.Release(); }
    }

    /// <summary>Run one UPDATE per face id inside a single transaction. / Ein UPDATE pro Face-Id in einer Transaktion.</summary>
    private async Task UpdateFacesAsync(List<long> faceIds, string setClause, Action<SQLiteCommand>? addParams, CancellationToken cancellationToken, string extraWhere = "")
    {
        if (faceIds.Count == 0) return;
        await _writeSemaphore.WaitAsync(cancellationToken);
        try
        {
            using var transaction = _connection.BeginTransaction();
            try
            {
                using var cmd = _connection.CreateCommand();
                cmd.Transaction = transaction;
                cmd.CommandText = $"UPDATE Faces SET {setClause} WHERE Id = @Id{extraWhere}";
                addParams?.Invoke(cmd);
                var idParam = cmd.Parameters.Add("@Id", System.Data.DbType.Int64);
                foreach (var id in faceIds)
                {
                    cancellationToken.ThrowIfCancellationRequested();
                    idParam.Value = id;
                    await cmd.ExecuteNonQueryAsync(cancellationToken);
                }
                transaction.Commit();
            }
            catch { transaction.Rollback(); throw; }
        }
        finally { _writeSemaphore.Release(); }
    }

    public Task AssignFacesToPersonAsync(List<long> faceIds, long personId, CancellationToken cancellationToken = default)
        => UpdateFacesAsync(faceIds,
            "PersonId = @PersonId, Status = 'confirmed', SuggestedPersonId = NULL, SuggestionScore = NULL",
            cmd => cmd.Parameters.AddWithValue("@PersonId", personId),
            cancellationToken);

    public Task RejectFaceSuggestionsAsync(List<long> faceIds, CancellationToken cancellationToken = default)
        => UpdateFacesAsync(faceIds,
            "RejectedPersonId = SuggestedPersonId, SuggestedPersonId = NULL, SuggestionScore = NULL, Status = 'unnamed'",
            addParams: null,
            cancellationToken,
            extraWhere: " AND Status = 'suggested'");

    public Task SetFacesIgnoredAsync(List<long> faceIds, CancellationToken cancellationToken = default)
        => UpdateFacesAsync(faceIds,
            "Status = 'ignored', SuggestedPersonId = NULL, SuggestionScore = NULL",
            addParams: null,
            cancellationToken);

    public async Task<Dictionary<long, List<float[]>>> GetConfirmedEmbeddingsByPersonAsync(CancellationToken cancellationToken = default)
    {
        var result = new Dictionary<long, List<float[]>>();
        await _readSemaphore.WaitAsync(cancellationToken);
        try
        {
            using var cmd = _readConnection.CreateCommand();
            cmd.CommandText = "SELECT PersonId, Embedding FROM Faces WHERE Status = 'confirmed' AND PersonId IS NOT NULL";
            using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                var personId = reader.GetInt64(0);
                if (!result.TryGetValue(personId, out var list))
                    result[personId] = list = new List<float[]>();
                list.Add(EmbeddingConverter.ToFloats((byte[])reader[1]));
            }
            return result;
        }
        finally { _readSemaphore.Release(); }
    }

    public async Task ApplyFaceSuggestionsAsync(IReadOnlyList<FaceSuggestionUpdate> suggestions, CancellationToken cancellationToken = default)
    {
        if (suggestions.Count == 0) return;
        await _writeSemaphore.WaitAsync(cancellationToken);
        try
        {
            using var transaction = _connection.BeginTransaction();
            try
            {
                using var cmd = _connection.CreateCommand();
                cmd.Transaction = transaction;
                // Only faces still unnamed take a suggestion — never overwrite user decisions.
                // Nur unbenannte Gesichter erhalten Vorschläge — Nutzerentscheidungen bleiben unberührt.
                cmd.CommandText = @"
                    UPDATE Faces SET Status = 'suggested', SuggestedPersonId = @PersonId, SuggestionScore = @Score
                    WHERE Id = @Id AND Status = 'unnamed'";
                var pPerson = cmd.Parameters.Add("@PersonId", System.Data.DbType.Int64);
                var pScore = cmd.Parameters.Add("@Score", System.Data.DbType.Double);
                var pId = cmd.Parameters.Add("@Id", System.Data.DbType.Int64);
                foreach (var s in suggestions)
                {
                    cancellationToken.ThrowIfCancellationRequested();
                    pPerson.Value = s.PersonId; pScore.Value = s.Score; pId.Value = s.FaceId;
                    await cmd.ExecuteNonQueryAsync(cancellationToken);
                }
                transaction.Commit();
            }
            catch { transaction.Rollback(); throw; }
        }
        finally { _writeSemaphore.Release(); }
    }

    public void Dispose()
    {
        if (_disposed) return;
        try
        {
            // Force a WAL checkpoint so the .db-wal file shrinks before shutdown
            // (otherwise it can grow unbounded over many sessions).
            // WAL-Checkpoint vor Shutdown — sonst wächst die .db-wal-Datei unbegrenzt.
            try
            {
                using var cmd = _connection.CreateCommand();
                cmd.CommandText = "PRAGMA wal_checkpoint(TRUNCATE);";
                cmd.ExecuteNonQuery();
            }
            catch (Exception ex)
            {
                _logger?.LogWarning(ex, "WAL checkpoint on shutdown failed");
            }

            _writeSemaphore?.Dispose();
            // Only dispose read semaphore if it's a separate instance
            if (_readSemaphore != _writeSemaphore)
                _readSemaphore?.Dispose();
            // Only close read connection if it's a separate instance
            if (_readConnection != _connection)
            {
                _readConnection?.Close();
                _readConnection?.Dispose();
            }
            _connection?.Close();
            _connection?.Dispose();
        }
        finally
        {
            _disposed = true;
        }
    }
}
