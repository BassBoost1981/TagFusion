using System.Text.Json;
using System.Text.RegularExpressions;
using System.IO;

namespace TagFusion.Tests.Bridge;

public class BridgeContractTests
{
    [Test]
    public void BackendHandlersExposeExactlyTheSharedBridgeActions()
    {
        var contractActions = ReadContractActions();
        var handlerActions = ReadHandlerActions();

        Assert.That(handlerActions, Is.EquivalentTo(contractActions));
    }

    private static string[] ReadContractActions()
    {
        var repoRoot = FindRepoRoot(TestContext.CurrentContext.TestDirectory);
        var contractPath = Path.Combine(repoRoot, "bridge-actions.json");
        using var document = JsonDocument.Parse(File.ReadAllText(contractPath));
        return document.RootElement
            .GetProperty("actions")
            .EnumerateArray()
            .Select(action => action.GetString()!)
            .OrderBy(action => action, StringComparer.Ordinal)
            .ToArray();
    }

    private static string[] ReadHandlerActions()
    {
        var repoRoot = FindRepoRoot(TestContext.CurrentContext.TestDirectory);
        var handlersDir = Path.Combine(repoRoot, "Backend", "TagFusion", "Bridge", "Handlers");

        return Directory.GetFiles(handlersDir, "*Handler.cs")
            .SelectMany(File.ReadAllText)
            .Pipe(ExtractSupportedActions)
            .Distinct(StringComparer.Ordinal)
            .OrderBy(action => action, StringComparer.Ordinal)
            .ToArray();
    }

    private static IEnumerable<string> ExtractSupportedActions(IEnumerable<char> sourceChars)
    {
        var source = new string(sourceChars.ToArray());
        var supportedBlocks = Regex.Matches(
            source,
            @"private\s+static\s+readonly\s+HashSet<string>\s+_supported\s*=\s*new\([^)]*\)\s*\{(?<body>.*?)\};",
            RegexOptions.Singleline);

        foreach (Match block in supportedBlocks)
        {
            foreach (Match action in Regex.Matches(block.Groups["body"].Value, "\"(?<action>[^\"]+)\""))
                yield return action.Groups["action"].Value;
        }
    }

    private static string FindRepoRoot(string startDirectory)
    {
        var directory = new DirectoryInfo(startDirectory);
        while (directory != null)
        {
            if (File.Exists(Path.Combine(directory.FullName, "AGENTS.md")))
                return directory.FullName;
            directory = directory.Parent;
        }

        throw new DirectoryNotFoundException("Repository root with AGENTS.md was not found.");
    }
}

internal static class EnumerablePipeExtensions
{
    public static TResult Pipe<TSource, TResult>(this TSource source, Func<TSource, TResult> transform) => transform(source);
}
