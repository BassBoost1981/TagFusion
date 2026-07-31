using System.Text.Json;

namespace TagFusion.Bridge.Handlers;

/// <summary>
/// Result of a tag library export or import.
/// Ergebnis eines Exports oder Imports der Tag-Bibliothek.
/// </summary>
public sealed record TagLibraryTransferResult(
    bool Cancelled,
    string? FilePath,
    int CategoryCount,
    int TagCount);

/// <summary>
/// File-format helpers for tag library backup files: serialization, strict validation
/// and counting. Deliberately dialog-free so the logic is unit testable.
/// Dateiformat-Helfer für Tag-Bibliothek-Backups — bewusst ohne Dialoge, damit testbar.
/// </summary>
public static class TagLibraryBackup
{
    // Same options TagService uses for the internal tag file, so export/import stay
    // byte-compatible with the normal persistence path.
    // Gleiche Optionen wie im TagService, damit Export/Import exakt dem internen Format entsprechen.
    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        WriteIndented = true
    };

    /// <summary>
    /// Default file name of an export, e.g. TagFusion_Tag-Bibliothek_2026-07-25.json.
    /// Standard-Dateiname eines Exports (mit Datum).
    /// </summary>
    public static string BuildDefaultFileName(DateTime timestamp) =>
        $"TagFusion_Tag-Bibliothek_{timestamp:yyyy-MM-dd}.json";

    /// <summary>
    /// Serializes a library object as indented JSON.
    /// Serialisiert die Bibliothek als eingerücktes JSON.
    /// </summary>
    public static string Serialize(object library) =>
        JsonSerializer.Serialize(library, _jsonOptions);

    /// <summary>
    /// Strictly validates backup file content and returns the library plus its counts.
    /// Anything that is not a TagFusion tag library raises a BridgeException — the caller
    /// must not persist anything in that case (no partial import).
    /// Strenge Validierung: Fremdformate werfen eine BridgeException, es wird nichts teilweise importiert.
    /// </summary>
    public static (JsonElement Library, int CategoryCount, int TagCount) ParseAndValidate(string json)
    {
        if (string.IsNullOrWhiteSpace(json))
            throw new BridgeException(
                "Die Datei ist leer und enthält keine Tag-Bibliothek.",
                internalMessage: "Tag library import: empty file");

        JsonDocument document;
        try
        {
            document = JsonDocument.Parse(json);
        }
        catch (JsonException ex)
        {
            throw new BridgeException(
                "Die Datei enthält kein gültiges JSON und kann nicht importiert werden.",
                internalMessage: "Tag library import: malformed JSON",
                inner: ex);
        }

        using (document)
        {
            var root = document.RootElement;

            if (root.ValueKind != JsonValueKind.Object
                || !root.TryGetProperty("categories", out var categories)
                || categories.ValueKind != JsonValueKind.Array)
            {
                throw new BridgeException(
                    "Die Datei ist keine TagFusion-Tag-Bibliothek — die Liste \"categories\" fehlt.",
                    internalMessage: "Tag library import: missing or invalid categories array");
            }

            var categoryCount = 0;
            var tagCount = 0;

            foreach (var category in categories.EnumerateArray())
            {
                categoryCount++;

                if (category.ValueKind != JsonValueKind.Object || !HasName(category))
                    throw new BridgeException(
                        $"Kategorie {categoryCount} in der Datei ist ungültig — der Name fehlt.",
                        internalMessage: $"Tag library import: category {categoryCount} has no name");

                if (!category.TryGetProperty("subcategories", out var subcategories)
                    || subcategories.ValueKind == JsonValueKind.Null)
                    continue;

                if (subcategories.ValueKind != JsonValueKind.Array)
                    throw new BridgeException(
                        $"Kategorie {categoryCount} in der Datei hat ungültige Unterkategorien.",
                        internalMessage: $"Tag library import: subcategories of category {categoryCount} is not an array");

                var subcategoryCount = 0;
                foreach (var subcategory in subcategories.EnumerateArray())
                {
                    subcategoryCount++;

                    if (subcategory.ValueKind != JsonValueKind.Object || !HasName(subcategory))
                        throw new BridgeException(
                            $"Unterkategorie {subcategoryCount} in Kategorie {categoryCount} ist ungültig — der Name fehlt.",
                            internalMessage: $"Tag library import: subcategory {categoryCount}/{subcategoryCount} has no name");

                    if (!subcategory.TryGetProperty("tags", out var tags)
                        || tags.ValueKind == JsonValueKind.Null)
                        continue;

                    if (tags.ValueKind != JsonValueKind.Array)
                        throw new BridgeException(
                            $"Unterkategorie {subcategoryCount} in Kategorie {categoryCount} hat eine ungültige Tag-Liste.",
                            internalMessage: $"Tag library import: tags of {categoryCount}/{subcategoryCount} is not an array");

                    foreach (var tag in tags.EnumerateArray())
                    {
                        if (tag.ValueKind != JsonValueKind.String)
                            throw new BridgeException(
                                $"Unterkategorie {subcategoryCount} in Kategorie {categoryCount} enthält einen ungültigen Tag.",
                                internalMessage: $"Tag library import: non-string tag in {categoryCount}/{subcategoryCount}");

                        tagCount++;
                    }
                }
            }

            // Clone: the element must outlive the JsonDocument that owns its buffer.
            // Clone: Das Element muss das JsonDocument überleben, dem der Puffer gehört.
            return (root.Clone(), categoryCount, tagCount);
        }
    }

    /// <summary>
    /// Counts categories and tags of an already persisted library; unreadable content
    /// yields zeros because export must not fail over a display detail.
    /// Zählt Kategorien und Tags — unlesbarer Inhalt liefert 0, der Export soll daran nicht scheitern.
    /// </summary>
    public static (int CategoryCount, int TagCount) Count(string json)
    {
        try
        {
            var (_, categoryCount, tagCount) = ParseAndValidate(json);
            return (categoryCount, tagCount);
        }
        catch (BridgeException)
        {
            return (0, 0);
        }
    }

    private static bool HasName(JsonElement element) =>
        element.TryGetProperty("name", out var name)
        && name.ValueKind == JsonValueKind.String
        && !string.IsNullOrWhiteSpace(name.GetString());
}
