# FileSystemRepository

The FileSystemRepository is a core component that handles all file system operations for the portable image manager application.

## Features

### Drive Scanning
- **Cross-platform drive detection**: Supports Windows, macOS, and Linux
- **Advanced Windows drive detection**: Uses WMI for accurate drive information including type, size, and labels
- **macOS support**: Uses `diskutil` and `df` commands for mounted volumes
- **Linux support**: Reads `/proc/mounts` and uses `df` for filesystem information
- **Fallback mechanisms**: Basic drive scanning when advanced methods fail

### Directory Operations
- **Recursive directory traversal** with configurable depth limits
- **Performance optimizations**: Batch processing and concurrent operations
- **Smart filtering**: Automatically skips system and hidden directories
- **Caching system**: 30-second cache for directory contents to improve performance

### Media File Detection
- **Supported image formats**: JPEG, PNG, GIF, BMP, TIFF, WebP
- **Supported video formats**: MP4, AVI, MOV, WMV, FLV, MKV, WebM
- **Case-insensitive extension matching**
- **Efficient media counting** without full file processing

### Performance Features
- **Batch processing**: Limits concurrent operations to prevent system overload
- **Directory caching**: Reduces filesystem calls for recently accessed directories
- **Lazy loading**: Only processes directories when needed
- **Memory management**: Automatic cache cleanup to prevent memory leaks

### File Operations
- **Basic file operations**: Copy, move, delete files and directories
- **Batch operations**: Process multiple files efficiently
- **Error handling**: Graceful handling of permission errors and missing files
- **Atomic operations**: Safe file operations with proper error recovery

## Usage

```typescript
import { FileSystemRepository } from './repositories/FileSystemRepository';

const fileRepo = new FileSystemRepository();

// Get available drives
const drives = await fileRepo.getDrives();

// Get directory contents
const contents = await fileRepo.getDirectoryContents('/path/to/directory');

// Get directory tree
const tree = await fileRepo.getDirectoryTree('/path/to/directory', 3);

// Check supported formats
const extensions = fileRepo.getSupportedExtensions();
const isSupported = fileRepo.isExtensionSupported('.jpg');

// File operations
await fileRepo.copyFile('/source/file.jpg', '/dest/file.jpg');
await fileRepo.moveFile('/source/file.jpg', '/dest/file.jpg');
await fileRepo.deleteFile('/path/to/file.jpg');

// Batch operations
const copyResults = await fileRepo.batchCopyFiles([
  { source: '/src/1.jpg', destination: '/dest/1.jpg' },
  { source: '/src/2.jpg', destination: '/dest/2.jpg' }
]);
```

## Configuration

The repository includes several configurable parameters:

- `maxConcurrentOperations`: Maximum number of concurrent file operations (default: 10)
- `cacheTimeout`: Directory cache timeout in milliseconds (default: 30000)
- `maxDirectoryDepth`: Maximum recursion depth for directory traversal (default: 10)

## Error Handling

The repository implements comprehensive error handling:

- **Permission errors**: Gracefully skips inaccessible files/directories
- **Missing files**: Returns appropriate error responses
- **System limitations**: Respects system limits and provides fallbacks
- **Network drives**: Handles network timeouts and connectivity issues

## Platform Compatibility

### Windows
- Uses WMI for accurate drive information
- Supports all drive types (local, removable, network)
- Handles Windows-specific paths and permissions

### macOS
- Uses `diskutil` and `df` for drive information
- Supports mounted volumes in `/Volumes`
- Handles macOS-specific filesystem features

### Linux
- Reads `/proc/mounts` for filesystem information
- Supports various mount points (`/media`, `/mnt`)
- Handles different filesystem types

## Requirements

The implementation satisfies the following requirements from the specification:

- **Requirement 2.1**: Drive and folder structure scanning
- **Requirement 2.2**: Supported media format detection (JPEG, PNG, GIF, BMP, TIFF, MP4, AVI, MOV)
- **Requirement 2.3**: Recursive folder traversal and navigation