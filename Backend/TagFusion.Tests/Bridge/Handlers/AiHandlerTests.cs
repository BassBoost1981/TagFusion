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
public class AiHandlerTests
{
    private Mock<IAiCaptionClient> _client = null!;
    private Mock<IExifToolService> _exifTool = null!;
    private Mock<IDatabaseService> _db = null!;
    private Mock<IFileSystemService> _fs = null!;
    private Mock<IAiServerProcessService> _serverProcess = null!;
    private DescriptionScanService _scanService = null!;
    private AiHandler _handler = null!;

    [SetUp]
    public void SetUp()
    {
        _client = new Mock<IAiCaptionClient>();
        _exifTool = new Mock<IExifToolService>();
        _db = new Mock<IDatabaseService>();
        _fs = new Mock<IFileSystemService>();
        _serverProcess = new Mock<IAiServerProcessService>();
        _scanService = new DescriptionScanService(_client.Object, _exifTool.Object, _db.Object, _fs.Object,
            NullLogger<DescriptionScanService>.Instance);
        _handler = new AiHandler(_scanService, _client.Object, _exifTool.Object, _fs.Object,
            _serverProcess.Object, NullLogger<AiHandler>.Instance);
    }

    private static Dictionary<string, object> Payload(string json)
        => JsonSerializer.Deserialize<Dictionary<string, object>>(json)!
            .ToDictionary(kvp => kvp.Key, kvp => (object)kvp.Value);

    [Test]
    public async Task GetAiServerStatus_MergesStatusAndModels()
    {
        _client.Setup(c => c.GetStatusAsync(It.IsAny<CancellationToken>()))
               .ReturnsAsync(new AiServerStatus(true, "idle", "", -1, ""));
        _client.Setup(c => c.GetCaptionModelsAsync(It.IsAny<CancellationToken>()))
               .ReturnsAsync(new List<string> { "qwen" });

        var result = await _handler.HandleAsync("getAiServerStatus", null);

        Assert.That(result, Is.Not.Null);
        _client.Verify(c => c.GetCaptionModelsAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Test]
    public async Task GetAiServerStatus_Unreachable_SkipsModelListing()
    {
        _client.Setup(c => c.GetStatusAsync(It.IsAny<CancellationToken>()))
               .ReturnsAsync(new AiServerStatus(false, "unreachable", "", -1, ""));

        await _handler.HandleAsync("getAiServerStatus", null);

        _client.Verify(c => c.GetCaptionModelsAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Test]
    public async Task GetDescriptionPrecheck_CountsExistingDescriptions()
    {
        _fs.Setup(f => f.GetImagesAsync("C:\\fotos", It.IsAny<CancellationToken>()))
           .ReturnsAsync(new List<ImageFile>
           {
               new() { Path = "C:\\fotos\\a.jpg" },
               new() { Path = "C:\\fotos\\b.jpg" },
           });
        _exifTool.Setup(e => e.ReadDescriptionsBatchAsync(It.IsAny<List<string>>(), It.IsAny<CancellationToken>()))
                 .ReturnsAsync(new Dictionary<string, string> { ["C:\\fotos\\a.jpg"] = "da" });

        var result = await _handler.HandleAsync("getDescriptionPrecheck", Payload("{\"path\":\"C:\\\\fotos\"}"));

        var json = JsonSerializer.Serialize(result);
        Assert.That(json, Does.Contain("\"total\":2"));
        Assert.That(json, Does.Contain("\"withDescription\":1"));
    }

    [Test]
    public void StartDescriptionScan_ServerUnreachable_ThrowsGermanMessage()
    {
        _client.Setup(c => c.GetStatusAsync(It.IsAny<CancellationToken>()))
               .ReturnsAsync(new AiServerStatus(false, "unreachable", "", -1, ""));

        var payload = Payload("{\"path\":\"C:\\\\fotos\",\"model\":\"qwen\",\"prompt\":\"p\",\"overwriteExisting\":false}");
        var ex = Assert.ThrowsAsync<TagFusion.Bridge.BridgeException>(
            () => _handler.HandleAsync("startDescriptionScan", payload));
        Assert.That(ex!.UserMessage, Does.Contain("nicht erreichbar"));
    }

    [Test]
    public async Task CancelDescriptionScan_ReturnsTrue()
    {
        var result = await _handler.HandleAsync("cancelDescriptionScan", null);
        Assert.That(result, Is.EqualTo(true));
    }

    [Test]
    public async Task GetAiServerStatus_IncludesManagedByApp()
    {
        _client.Setup(c => c.GetStatusAsync(It.IsAny<CancellationToken>()))
               .ReturnsAsync(new AiServerStatus(true, "idle", "", -1, ""));
        _client.Setup(c => c.GetCaptionModelsAsync(It.IsAny<CancellationToken>()))
               .ReturnsAsync(new List<string> { "qwen" });
        _serverProcess.Setup(s => s.IsManagedByApp).Returns(true);

        var result = await _handler.HandleAsync("getAiServerStatus", null);

        var json = JsonSerializer.Serialize(result);
        Assert.That(json, Does.Contain("\"managedByApp\":true"));
    }

    [Test]
    public async Task GetAiServerStatus_IncludesLastStartError()
    {
        _client.Setup(c => c.GetStatusAsync(It.IsAny<CancellationToken>()))
               .ReturnsAsync(new AiServerStatus(false, "unreachable", "", -1, ""));
        _serverProcess.Setup(s => s.LastStartError).Returns("ModuleNotFoundError: No module named 'flask'");

        var result = await _handler.HandleAsync("getAiServerStatus", null);

        var json = JsonSerializer.Serialize(result);
        Assert.That(json, Does.Contain("lastStartError"));
        Assert.That(json, Does.Contain("flask"));
    }

    [Test]
    public async Task StartAiServer_DelegatesToService()
    {
        var result = await _handler.HandleAsync("startAiServer", null);

        Assert.That(result, Is.EqualTo(true));
        _serverProcess.Verify(s => s.StartServer(), Times.Once);
    }

    [Test]
    public async Task StopAiServer_DelegatesToService()
    {
        var result = await _handler.HandleAsync("stopAiServer", null);

        Assert.That(result, Is.EqualTo(true));
        _serverProcess.Verify(s => s.StopServer(), Times.Once);
    }

    [Test]
    public void StartAiServer_ServiceThrows_PropagatesBridgeException()
    {
        _serverProcess.Setup(s => s.StartServer())
                      .Throws(new TagFusion.Bridge.BridgeException("Python nicht gefunden — Pfad in den Einstellungen (AiServer:PythonExecutable) setzen.", internalMessage: "x"));

        var ex = Assert.ThrowsAsync<TagFusion.Bridge.BridgeException>(() => _handler.HandleAsync("startAiServer", null));
        Assert.That(ex!.UserMessage, Does.Contain("Python nicht gefunden"));
    }
}
