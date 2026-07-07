using System.IO;
using System.Net;
using System.Net.Http;
using System.Text;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using NUnit.Framework;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using TagFusion.Configuration;
using TagFusion.Services;

namespace TagFusion.Tests.Services;

[TestFixture]
public class AiCaptionClientTests
{
    /// <summary>Scriptable handler: URL-substring → response body. / Skriptbarer Handler.</summary>
    private sealed class FakeHandler : HttpMessageHandler
    {
        public Func<HttpRequestMessage, (HttpStatusCode Status, string Body)>? OnRequest;
        public List<string> RequestBodies { get; } = new();

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            if (request.Content != null)
                RequestBodies.Add(await request.Content.ReadAsStringAsync(ct));
            var (status, body) = OnRequest?.Invoke(request) ?? (HttpStatusCode.NotFound, "");
            return new HttpResponseMessage(status)
            {
                Content = new StringContent(body, Encoding.UTF8, "application/json")
            };
        }
    }

    private static AiCaptionClient Create(FakeHandler handler)
    {
        var settings = Options.Create(new AiServerSettings());
        return new AiCaptionClient(new HttpClient(handler), settings, NullLogger<AiCaptionClient>.Instance);
    }

    [Test]
    public async Task GetStatus_ParsesServerState()
    {
        var handler = new FakeHandler
        {
            OnRequest = req => (HttpStatusCode.OK,
                "{\"state\":\"loading\",\"model\":\"qwen\",\"progress\":43.5,\"message\":\"Loading\"}")
        };

        var status = await Create(handler).GetStatusAsync();

        Assert.That(status.Reachable, Is.True);
        Assert.That(status.State, Is.EqualTo("loading"));
        Assert.That(status.Progress, Is.EqualTo(43.5));
    }

    [Test]
    public async Task GetStatus_ServerDown_ReportsUnreachable()
    {
        var handler = new FakeHandler
        {
            OnRequest = _ => throw new HttpRequestException("connection refused")
        };

        var status = await Create(handler).GetStatusAsync();

        Assert.That(status.Reachable, Is.False);
    }

    [Test]
    public async Task GetCaptionModels_FiltersByPromptCapability()
    {
        var handler = new FakeHandler();
        handler.OnRequest = req =>
        {
            var url = req.RequestUri!.PathAndQuery;
            if (url.Contains("listmodelsbytype"))
                return (HttpStatusCode.OK,
                    "{\"Interrogators\":[{\"ModelName\":\"qwen-caption\",\"SupportedVideo\":false,\"RepositoryLink\":\"\"}," +
                    "{\"ModelName\":\"wd-tagger\",\"SupportedVideo\":false,\"RepositoryLink\":\"\"}],\"Editors\":[],\"Translators\":[]}");
            // getmodelparams: qwen has a prompt parameter, the tagger only a threshold
            var body = handler.RequestBodies[^1];
            if (body.Contains("qwen-caption"))
                return (HttpStatusCode.OK, "{\"Parameters\":[{\"Key\":\"prompt\",\"Value\":\"describe\",\"Type\":\"string\",\"Comment\":\"\"}]}");
            return (HttpStatusCode.OK, "{\"Parameters\":[{\"Key\":\"threshold\",\"Value\":\"0.25\",\"Type\":\"float1\",\"Comment\":\"\"}]}");
        };

        var models = await Create(handler).GetCaptionModelsAsync();

        Assert.That(models, Is.EqualTo(new List<string> { "qwen-caption" }));
    }

    [Test]
    public async Task Caption_SendsContractPayload_AndExtractsText()
    {
        // Tiny real image so the client can load and downscale it.
        var imagePath = Path.Combine(Path.GetTempPath(), Guid.NewGuid() + ".png");
        using (var img = new SixLabors.ImageSharp.Image<SixLabors.ImageSharp.PixelFormats.Rgb24>(32, 32))
            await img.SaveAsPngAsync(imagePath);

        try
        {
            var handler = new FakeHandler
            {
                OnRequest = _ => (HttpStatusCode.OK,
                    "{\"Success\":true,\"ErrorMessage\":\"\",\"Result\":[{\"ModelName\":\"qwen\",\"Tags\":[{\"Tag\":\"Ein Sonnenuntergang.\",\"Probability\":1.0}]}]}")
            };

            var text = await Create(handler).CaptionAsync(imagePath, "qwen", "Beschreibe das Bild");

            Assert.That(text, Is.EqualTo("Ein Sonnenuntergang."));
            var body = handler.RequestBodies[^1];
            Assert.That(body, Does.Contain("\"DataObject\""));
            Assert.That(body, Does.Contain("\"DataType\":1"));
            Assert.That(body, Does.Contain("\"ModelName\":\"qwen\""));
            Assert.That(body, Does.Contain("\"Key\":\"prompt\""));
            Assert.That(body, Does.Contain("Beschreibe das Bild"));
        }
        finally
        {
            if (File.Exists(imagePath)) File.Delete(imagePath);
        }
    }

    [Test]
    public async Task Caption_ServerReportsFailure_Throws()
    {
        var imagePath = Path.Combine(Path.GetTempPath(), Guid.NewGuid() + ".png");
        using (var img = new SixLabors.ImageSharp.Image<SixLabors.ImageSharp.PixelFormats.Rgb24>(8, 8))
            await img.SaveAsPngAsync(imagePath);

        try
        {
            var handler = new FakeHandler
            {
                OnRequest = _ => (HttpStatusCode.OK,
                    "{\"Success\":false,\"ErrorMessage\":\"model exploded\",\"Result\":[]}")
            };

            var ex = Assert.ThrowsAsync<InvalidOperationException>(
                () => Create(handler).CaptionAsync(imagePath, "qwen", "p"));
            Assert.That(ex!.Message, Does.Contain("model exploded"));
        }
        finally
        {
            if (File.Exists(imagePath)) File.Delete(imagePath);
        }
    }
}
