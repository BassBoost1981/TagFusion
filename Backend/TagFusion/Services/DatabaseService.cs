using System.Data.SQLite;
using System.Diagnostics;
using System.IO;
using TagFusion.Database;
using TagFusion.Models;

namespace TagFusion.Services;

public class DatabaseService : IDatabaseService
{
    private readonly string _connectionString;

    public DatabaseService()
    {
        var appDir = AppContext.BaseDirectory ?? string.Empty;
        var dbPath = Path.Combine(appDir, "tagfusion.db");
        _connectionString = $"Data Source={dbPath};Version=3;";
        
        InitializeDatabase();
    }

    private void InitializeDatabase()
    {
        using var connection = new SQLiteConnection(_connectionString);
        connection.Open();

        using var command = connection.CreateCommand();
        command.CommandText = @"
            CREATE TABLE IF NOT EXISTS Images (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                Path TEXT NOT NULL UNIQUE,
                LastModified TEXT NOT NULL,
                Rating INTEGER DEFAULT 0,
                Width INTEGER DEFAULT 0,
                Height INTEGER DEFAULT 0,
                DateTaken TEXT
            );

            CREATE TABLE IF NOT EXISTS Tags (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                Name TEXT NOT NULL UNIQUE
            );

            CREATE TABLE IF NOT EXISTS ImageTags (
                ImageId INTEGER NOT NULL,
                TagId INTEGER NOT NULL,
                PRIMARY KEY (ImageId, TagId),
                FOREIGN KEY (ImageId) REFERENCES Images(Id) ON DELETE CASCADE,
                FOREIGN KEY (TagId) REFERENCES Tags(Id) ON DELETE CASCADE
            );
            
            CREATE INDEX IF NOT EXISTS idx_images_path ON Images(Path);
            CREATE INDEX IF NOT EXISTS idx_tags_name ON Tags(Name);
        ";
        command.ExecuteNonQuery();
    }

    public async Task<ImageFile?> GetImageAsync(string path, CancellationToken cancellationToken = default)
    {
        using var connection = new SQLiteConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        using var command = connection.CreateCommand();
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
                DateModified = DateTime.Parse(reader.GetString(reader.GetOrdinal("LastModified")))
            };

            if (!reader.IsDBNull(reader.GetOrdinal("DateTaken")))
            {
                image.DateTaken = DateTime.Parse(reader.GetString(reader.GetOrdinal("DateTaken")));
            }

            // Load tags
            image.Tags = await GetTagsForImageAsync(connection, reader.GetInt64(reader.GetOrdinal("Id")), cancellationToken);

            return image;
        }

        return null;
    }

    private async Task<List<string>> GetTagsForImageAsync(SQLiteConnection connection, long imageId, CancellationToken cancellationToken = default)
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

    public async Task SaveImageAsync(ImageFile image, CancellationToken cancellationToken = default)
    {
        using var connection = new SQLiteConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        using var transaction = connection.BeginTransaction();

        try
        {
            // Insert or Update Image
            using (var cmd = connection.CreateCommand())
            {
                cmd.CommandText = @"
                    INSERT INTO Images (Path, LastModified, Rating, Width, Height, DateTaken)
                    VALUES (@Path, @LastModified, @Rating, @Width, @Height, @DateTaken)
                    ON CONFLICT(Path) DO UPDATE SET
                        LastModified = @LastModified,
                        Rating = @Rating,
                        Width = @Width,
                        Height = @Height,
                        DateTaken = @DateTaken
                    RETURNING Id;
                ";
                cmd.Parameters.AddWithValue("@Path", image.Path);
                cmd.Parameters.AddWithValue("@LastModified", image.DateModified.ToString("o"));
                cmd.Parameters.AddWithValue("@Rating", image.Rating);
                cmd.Parameters.AddWithValue("@Width", image.Width);
                cmd.Parameters.AddWithValue("@Height", image.Height);
                cmd.Parameters.AddWithValue("@DateTaken", image.DateTaken?.ToString("o") ?? (object)DBNull.Value);

                var result = await cmd.ExecuteScalarAsync(cancellationToken);
                var imageId = result != null ? (long)result : 0;

                if (imageId == 0) throw new Exception("Failed to insert/update image");

                // Update Tags
                // First, clear existing tags for this image
                using (var deleteCmd = connection.CreateCommand())
                {
                    deleteCmd.CommandText = "DELETE FROM ImageTags WHERE ImageId = @ImageId";
                    deleteCmd.Parameters.AddWithValue("@ImageId", imageId);
                    await deleteCmd.ExecuteNonQueryAsync(cancellationToken);
                }

                // Insert new tags
                foreach (var tag in image.Tags)
                {
                    cancellationToken.ThrowIfCancellationRequested();

                    // Ensure tag exists
                    long tagId;
                    using (var tagCmd = connection.CreateCommand())
                    {
                        tagCmd.CommandText = "INSERT OR IGNORE INTO Tags (Name) VALUES (@Name); SELECT Id FROM Tags WHERE Name = @Name;";
                        tagCmd.Parameters.AddWithValue("@Name", tag);
                        var tagResult = await tagCmd.ExecuteScalarAsync(cancellationToken);
                        tagId = tagResult != null ? (long)tagResult : 0;
                    }

                    if (tagId == 0) continue;

                    // Link tag
                    using (var linkCmd = connection.CreateCommand())
                    {
                        linkCmd.CommandText = "INSERT INTO ImageTags (ImageId, TagId) VALUES (@ImageId, @TagId)";
                        linkCmd.Parameters.AddWithValue("@ImageId", imageId);
                        linkCmd.Parameters.AddWithValue("@TagId", tagId);
                        await linkCmd.ExecuteNonQueryAsync(cancellationToken);
                    }
                }
            }

            transaction.Commit();
        }
        catch
        {
            transaction.Rollback();
            throw;
        }
    }

    public async Task<Dictionary<string, ImageMetadata>> GetMetadataForPathsAsync(List<string> paths, CancellationToken cancellationToken = default)
    {
        var result = new Dictionary<string, ImageMetadata>();
        if (paths.Count == 0) return result;

        using var connection = new SQLiteConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        // Process in chunks of 500 to avoid parameter limits
        const int chunkSize = 500;
        for (int i = 0; i < paths.Count; i += chunkSize)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var chunk = paths.Skip(i).Take(chunkSize).ToList();
            var placeholders = string.Join(",", chunk.Select((_, idx) => $"@p{idx}"));

            using var command = connection.CreateCommand();
            command.CommandText = $@"
                SELECT i.Path, i.Rating, GROUP_CONCAT(t.Name, '||') as TagList,
                       i.LastModified, i.Width, i.Height, i.DateTaken
                FROM Images i
                LEFT JOIN ImageTags it ON i.Id = it.ImageId
                LEFT JOIN Tags t ON it.TagId = t.Id
                WHERE i.Path IN ({placeholders})
                GROUP BY i.Id, i.Path, i.Rating, i.LastModified, i.Width, i.Height, i.DateTaken";

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
                var lastModified = DateTime.Parse(reader.GetString(3));
                var width = reader.GetInt32(4);
                var height = reader.GetInt32(5);
                var dateTaken = reader.IsDBNull(6) ? (DateTime?)null : DateTime.Parse(reader.GetString(6));

                var tags = tagList?.Split("||", StringSplitOptions.RemoveEmptyEntries)?.ToList()
                    ?? new List<string>();

                result[path] = new ImageMetadata(tags, rating, lastModified, width, height, dateTaken);
            }
        }

        return result;
    }

    public async Task SaveImagesBatchAsync(List<ImageFile> images, CancellationToken cancellationToken = default)
    {
        foreach (var image in images)
        {
            cancellationToken.ThrowIfCancellationRequested();
            await SaveImageAsync(image, cancellationToken);
        }
    }

    public async Task<bool> HealthCheckAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            using var connection = new SQLiteConnection(_connectionString);
            await connection.OpenAsync(cancellationToken);
            using var command = connection.CreateCommand();
            command.CommandText = "SELECT 1";
            await command.ExecuteScalarAsync(cancellationToken);
            return true;
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[Database] Health check failed: {ex.Message}");
            return false;
        }
    }
}