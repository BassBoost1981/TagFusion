namespace TagFusion.Models;

/// <summary>A face detected in an image, ready to persist. Coordinates in original image pixels.
/// Ein erkanntes Gesicht, bereit zum Speichern. Koordinaten in Originalpixeln.</summary>
public record NewFace(float X, float Y, float W, float H, float[] Embedding);

/// <summary>A stored face row joined with its image path.
/// Eine gespeicherte Faces-Zeile inklusive Bildpfad.</summary>
public record StoredFace(
    long Id, long ImageId, string ImagePath,
    float X, float Y, float W, float H,
    float[] Embedding,
    long? PersonId, long? SuggestedPersonId, double? SuggestionScore, long? RejectedPersonId,
    string Status);

/// <summary>A person with the count of confirmed faces.</summary>
public record PersonInfo(long Id, string Name, int FaceCount);

/// <summary>A computed suggestion to persist after matching.</summary>
public record FaceSuggestionUpdate(long FaceId, long PersonId, double Score);

/// <summary>Face status values as stored in SQLite. / Status-Werte wie in SQLite gespeichert.</summary>
public static class FaceStatus
{
    public const string Unnamed = "unnamed";
    public const string Suggested = "suggested";
    public const string Confirmed = "confirmed";
    public const string Ignored = "ignored";
}
