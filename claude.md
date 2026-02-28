# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TagFusion is a Windows desktop app for professional image management and metadata tagging. It writes tags directly into image metadata (EXIF/IPTC/XMP) via ExifTool, making tags portable and compatible with Adobe products and Windows Explorer.

**Architecture:** Hybrid app — WPF (.NET 8) hosts a WebView2 control that renders a React frontend. All filesystem and metadata operations happen in C#; the UI is pure React/TypeScript.

## Build & Development Commands

### Frontend (run from `Frontend/`)
```bash
npm install              # Install dependencies
npm run dev              # Vite dev server on localhost:5173
npm run build            # TypeScript check + production build
npm run lint             # ESLint (zero warnings tolerance)
npm run test             # Vitest watch mode
npm run test -- ImageCard.test.tsx    # Single test file
npm run test:coverage    # Coverage report
npm run test:e2e         # Playwright E2E (headless)
npm run test:e2e:ui      # Playwright E2E with UI
```

### Backend (run from `Backend/`)
```bash
dotnet build TagFusion.sln              # Debug build
dotnet build TagFusion.sln -c Release   # Release build
dotnet run --project TagFusion          # Run app (loads frontend from localhost:5173 in dev)
dotnet test TagFusion.sln               # Run all NUnit tests
dotnet test --filter "FullyQualifiedName~IntegrationTests"  # Single test class
dotnet test --filter "Name~SaveAndRetrieveImage"            # Single test method
```

### Full Release Build
```powershell
./build_release.ps1   # Builds Frontend → copies to wwwroot → publishes .NET self-contained exe
```
Output: `Backend/TagFusion/bin/Release/net8.0-windows/win-x64/publish/TagFusion.exe` (wwwroot must be adjacent to exe).

## Architecture & Key Patterns

### Bridge Communication (Critical Contract)

The WebView2 bridge is the core integration point. **Do not break existing message signatures.**

**Frontend → Backend:** `bridge.call('actionName', { payload })` → returns `Promise<T>`
- Defined in `Frontend/src/services/bridge.ts` (BridgeService class)
- Uses `window.chrome.webview.postMessage` / `addEventListener`
- Includes mock responses for browser-only development (no WebView2 needed)
- 120s timeout per request (for slow network drives)

**Backend handler:** `WebViewBridge.cs` dispatches actions via switch expression → calls appropriate service
- New bridge actions: add method in `bridge.ts`, add case in `WebViewBridge.cs`

**Message format:** `{ id, action, payload }` → Response: `{ id, success, data/error }`

### State Management

Zustand stores in `Frontend/src/stores/`:
- `appStore.ts` — Global app state with slices (`imageSlice`, `navigationSlice`, `uiSlice`)
- Feature stores: `tagStore`, `clipboardStore`, `contextMenuStore`, `lightboxStore`, `settingsStore`, `modalStore`, `toastStore`
- Keep component state local unless it needs to be shared across components

### Backend Services (DI via constructor injection)

All services in `Backend/TagFusion/Services/`:
- `ExifToolService` — Metadata read/write (wraps `Tools/exiftool.exe`)
- `FileSystemService` — Drive enumeration, folder navigation
- `ThumbnailService` — Thumbnail generation + SQLite caching
- `TagService` — Tag library management
- `DatabaseService` — SQLite persistence layer
- `ImageEditService` — Rotate, flip operations
- `FileOperationService` — Copy, move, delete, rename

### Frontend Structure

- `src/components/` organized by feature: `dashboard/`, `images/`, `layout/`, `lightbox/`, `tags/`, `ui/glass/`
- Path alias: `@/*` → `src/*`
- Types: `src/types/index.ts` (shared interfaces: `ImageFile`, `FolderItem`, `Tag`, `GridItem`, `TagLibrary`)
- Hooks: `useAppInit`, `useKeyboardShortcuts`, `useThumbnailManager`
- i18n: i18next with translations in `public/locales/`

## Code Conventions

### Language Rules
- **UI text / error messages:** German (app language)
- **Code & comments:** English + German (dual)
- **Commit messages:** English + German

### TypeScript/React
- Strict mode (`noUnusedLocals`, `noUnusedParameters`)
- Components: PascalCase files. Hooks: `use` prefix. Handlers: `handle` prefix. Constants: UPPER_SNAKE_CASE.
- Libraries: TailwindCSS + HeroUI for styling, Lucide for icons, Framer Motion for animation
- Component structure: hooks → effects → render

### C# / .NET 8
- C# 12 features. Interfaces: `I` prefix. Async methods: `Async` suffix. Private fields: `_camelCase`.
- All I/O must be async/await. Use `SemaphoreSlim` for thread safety (never `lock`).
- DTOs as `record` types (immutable).

## Environment

- **Windows 10/11 only** (WPF + WebView2)
- WebView2 Runtime required (pre-installed on modern Windows)
- Uses Windows-specific APIs (DWM for dark title bar)
- `Tools/exiftool.exe` — bundled ExifTool binary for metadata operations
