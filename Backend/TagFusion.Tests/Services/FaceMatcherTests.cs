using NUnit.Framework;
using TagFusion.Models;
using TagFusion.Services;

namespace TagFusion.Tests.Services;

[TestFixture]
public class FaceMatcherTests
{
    private static float[] Vec(params float[] values)
    {
        var v = new float[512];
        Array.Copy(values, v, values.Length);
        return v;
    }

    private static StoredFace Face(long id, float[] embedding, long? rejectedPersonId = null) =>
        new(id, 1, "C:\\a.jpg", 0, 0, 10, 10, embedding, null, null, null, rejectedPersonId, FaceStatus.Unnamed);

    [Test]
    public void CosineSimilarity_ParallelVectorsAreOne_OrthogonalAreZero()
    {
        Assert.That(FaceMatcher.CosineSimilarity(Vec(1, 0), Vec(2, 0)), Is.EqualTo(1.0).Within(1e-6));
        Assert.That(FaceMatcher.CosineSimilarity(Vec(1, 0), Vec(0, 1)), Is.EqualTo(0.0).Within(1e-6));
    }

    [Test]
    public void CosineSimilarity_ZeroVector_ReturnsZero()
    {
        Assert.That(FaceMatcher.CosineSimilarity(Vec(0), Vec(1, 0)), Is.EqualTo(0.0));
    }

    [Test]
    public void Centroid_AveragesComponentWise()
    {
        var centroid = FaceMatcher.Centroid(new[] { Vec(1, 0), Vec(0, 1) });
        Assert.That(centroid[0], Is.EqualTo(0.5f).Within(1e-6));
        Assert.That(centroid[1], Is.EqualTo(0.5f).Within(1e-6));
    }

    [Test]
    public void ComputeSuggestions_BestPersonAboveThresholdWins()
    {
        var confirmed = new Dictionary<long, List<float[]>>
        {
            [1] = new() { Vec(1, 0) },          // Person 1: Richtung e1
            [2] = new() { Vec(0, 1) },          // Person 2: Richtung e2
        };
        var face = Face(10, Vec(0.9f, 0.1f));

        var suggestions = FaceMatcher.ComputeSuggestions(new[] { face }, confirmed);

        Assert.That(suggestions, Has.Count.EqualTo(1));
        Assert.That(suggestions[0].PersonId, Is.EqualTo(1));
        Assert.That(suggestions[0].Score, Is.GreaterThan(FaceMatcher.SuggestionThreshold));
    }

    [Test]
    public void ComputeSuggestions_BelowThreshold_NoSuggestion()
    {
        var confirmed = new Dictionary<long, List<float[]>> { [1] = new() { Vec(1, 0) } };
        var face = Face(10, Vec(0.1f, 0.9f)); // similarity ≈ 0.11

        Assert.That(FaceMatcher.ComputeSuggestions(new[] { face }, confirmed), Is.Empty);
    }

    [Test]
    public void ComputeSuggestions_SkipsRejectedPerson_ButAllowsNextBest()
    {
        var confirmed = new Dictionary<long, List<float[]>>
        {
            [1] = new() { Vec(1, 0) },
            [2] = new() { Vec(0.8f, 0.6f) }, // ähnlich genug zu (0.9, 0.1)? cos = (0.72+0.06)/1 = 0.78 → ja
        };
        var face = Face(10, Vec(0.9f, 0.1f), rejectedPersonId: 1);

        var suggestions = FaceMatcher.ComputeSuggestions(new[] { face }, confirmed);

        Assert.That(suggestions, Has.Count.EqualTo(1));
        Assert.That(suggestions[0].PersonId, Is.EqualTo(2));
    }

    [Test]
    public void ClusterUnknown_GroupsSimilarFaces_SeparatesDissimilar()
    {
        var faces = new[]
        {
            Face(1, Vec(1, 0)),
            Face(2, Vec(0.95f, 0.05f)),
            Face(3, Vec(0, 1)),
        };

        var groups = FaceMatcher.ClusterUnknown(faces);

        Assert.That(groups, Has.Count.EqualTo(2));
        Assert.That(groups.Single(g => g.Count == 2).Select(f => f.Id), Is.EquivalentTo(new long[] { 1, 2 }));
    }

    [Test]
    public void ClusterUnknown_EmptyInput_EmptyOutput()
    {
        Assert.That(FaceMatcher.ClusterUnknown(Array.Empty<StoredFace>()), Is.Empty);
    }
}
