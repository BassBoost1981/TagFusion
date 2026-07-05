using TagFusion.Models;

namespace TagFusion.Services;

/// <summary>
/// Pure matching logic for face embeddings: suggestions against known persons
/// and greedy similarity clustering for unknown faces. No I/O — fully unit-testable.
/// Reine Matching-Logik: Vorschläge gegen bekannte Personen und Greedy-Clustering
/// unbekannter Gesichter. Kein I/O — vollständig testbar.
/// </summary>
public static class FaceMatcher
{
    /// <summary>Minimum cosine similarity to suggest a known person. / Schwelle für Personen-Vorschläge.</summary>
    public const double SuggestionThreshold = 0.50;

    /// <summary>Minimum cosine similarity to join an unknown-face group (stricter on purpose).
    /// Schwelle fürs Gruppieren Unbekannter — bewusst strenger.</summary>
    public const double ClusterThreshold = 0.55;

    public static double CosineSimilarity(float[] a, float[] b)
    {
        double dot = 0, normA = 0, normB = 0;
        for (int i = 0; i < a.Length; i++)
        {
            dot += (double)a[i] * b[i];
            normA += (double)a[i] * a[i];
            normB += (double)b[i] * b[i];
        }
        if (normA == 0 || normB == 0) return 0;
        return dot / (Math.Sqrt(normA) * Math.Sqrt(normB));
    }

    public static float[] Centroid(IReadOnlyList<float[]> embeddings)
    {
        var result = new float[embeddings[0].Length];
        foreach (var e in embeddings)
            for (int i = 0; i < result.Length; i++)
                result[i] += e[i];
        for (int i = 0; i < result.Length; i++)
            result[i] /= embeddings.Count;
        return result;
    }

    public static List<FaceSuggestionUpdate> ComputeSuggestions(
        IReadOnlyList<StoredFace> unnamedFaces,
        IReadOnlyDictionary<long, List<float[]>> confirmedByPerson,
        double threshold = SuggestionThreshold)
    {
        var suggestions = new List<FaceSuggestionUpdate>();
        if (confirmedByPerson.Count == 0) return suggestions;

        var centroids = confirmedByPerson.ToDictionary(kvp => kvp.Key, kvp => Centroid(kvp.Value));

        foreach (var face in unnamedFaces)
        {
            long bestPerson = 0;
            double bestScore = threshold;
            foreach (var (personId, centroid) in centroids)
            {
                // Never re-suggest a person the user already rejected for this face.
                // Eine vom User abgelehnte Person wird diesem Gesicht nie erneut vorgeschlagen.
                if (face.RejectedPersonId == personId) continue;

                var score = CosineSimilarity(face.Embedding, centroid);
                if (score >= bestScore)
                {
                    bestScore = score;
                    bestPerson = personId;
                }
            }
            if (bestPerson != 0)
                suggestions.Add(new FaceSuggestionUpdate(face.Id, bestPerson, bestScore));
        }
        return suggestions;
    }

    public static List<List<StoredFace>> ClusterUnknown(
        IReadOnlyList<StoredFace> faces,
        double threshold = ClusterThreshold)
    {
        var groups = new List<(List<StoredFace> Members, List<float[]> Embeddings)>();

        foreach (var face in faces)
        {
            List<StoredFace>? best = null;
            double bestScore = threshold;
            foreach (var (members, embeddings) in groups)
            {
                var score = CosineSimilarity(face.Embedding, Centroid(embeddings));
                if (score >= bestScore)
                {
                    bestScore = score;
                    best = members;
                }
            }

            if (best != null)
            {
                best.Add(face);
                groups.First(g => g.Members == best).Embeddings.Add(face.Embedding);
            }
            else
            {
                groups.Add((new List<StoredFace> { face }, new List<float[]> { face.Embedding }));
            }
        }

        return groups.Select(g => g.Members).ToList();
    }
}
