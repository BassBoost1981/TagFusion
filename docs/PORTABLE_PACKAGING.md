# Portable Packaging Guide

This document describes the portable packaging system for Portable Image Manager, which ensures the application can run without installation and leaves no traces on the host system.

## Overview

The portable packaging system consists of two main components:

1. **Electron Builder Configuration** - Creates a single-file executable with all dependencies embedded
2. **Portable Data Management** - Ensures all application data is stored relative to the executable

## Features

### True Portability
- Single executable file with all dependencies embedded
- No installation required
- No registry entries or system files created
- All configuration stored relative to executable
- Automatic cleanup on application exit

### Cross-Platform Support
- Windows: Portable .exe with embedded dependencies
- macOS: Self-contained .app bundle
- Linux: AppImage with all dependencies

### Data Management
- Configuration files stored in `PortableData/config/`
- Temporary files stored in `PortableData/temp/`
- Cache files stored in `PortableData/cache/`
- Automatic cleanup of temporary and cache files on exit

## Building Portable Executables

### Prerequisites
```bash
npm install
```

### Build Commands

#### Windows Portable
```bash
npm run package:portable
```
This creates a single .exe file that includes all dependencies.

#### All Platforms
```bash
npm run package:portable:all
```
This creates portable packages for Windows, macOS, and Linux.

#### Custom Build Script
```bash
node scripts/build-portable.js
```
This runs the comprehensive build script with verification and statistics.

## Configuration

### Electron Builder Settings

The portable configuration is defined in `electron-builder.config.js`:

```javascript
portable: {
  artifactName: '${productName}-${version}-${arch}-portable.${ext}',
  requestExecutionLevel: 'asInvoker',
  unpackDirName: '${productName}',
  splashImage: 'Assets/Logo.ico',
  unicode: false
}
```

Key settings:
- `requestExecutionLevel: 'asInvoker'` - No admin rights required
- `unpackDirName` - Directory name for temporary extraction
- `unicode: false` - Better compatibility with older systems

### Dependency Bundling

Critical dependencies are handled specially:

```javascript
asarUnpack: [
  '**/node_modules/sharp/**/*',
  '**/node_modules/@ffmpeg/**/*',
  '**/node_modules/electron/**/*'
]
```

These native modules are unpacked for proper functionality.

## Portable Data Service

### Automatic Detection

The `PortableDataService` automatically detects portable mode by:

1. Checking if executable name contains "portable"
2. Detecting if running from temporary directory
3. Looking for `.portable` indicator file
4. Analyzing execution path patterns

### Data Storage Locations

#### Portable Mode
```
ExecutableDirectory/
├── PortableImageManager.exe
├── .portable (indicator file)
└── PortableData/
    ├── config/
    │   ├── settings.json
    │   ├── favorites.json
    │   └── tag-hierarchy.json
    ├── temp/ (cleaned on exit)
    │   └── thumbnails/
    └── cache/ (cleaned on exit)
        └── processed-images/
```

#### Installed Mode
Uses standard Electron `userData` directory:
- Windows: `%APPDATA%/PortableImageManager/`
- macOS: `~/Library/Application Support/PortableImageManager/`
- Linux: `~/.config/PortableImageManager/`

### API Usage

```typescript
import { PortableDataService } from './services/PortableDataService';

const portableService = new PortableDataService();

// Check if running in portable mode
if (portableService.isPortableMode()) {
  console.log('Running in portable mode');
}

// Save configuration
portableService.saveConfig('settings.json', {
  language: 'en',
  theme: 'dark'
});

// Load configuration with default fallback
const settings = portableService.loadConfig('settings.json', {
  language: 'en',
  theme: 'system'
});

// Get storage statistics
const stats = portableService.getStorageStats();
console.log(`Config size: ${stats.configSize} bytes`);
```

## Cleanup System

### Automatic Cleanup

The portable app automatically cleans up on exit:

1. **Temporary Files** - All files in `temp/` directory
2. **Cache Files** - All files in `cache/` directory  
3. **Configuration** - Preserved for next run

### Cleanup Triggers

Cleanup is triggered on:
- Normal application exit
- Process termination (SIGINT, SIGTERM)
- Uncaught exceptions
- Unhandled promise rejections
- System shutdown

### Manual Cleanup

```typescript
// Clear temporary data
portableService.clearTempData();

// Clear cache data
portableService.clearCacheData();

// Get cleanup statistics
const stats = portableService.getStorageStats();
```

## Security Considerations

### No System Modifications
- No registry entries created
- No system files modified
- No services installed
- No startup entries added

### Minimal Permissions
- Runs with user-level permissions only
- No administrator rights required
- File access limited to application directory and selected media folders

### Data Privacy
- All application data stored locally
- No network connections for telemetry
- Configuration never leaves the portable directory

## Troubleshooting

### Common Issues

#### Large Executable Size
The portable executable includes all dependencies, making it larger than installed versions:
- Windows: ~150-200 MB (includes Node.js, Chromium, native modules)
- Solution: This is expected for true portability

#### Slow First Startup
First startup may be slower due to extraction:
- Temporary files extracted to system temp directory
- Subsequent startups are faster
- Solution: This is normal behavior

#### Antivirus False Positives
Some antivirus software may flag portable executables:
- Reason: Self-extracting executables can trigger heuristics
- Solution: Add exception for the executable

### Debug Information

Enable debug logging:
```bash
# Windows
set DEBUG=portable-image-manager:*
PortableImageManager.exe

# macOS/Linux
DEBUG=portable-image-manager:* ./PortableImageManager
```

### Storage Statistics

Check storage usage:
```typescript
const stats = portableService.getStorageStats();
console.log('Storage Statistics:', {
  isPortable: stats.isPortable,
  appDataPath: stats.appDataPath,
  configSize: `${(stats.configSize / 1024).toFixed(2)} KB`,
  tempSize: `${(stats.tempSize / 1024).toFixed(2)} KB`,
  cacheSize: `${(stats.cacheSize / 1024).toFixed(2)} KB`
});
```

## Best Practices

### For Users
1. Run from a dedicated folder (not Downloads or Desktop)
2. Ensure sufficient disk space for temporary extraction
3. Don't run multiple instances simultaneously
4. Allow antivirus exceptions if needed

### For Developers
1. Test portable builds on clean systems
2. Verify no system dependencies are required
3. Monitor executable size and optimize if needed
4. Test cleanup functionality thoroughly
5. Document any platform-specific requirements

## File Structure

### Build Output
```
release/
├── PortableImageManager-1.0.0-x64-portable.exe (Windows)
├── PortableImageManager-1.0.0-x64.dmg (macOS)
└── PortableImageManager-1.0.0-x64.AppImage (Linux)
```

### Runtime Structure
```
PortableImageManager.exe
├── [Embedded Resources]
│   ├── app.asar (Application code)
│   ├── node_modules/ (Dependencies)
│   └── assets/ (Icons, resources)
└── [Runtime Data] (Created on first run)
    └── PortableData/
        ├── config/
        ├── temp/
        └── cache/
```

This portable packaging system ensures that Portable Image Manager can run on any compatible system without installation while maintaining full functionality and leaving no traces on the host system.