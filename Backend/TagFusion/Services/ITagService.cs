using TagFusion.Models;

namespace TagFusion.Services;

/// <summary>
/// Interface for tag library management.
/// </summary>
public interface ITagService
{
    Task<List<Tag>> GetAllTagsAsync(CancellationToken cancellationToken = default);
    Task<object?> GetTagLibraryAsync(CancellationToken cancellationToken = default);
    Task<bool> SaveTagLibraryAsync(object library, CancellationToken cancellationToken = default);
}
