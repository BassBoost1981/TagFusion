namespace TagFusion.Services;

/// <summary>
/// Interface for image rotation and flip operations.
/// </summary>
public interface IImageEditService
{
    Task<Dictionary<string, bool>> RotateImagesAsync(IEnumerable<string> imagePaths, int angle, CancellationToken cancellationToken = default);
    Task<Dictionary<string, bool>> FlipImagesAsync(IEnumerable<string> imagePaths, bool horizontal, CancellationToken cancellationToken = default);
}
