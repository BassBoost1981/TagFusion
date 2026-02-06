# AGENTS.md - TagFusion Coding Agent Guidelines

TagFusion is a Windows desktop application for image tagging and metadata management.
- **Frontend:** React + TypeScript + Vite (in `Frontend/`)
- **Backend:** C# / .NET 8 WPF with WebView2 (in `Backend/`)
- **Communication:** WebView2 Bridge (JSON messages)

## 1. Build & Test Commands

### Frontend (run from `Frontend/`)
```bash
npm install              # Install dependencies
npm run dev              # Start Vite dev server
npm run build            # TypeScript check + production build
npm run lint             # ESLint - zero warnings tolerance
npm run preview          # Preview production build

# Unit/Component Tests (Vitest)
npm run test             # Run tests in watch mode
npm run test -- ImageCard.test.tsx    # Run single test file
npm run test:coverage    # Run with coverage report

# E2E Tests (Playwright)
npm run test:e2e         # Run E2E tests headless
npm run test:e2e:ui      # Run E2E tests with UI
npm run test:e2e -- navigation.spec.ts # Run single E2E spec
```

### Backend (run from `Backend/`)
The solution uses NUnit with FsCheck and Moq.
```bash
dotnet restore                          # Restore NuGet packages
dotnet build TagFusion.sln              # Build solution (Debug)
dotnet build TagFusion.sln -c Release   # Build solution (Release)
dotnet run --project TagFusion          # Run application
```

**Running Tests:**
```bash
# Run all tests
dotnet test TagFusion.sln

# Run all tests with detailed output
dotnet test TagFusion.sln --verbosity detailed

# Run a single test class (e.g., IntegrationTests)
dotnet test --filter "FullyQualifiedName~IntegrationTests"

# Run a single test method (e.g., CompleteService_SaveAndRetrieveImage_WorksCorrectly)
dotnet test --filter "Name~CompleteService_SaveAndRetrieveImage_WorksCorrectly"

# Run tests in a specific category
dotnet test --filter "TestCategory=Integration"
```

### Full Release Build
```powershell
# Located in project root
./build_release.ps1    # Builds Frontend + Backend for production
```

## 2. Frontend Code Style (TypeScript/React)

**TypeScript:** Strict mode enabled (`strict`, `noUnusedLocals`, `noUnusedParameters`).
**Path Alias:** `@/*` maps to `src/*`.

**Naming Conventions:**
| Element | Convention | Example |
|---------|------------|---------|
| Components | PascalCase | `ImageGrid.tsx` |
| Hooks | camelCase (`use` prefix) | `useAppStore`, `useSelection` |
| Types/Interfaces | PascalCase | `ImageFile`, `FolderItem` |
| Variables | camelCase | `imagePath`, `isVisible` |
| Constants | UPPER_SNAKE_CASE | `API_TIMEOUT_MS` |
| Event Handlers | camelCase (`handle` prefix) | `handleImageClick` |

**Preferred Libraries:**
- **State:** Zustand (`src/stores/`) - keep component state local unless shared.
- **Styling:** TailwindCSS + HeroUI components.
- **Icons:** `lucide-react`.
- **Animation:** `framer-motion` (use sparingly for delight).

**Structure:**
```typescript
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@heroui/react';
import { ImageGrid } from '@/components';
import type { ImageFile } from '@/types';

export const Gallery = ({ folderPath }: { folderPath: string }) => {
  // 1. Hooks
  const [images, setImages] = useState<ImageFile[]>([]);
  
  // 2. Effects
  useEffect(() => {
    // ...
  }, [folderPath]);

  // 3. Render
  return (
    <div className="p-4 flex flex-col gap-4">
      <ImageGrid items={images} />
    </div>
  );
};
```

**Error Handling:**
Display errors in German (UI language).
```typescript
try {
  await bridge.call('saveTags', { id, tags });
} catch (error) {
  console.error('[Gallery] Save failed:', error);
  toast.error('Fehler beim Speichern der Tags');
}
```

## 3. Backend Code Style (C#/.NET)

**Framework:** .NET 8 (WPF).
**Language Version:** Latest (C# 12 features encouraged).

**Naming Conventions:**
| Element | Convention | Example |
|---------|------------|---------|
| Classes | PascalCase | `DatabaseService` |
| Interfaces | `I` prefix | `IDatabaseService` |
| Async Methods | `Async` suffix | `GetFilesAsync` |
| Private Fields | `_camelCase` | `_logger`, `_dbContext` |
| Properties | PascalCase | `FilePath`, `IsTagged` |

**Architecture Patterns:**
- **Dependency Injection:** Use constructor injection for all services.
- **Async/Await:** Use for all I/O operations. Use `SemaphoreSlim` for thread safety, never `lock`.
- **DTOs:** Use `record` types for data transfer objects (immutable).
- **Result Pattern:** Return specific objects or throw typed exceptions; avoid returning `null` implicitly.

**Example Service:**
```csharp
public class ImageService : IImageService
{
    private readonly ILogger<ImageService> _logger;
    private readonly IDatabaseService _db;

    public ImageService(ILogger<ImageService> logger, IDatabaseService db)
    {
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _db = db ?? throw new ArgumentNullException(nameof(db));
    }

    public async Task<List<ImageDto>> GetImagesAsync(string path)
    {
        if (string.IsNullOrWhiteSpace(path)) 
            throw new ArgumentException("Path cannot be empty", nameof(path));

        try 
        {
            return await _db.FetchImagesAsync(path);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch images from {Path}", path);
            throw; // Re-throw to let global handler catch it or Bridge return error
        }
    }
}
```

## 4. Bridge Communication (Critical)

The bridge is the contract between Frontend and Backend. **Do not break existing message signatures.**

**Frontend Call:**
```typescript
// bridge.ts
const result = await bridge.call('actionName', { payloadKey: 'value' });
```

**Backend Handler:**
Ensure new actions are registered in the main switch expression (usually in `MainWindow.xaml.cs` or a specific `BridgeHandler` class).

```csharp
object? result = message.Action switch
{
    "getImages" => await _imageService.GetImagesAsync(message.Payload.GetProperty("path").GetString()),
    "saveTags"  => await _tagService.SaveAsync(Deserialize<TagDto>(message.Payload)),
    _ => throw new NotSupportedException($"Unknown action: {message.Action}")
};
```

## 5. Agent Workflow Guidelines

1.  **Understand the Architecture:** This is a hybrid app. UI logic is in React; Business logic/FS access is in C#.
2.  **Language:** All user-facing text (buttons, errors, logs shown to user) must be in **German**.
3.  **Tests First:** When modifying backend logic, check `TagFusion.Tests` first. Run relevant tests before and after changes.
4.  **Frontend Tests:** Unit tests in `src/**/__tests__/` (Vitest), E2E tests in `tests/e2e/` (Playwright). Run tests when modifying components.
5.  **Filesystem:** Always use absolute paths when using tool definitions, but relative paths in code (relative to project root).

## 6. Environment Specifics

- **OS:** Windows 10/11 only.
- **WebView2:** Must be installed on the host machine (included in modern Windows).
- **No Custom AI Rules:** There are no `.cursorrules` or Github Copilot instructions. This file is your primary source of truth.
