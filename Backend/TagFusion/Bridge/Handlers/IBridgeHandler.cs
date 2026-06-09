namespace TagFusion.Bridge.Handlers;

/// <summary>
/// Interface for bridge action handlers.
/// Each handler is responsible for a group of related bridge actions.
/// </summary>
public interface IBridgeHandler
{
    /// <summary>
    /// Returns the set of action names this handler supports.
    /// </summary>
    IReadOnlySet<string> SupportedActions { get; }

    /// <summary>
    /// Handles the given bridge action and returns the result.
    /// </summary>
    Task<object?> HandleAsync(string action, Dictionary<string, object>? payload);
}
