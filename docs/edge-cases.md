# TagFusion Edge Case Documentation

This document outlines known limitations, edge cases, and error-handling strategies for TagFusion.

## ExifTool Integration

### 1. Large Files / Timeouts
- **Problem:** Writing metadata to very large image files (e.g., 50MB+ RAW files) can take several seconds.
- **Handling:** The backend uses `-stay_open` mode to keep ExifTool ready, but extremely large operations might still block the message queue.
- **ATLAS Recommendation:** Implement a timeout mechanism and background queue for metadata writes.

### 2. Character Encoding (Unicode Paths)
- **Problem:** Files located in paths with non-ASCII characters (e.g., Chinese, Arabic, emojis) might fail to be read by older ExifTool versions or if the pipe encoding is mismatched.
- **Status:** Verified to work with current UTF-8 pipe configuration.

## File System & Performance

### 1. Folders with 10,000+ Images
- **Problem:** Loading thousands of thumbnails into the grid can overwhelm browser memory and cause lag.
- **Handling:** Virtuoso-based virtualization is implemented in `ImageGrid.tsx`.
- **Edge Case:** Initial metadata extraction for 10,000 images still takes O(n) time on the backend.

### 2. Network Drives (Samba/NAS)
- **Problem:** Connection drops or high latency on network shares can cause `DirectoryNotFound` or `IOException`.
- **Handling:** Basic error catch in `FileService`, but no automatic retry logic yet.

## Image Processing

### 1. Corrupt Images
- **Problem:** Attempts to generate thumbnails for partially downloaded or corrupt files.
- **Handling:** `SkiaSharp` returns null or throws. The frontend shows a placeholder icon.

---

## Error Handling Matrix

| Component | Error Trigger | Current Behavior | Target Behavior (ATLAS) |
|-----------|---------------|------------------|-------------------------|
| Backend   | Path traversal attempt | Returns empty list | Log security event & Block |
| Backend   | ExifTool crash | Restart service on next call | Auto-restart + Fallback UI |
| Frontend  | Bridge disconnection | Console error | Visual "Disconnected" state |
| Frontend  | 404 Thumbnail | Placeholder icon | Retry logic (max 3) |
