namespace TagFusion.Bridge;

/// <summary>
/// Exception that carries a user-facing localized German message separate from
/// the internal/logged details. Handlers throw this to give the React UI clean
/// toasts instead of raw C# exception messages.
/// Vom Handler geworfen, um lokalisierte deutsche Fehlermeldungen an die UI
/// zu liefern, ohne C#-Stacktraces preiszugeben.
/// </summary>
public class BridgeException : Exception
{
    /// <summary>Message shown to the user (always German, ready for toasts).</summary>
    public string UserMessage { get; }

    public BridgeException(string userMessage, string? internalMessage = null, Exception? inner = null)
        : base(internalMessage ?? userMessage, inner)
    {
        UserMessage = userMessage;
    }
}
