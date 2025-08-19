# Services

This directory contains the business logic services for the Portable Image Manager application.

## Thumbnail System

The thumbnail system consists of three main components:

### ThumbnailService
Handles the actual generation of thumbnails using Sharp.js for images and FFmpeg.wasm for videos. Uses worker threads for background processing to avoid blocking the main thread.

### ThumbnailCacheService
Implements an LRU (Least Recently Used) cache with memory management. Stores thumbnails in memory as Base64 strings and automatically invalidates cache entries when files are modified.

### ThumbnailManagerService
Combines thumbnail generation and caching into a unified interface. Provides methods for getting single thumbnails, batch processing, and preloading.

## Usage Example

```typescript
import { ThumbnailManagerService } from './services/ThumbnailManagerService';

// Initialize the service
const thumbnailManager = new ThumbnailManagerService();

// Get a single thumbnail
const thumbnail = await thumbnailManager.getThumbnail('/path/to/image.jpg', {
  width: 200,
  height: 200,
  quality: 80
});

// Get thumbnails for multiple files
const files: MediaFile[] = [
  { path: '/path/to/image1.jpg', name: 'image1.jpg', extension: '.jpg', size: 1024, dateModified: new Date(), type: 'image' },
  { path: '/path/to/video.mp4', name: 'video.mp4', extension: '.mp4', size: 2048, dateModified: new Date(), type: 'video' }
];

const thumbnails = await thumbnailManager.getThumbnailBatch(files);

// Preload thumbnails in background
await thumbnailManager.preloadThumbnails(files);

// Check cache statistics
const stats = thumbnailManager.getCacheStats();
console.log(`Cache hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
console.log(`Memory usage: ${(stats.memoryUsage / 1024 / 1024).toFixed(1)} MB`);

// Clean up when done
await thumbnailManager.dispose();
```

## Features

- **Multi-format Support**: Handles images (JPEG, PNG, GIF, BMP, TIFF, WebP) and videos (MP4, AVI, MOV, MKV, WMV, FLV, WebM)
- **Worker Thread Processing**: Non-blocking thumbnail generation using worker threads
- **Memory-based Caching**: LRU cache with automatic memory management and file modification detection
- **Batch Processing**: Efficient processing of multiple files
- **Background Preloading**: Preload thumbnails for better user experience
- **Cache Invalidation**: Automatic invalidation when files are modified
- **Performance Monitoring**: Cache statistics and hit rate tracking

## Configuration

The thumbnail system can be configured with the following parameters:

- **Cache Size**: Maximum number of thumbnails to keep in memory (default: 1000)
- **Memory Limit**: Maximum memory usage in MB (default: 100MB)
- **Thumbnail Options**: Width, height, quality, and format settings
- **Worker Pool Size**: Number of worker threads (default: CPU cores / 2)

## Error Handling

The system includes comprehensive error handling:

- File access errors (permissions, file not found)
- Thumbnail generation failures (corrupted files, unsupported formats)
- Memory limit exceeded (automatic eviction)
- Worker thread failures (graceful fallback)

All errors are logged and handled gracefully without crashing the application.