using System.IO;
using System.Text.Json;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using NUnit.Framework;
using TagFusion.Bridge.Handlers;
using TagFusion.Database;
using TagFusion.Models;
using TagFusion.Services;

namespace TagFusion.Tests.Bridge.Handlers;

[TestFixture]
public class FaceHandlerTests
{
    private Mock<IFaceEngine> _engine = null!;
    private Mock<IDatabaseService> _db = null!;
    private Mock<IExifToolService> _exifTool = null!;
    private Mock<IFileSystemService> _fs = null!;
    private FaceScanService _scanService = null!;
    private FaceHandler _handler = null!;
    private List<string> _tempFiles = null!;

    [SetUp]
    public void SetUp()
    {
        _engine = new Mock<IFaceEngine>();
        _engine.SetupGet(e => e.IsAvailable).Returns(true);
        _db = new Mock<IDatabaseService>();
        _exifTool = new Mock<IExifToolService>();
        _fs = new Mock<IFileSystemService>();
        _tempFiles = new List<string>();
        _scanService = new FaceScanService(_engine.Object, _db.Object, _fs.Object, NullLogger<FaceScanService>.Instance);
        _handler = new FaceHandler(_scanService, _engine.Object, _db.Object, _exifTool.Object, NullLogger<FaceHandler>.Instance);
    }

    [TearDown]
    public void TearDown()
    {
        foreach (var f in _tempFiles)
            if (File.Exists(f)) File.Delete(f);
    }

    private string CreateTempImage()
    {
        var path = Path.Combine(Path.GetTempPath(), Guid.NewGuid() + ".jpg");
        File.WriteAllText(path, "fake");
        _tempFiles.Add(path);
        return path;
    }

    private static Dictionary<string, object> Payload(string json)
        => JsonSerializer.Deserialize<Dictionary<string, object>>(json)!
            .ToDictionary(kvp => kvp.Key, kvp => (object)kvp.Value);

    [Test]
    public void ScanFaces_EngineUnavailable_ThrowsGermanMessage()
    {
        _engine.SetupGet(e => e.IsAvailable).Returns(false);

        var ex = Assert.ThrowsAsync<TagFusion.Bridge.BridgeException>(
            () => _handler.HandleAsync("scanFacesInFolder", Payload("{\"path\":\"C:\\\\fotos\"}")));
        Assert.That(ex!.UserMessage, Does.Contain("nicht verfügbar"));
    }

    [Test]
    public async Task GetPersons_MapsToCamelCasePayload()
    {
        _db.Setup(d => d.GetPersonsAsync(It.IsAny<CancellationToken>()))
           .ReturnsAsync(new List<PersonInfo> { new(1, "Max", 3) });

        var result = await _handler.HandleAsync("getPersons", null);

        var list = (IEnumerable<object>)result!;
        Assert.That(list.Count(), Is.EqualTo(1));
    }

    [Test]
    public async Task ConfirmFaceGroup_WritesTag_AndAssignsOnlySucceededFaces()
    {
        var okPath = CreateTempImage();
        var failPath = CreateTempImage();
        var faces = new List<StoredFace>
        {
            new(1, 1, okPath, 0, 0, 1, 1, new float[512], null, null, null, null, FaceStatus.Unnamed),
            new(2, 2, failPath, 0, 0, 1, 1, new float[512], null, null, null, null, FaceStatus.Unnamed),
        };
        _db.Setup(d => d.GetFacesByIdsAsync(It.IsAny<List<long>>(), It.IsAny<CancellationToken>())).ReturnsAsync(faces);
        _db.Setup(d => d.GetOrCreatePersonAsync("Max", It.IsAny<CancellationToken>())).ReturnsAsync(42L);
        _exifTool.Setup(e => e.ReadTagsAsync(It.IsAny<string>(), It.IsAny<CancellationToken>())).ReturnsAsync(new List<string>());
        _exifTool.Setup(e => e.ReadRatingAsync(It.IsAny<string>(), It.IsAny<CancellationToken>())).ReturnsAsync(0);
        _exifTool.Setup(e => e.WriteTagsAsync(okPath, It.IsAny<List<string>>(), It.IsAny<CancellationToken>())).ReturnsAsync(true);
        _exifTool.Setup(e => e.WriteTagsAsync(failPath, It.IsAny<List<string>>(), It.IsAny<CancellationToken>())).ReturnsAsync(false);

        var payload = Payload("{\"faceIds\":[1,2],\"personName\":\"Max\"}");
        var result = await _handler.HandleAsync("confirmFaceGroup", payload);

        _db.Verify(d => d.AssignFacesToPersonAsync(
            It.Is<List<long>>(ids => ids.Count == 1 && ids[0] == 1), 42L, It.IsAny<CancellationToken>()), Times.Once);
        _exifTool.Verify(e => e.WriteTagsAsync(okPath, It.Is<List<string>>(t => t.Contains("Max")), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Test]
    public async Task RejectAndIgnore_DelegateToDatabase()
    {
        await _handler.HandleAsync("rejectFaceSuggestion", Payload("{\"faceIds\":[5]}"));
        _db.Verify(d => d.RejectFaceSuggestionsAsync(It.Is<List<long>>(ids => ids[0] == 5), It.IsAny<CancellationToken>()), Times.Once);

        await _handler.HandleAsync("ignoreFaces", Payload("{\"faceIds\":[6]}"));
        _db.Verify(d => d.SetFacesIgnoredAsync(It.Is<List<long>>(ids => ids[0] == 6), It.IsAny<CancellationToken>()), Times.Once);
    }
}
