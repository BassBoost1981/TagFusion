# Changelog

All notable changes to TagFusion are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/), versions follow [SemVer](https://semver.org/).

## [Unreleased]

### Added
- AiApiServer start is now USB-portable: a Python bundled inside the AiApiServer folder (venv/.venv/python) is auto-detected, and `AiServer:PythonExecutable` may be a relative path resolved against the server folder
- If the AI server crashes on start (e.g. missing dependency), the "Describe images" dialog now shows the reason instead of silently staying unreachable
- Start/stop the local AiApiServer directly from the "Describe images" dialog; a server TagFusion started is shut down on exit
- Local AI image descriptions via the bundled AiApiServer: manual per-folder run with model/prompt dialog (German templates, editable), skip-or-overwrite choice for existing descriptions, MWG metadata + database mirror
- Global search now also matches AI descriptions (tags OR filename OR description)
- Local face recognition: manual per-folder scan (FaceAiSharp/ONNX, fully offline), similarity-grouped naming, suggestions for known persons with confirm/reject, confirmed names written as regular tags
- Face data stored in SQLite (Persons/Faces, migration v4); face engine is optional — the app runs normally without model files
- Global search matches partial tag names AND filenames, case-insensitive incl. umlauts; multiple terms are AND-combined (comma/space separated)
- Stale database entries (files deleted outside the app) are cleaned up automatically during global search; entries on unplugged drives are preserved
- Search pagination, duplicate detection optimization, IndexedDB thumbnail eviction
- Bridge handler tests and contract tests (frontend ↔ backend action names)
- Service interfaces (`IExifToolService`, `IFileSystemService`, …) for testability
- Error/progress events over the bridge
- CI: code coverage collection (Vitest + Coverlet), Playwright E2E on a Windows runner

### Changed
- Image processing migrated to ImageSharp
- Thumbnails served via WebView2 virtual host with streaming
- SQLite read concurrency (WAL, separate read/write connections)
- Batch tagging reverts only failed images instead of rolling back the whole batch
- ExifTool read timeout scales with batch size (large batches on slow drives)
- Grid selection no longer re-renders unchanged image cards

### Fixed
- Crash-safe image editing, path validation, ExifTool read timeout with process restart
- App could hang on exit while an ExifTool call was stuck (bounded dispose wait)
- 11 verified code-review findings (see `docs/code-review-2026-05-29.md`)

### Security
- Defense-in-depth guard against argument injection via line breaks in the ExifTool `-stay_open` stdin protocol

## [1.0.0] - 2026-02-28

Initial release: image browsing with virtualized grid, EXIF/IPTC/XMP tagging via ExifTool,
tag library, ratings, lightbox, batch operations, duplicate detection, German/English UI.
