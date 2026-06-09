# TagFusion — Code Review (uncommitted changeset)

- **Date:** 2026-05-29
- **Scope:** the in-flight uncommitted work-in-progress (staged + unstaged + untracked), reviewed vs `HEAD` — not the whole repo history.
- **Method:** multi-agent Workflow — 8 review lenses (Opus) produced 29 raw findings; each was then adversarially re-checked against the source by an independent verifier (Sonnet) tasked with refuting it.
- **Run:** 37 agents, 3.433.909 tokens. (A first run was killed by a transient server rate-limit when all 8 lenses fired at once; this run throttled concurrency to fix that.)
- **Outcome:** **26 confirmed**, **3 refuted & dropped**, 0 lens failures.

| Severity | Count |
|---|---|
| 🟠 High | 3 |
| 🟡 Medium | 8 |
| ⚪ Low | 13 |
| 🔵 Info | 2 |

> Severity reflects the **verifier-corrected** level where it differs from the original reviewer.
> Evidence quotes and line numbers are as reported by the agents — confirm exact lines before editing, the changeset is live.

---

## Confirmed findings

### 1. 🟠 HIGH — TagService lock-free fast path returns the shared _cachedTags list that SaveTagLibraryAsync clears in place → 'Collection was modified' during JSON serialization

- **Location:** `Backend/TagFusion/Services/TagService.cs:76-82, 170`
- **Lens:** backend-concurrency · **Category:** concurrency · **Verifier confidence:** high

**What:** Bridge messages are dispatched fire-and-forget (WebViewBridge.OnWebMessageReceived line 89 does `_ = HandleWebMessageAsync(e).ContinueWith(...)`, no await), so getAllTags and saveTagLibrary run concurrently on thread-pool threads. The new lock-free fast path returns the singleton's `_cachedTags` reference WITHOUT the semaphore. TagHandler returns that exact List<Tag> to the bridge, which serializes it in SendToFrontend (`JsonSerializer.Serialize`) on the calling thread, OUTSIDE any lock. Meanwhile SaveTagLibraryAsync (under the lock) calls `_cachedTags.Clear()` — mutating the very instance being enumerated. System.Text.Json enumerates the list, so a concurrent Clear() throws InvalidOperationException ('Collection was modified; enumeration may not execute'), intermittently failing getAllTags whenever the user edits the tag library while the tag panel refreshes. The in-lock re-check path returns the same instance and is equally exposed once serialization happens post-return.

**Evidence:**
```
if (_cachedTags.Count > 0 && File.Exists(_tagFilePath) ... ) { return _cachedTags; }  // fast path, no lock   ...   _cachedTags.Clear();  // SaveTagLibraryAsync mutates same instance
```

**Fix:** Return a snapshot/immutable copy instead of the live list (e.g. `return _cachedTags.ToList();` or store/swap an immutable `IReadOnlyList<Tag>` reference and only ever reassign — never Clear() — the field). Reassigning a new reference on load (as the load path already does) plus replacing Clear() with `_cachedTags = new()` would make publication atomic and stop in-place mutation of a list another thread is reading.

**Verified:** The finding is confirmed directly from the source code. The race condition has three parts that all check out:

1. Fast path in GetAllTagsAsync (lines 78-82) returns _cachedTags directly without acquiring the semaphore. The inner re-check path (lines 88-91) also returns _cachedTags directly after releasing the semaphore.

2. The returned List<Tag> reference is passed through TagHandler.HandleAsync → ProcessMessageAsync → SendResponse → SendToFrontend, where JsonSerializer.Serialize enumerates it on the thread-pool thread, entirely outside any lock or semaphore guard.

3. SaveTagLibraryAsync (line 170) calls _cachedTags.Clear() — in-place mutation of that exact same List<Tag> instance — while holding the semaphore. Since OnWebMessageReceived (line 89) fires each incoming message as an unawited ContinueWith task, a concurrent getAllTags and saveTagLibrary message pair genuinely runs on separate thread-pool threads. If SaveTagLibraryAsync's Clear() executes while System.Text.Json is enumerating _cachedTags for serialization, the result is InvalidOperationException ('Collection was modified; enumeration may not execute').

The fix is straightforward: either return _cachedTags.ToList() from both fast-path returns so serialization works on a snapshot, or replace _cachedTags.Clear() + reload with _cachedTags = new List<Tag>() so the old reference remains stable for any concurrent reader holding it.

---

### 2. 🟠 HIGH — File.Replace breaks image rotate/flip on non-NTFS media (USB/SD/network)

- **Location:** `Backend/TagFusion/Services/ImageEditService.cs:124-126`
- **Lens:** backend-correctness · **Category:** bug · **Verifier confidence:** high

**What:** The rotate/flip save path was changed from two File.Move calls to File.Replace(tempPath, imagePath, backupPath, ignoreMetadataErrors:true). File.Replace requires the source and destination to be on the same volume AND a filesystem that supports transacted replace (NTFS). On FAT32/exFAT (typical USB sticks, SD cards straight out of a camera) and many SMB/network shares, File.Replace throws IOException. Photographers editing images directly on a card/USB drive — a very common workflow for this app — will now get a failed edit where the previous File.Move approach worked. The catch block only restores from .bak if imagePath is missing; since File.Replace fails atomically leaving imagePath intact, the operation just returns false and the edit silently fails.

**Evidence:**
```
var backupPath = imagePath + ".bak";
File.Replace(tempPath, imagePath, backupPath, ignoreMetadataErrors: true);
File.Delete(backupPath);
```

**Fix:** Catch IOException from File.Replace and fall back to the previous move-based replace (move original to .bak, move temp to imagePath, delete .bak), or detect unsupported volumes and use the move path there. Keep the move fallback so removable/network media keeps working.

**Verified:** The code at E:\Vibe-Coding\TagFusion\Backend\TagFusion\Services\ImageEditService.cs lines 124-126 was changed from two File.Move calls to File.Replace(tempPath, imagePath, backupPath, ignoreMetadataErrors: true). The comment added in this diff explicitly says "Atomic replace on NTFS", confirming the author knew this is NTFS-specific. The .NET File.Replace method wraps the Win32 ReplaceFile() API, which requires source and destination to be on the same volume and the filesystem to support transactional file replacement. FAT32 and exFAT volumes (used by virtually all camera SD cards and USB sticks) do not support ReplaceFile() and will throw IOException. On such volumes File.Replace throws, imagePath is left intact (since the failure is atomic), the .bak file is never created, the catch block cleans up the .tmp file, and the method returns false — so the rotate/flip silently fails. The previous two-step File.Move approach worked on FAT32/exFAT/network because MoveFile() falls back to copy+delete when needed. There is no fallback in the current code. A photographer editing images directly on a camera card (a stated use-case for this app) will find that rotate/flip operations silently do nothing.

---

### 3. 🟠 HIGH — bridge-actions.json contract manifest is untracked by git

- **Location:** `bridge-actions.json:1-39`
- **Lens:** bridge-contract · **Category:** test · **Verifier confidence:** high _(reviewer said info, verifier corrected to high)_

**What:** bridge-actions.json is the single source of truth that both BridgeContractTests.cs and bridgeContract.test.ts diff against, yet `git ls-files bridge-actions.json` returns nothing — it is a new untracked file in this changeset. It works locally because both tests read it from disk, but if it is not committed, CI checkouts will be missing it: the C# test's File.ReadAllText(contractPath) and the TS test's fs.readFileSync(contractPath) will throw FileNotFound, turning the parity guard into a hard failure (or, worse, a silently skipped check depending on CI config). Confirm it is staged/committed alongside the rest of the changeset.

**Evidence:**
```
git ls-files bridge-actions.json  ->  (no output; only AGENTS.md is tracked)
```

**Fix:** git add bridge-actions.json (and the new Frontend/src/services/bridgeActions.ts and the two contract test files) so the parity tests have their inputs in every clean checkout/CI run.

**Verified:** The finding is real and confirmed by direct evidence. `git ls-files bridge-actions.json` produces no output and `git status` explicitly lists it as an untracked file. Both contract tests depend on it at runtime: `BridgeContractTests.cs` line 22 calls `File.ReadAllText(contractPath)` (where contractPath resolves to the repo root `bridge-actions.json`), and `bridgeContract.test.ts` line 15 calls `fs.readFileSync(contractPath, 'utf8')`. The CI workflow uses a plain `actions/checkout@v4` with no artifact copying, so on any clean checkout (CI or fresh clone) both tests will throw a FileNotFoundException / ENOENT error. The severity should be high rather than info because this causes hard test failures in CI — the parity guard that is supposed to protect the bridge contract will be broken, not just missing. Three other new files (`Frontend/src/services/bridgeActions.ts`, `Frontend/src/services/bridgeContract.test.ts`, `Backend/TagFusion.Tests/Bridge/BridgeContractTests.cs`) are also untracked, but `bridge-actions.json` is the shared input that makes both suites fail.

---

### 4. 🟡 MEDIUM — FolderWatcherService disposes the debounce timer outside the lock that guards timer.Start(), enabling ObjectDisposedException from in-flight watcher events

- **Location:** `Backend/TagFusion/Services/FolderWatcherService.cs:147-155, 171-177`
- **Lens:** backend-concurrency · **Category:** concurrency · **Verifier confidence:** high

**What:** The refactor to a single long-lived timer moved disposal to Dispose() (`_debounceTimer.Dispose()`), but Dispose()/StopWatching() do NOT take `_lock`, while QueueChange() calls `_debounceTimer.Start()` inside `_lock`. FileSystemWatcher events run on thread-pool threads; an event queued before EnableRaisingEvents=false can still invoke OnFileEvent → QueueChange → `_debounceTimer.Start()` after Dispose() has disposed the timer, throwing ObjectDisposedException. The class comment claims this design 'avoids the race of disposing a timer mid-Elapsed', but because the dispose path is unsynchronized with the `_lock`-guarded Start(), the race is not actually closed — it is just moved to shutdown. QueueChange also never checks `_disposed`.

**Evidence:**
```
private void QueueChange(string path){ lock (_lock){ _pendingChanges.Add(path); _debounceTimer.Stop(); _debounceTimer.Start(); } }   ...   public void Dispose(){ if (_disposed) return; _disposed = true; StopWatching(); _debounceTimer.Dispose(); }
```

**Fix:** Guard the timer lifecycle with the same lock: in QueueChange check `if (_disposed) return;` inside `lock(_lock)`; in Dispose() take `lock(_lock)` to set `_disposed` and dispose the timer atomically with respect to QueueChange/FlushChanges.

**Verified:** The race is real and directly visible in the code. `Dispose()` (lines 171-177) sets `_disposed = true` and calls `_debounceTimer.Dispose()` entirely outside `_lock`. Meanwhile `QueueChange()` (lines 147-155) takes `_lock` and then calls `_debounceTimer.Start()` with no `_disposed` check. The FSW posts its callbacks to the CLR thread-pool; setting `EnableRaisingEvents = false` inside `StopWatching()` stops new events from being enqueued by the OS, but does NOT drain already-queued thread-pool work items. So the sequence: (1) Dispose sets `_disposed = true`; (2) Dispose calls StopWatching which sets `EnableRaisingEvents = false`; (3) a thread-pool thread already executing `OnFileEvent → QueueChange` acquires `_lock` and calls `_debounceTimer.Start()`; (4) Dispose calls `_debounceTimer.Dispose()` — or vice-versa, Dispose disposes the timer before step 3 completes — producing an `ObjectDisposedException`. The fix is either: (a) check `if (_disposed) return;` inside `QueueChange`'s `lock(_lock)` block, and take `lock(_lock)` in `Dispose()` before calling `_debounceTimer.Dispose()`; or (b) use a try/catch around `_debounceTimer.Start()` for `ObjectDisposedException`. The comment claiming the design "avoids the race of disposing a timer mid-Elapsed" refers only to the old per-event timer being disposed while its Elapsed handler ran — it does not address the dispose-vs-Start race the finding describes.

---

### 5. 🟡 MEDIUM — EvictOldestIfOverLimit runs unsynchronized from multiple fire-and-forget callers; concurrent evictions over-delete the cache

- **Location:** `Backend/TagFusion/Services/ThumbnailService.cs:424, 534, 542-616`
- **Lens:** backend-concurrency · **Category:** concurrency · **Verifier confidence:** high

**What:** EvictOldestIfOverLimit is launched as `_ = Task.Run(EvictOldestIfOverLimit, ...)` from both SaveToCacheAsync (line 534, hit once per thumbnail saved) and now also GetFullImageAsync (line 424). During batch thumbnail generation many thumbnails are written in parallel, so several eviction passes can execute simultaneously with no mutual-exclusion guard. Each pass independently enumerates the directory, sums total size, and deletes files down to its own local view of 80% of the limit. Because they delete overlapping/disjoint files concurrently while each tracks only its own decremented `totalSize`, the passes collectively over-evict (deleting well below the 80% target), and they also race on file.Delete() of the same path (handled only as best-effort per-file). This widens a pre-existing fire-and-forget pattern that the new GetFullImageAsync call site makes more frequent (lightbox preload of ±N images).

**Evidence:**
```
if (_maxCacheSizeBytes > 0) _ = Task.Run(EvictOldestIfOverLimit, CancellationToken.None);  // two callers, no guard against concurrent runs
```

**Fix:** Serialize eviction with a `SemaphoreSlim(1,1)` using non-blocking acquisition (`if (!_evictLock.Wait(0)) return;`) so at most one eviction runs at a time and overlapping triggers are coalesced rather than stacking and over-deleting.

**Verified:** The code confirms the finding exactly. There is no SemaphoreSlim or any other mutual-exclusion guard in the class (fields at lines 22–62 contain only two ConcurrentDictionaries and scalar fields — no eviction lock). EvictOldestIfOverLimit is launched fire-and-forget via `_ = Task.Run(EvictOldestIfOverLimit, CancellationToken.None)` from both SaveToCacheAsync (line 534, called once per thumbnail write during batch generation) and GetFullImageAsync (line 424, called per lightbox preload). The eviction body (lines 542–619) enumerates the directory into a local list, sums sizes into a local `totalSize`, and decrements that local variable as it deletes files. Each concurrent invocation has its own independent local view. With N concurrent passes all starting when the cache is, say, 110% full, each independently decides it needs to evict down to 80% and deletes approximately 30% worth of files from its own snapshot. Collectively they can delete 30% × N of the cache. The over-eviction is real, not speculative. The per-file IOException catch at line 601 handles the case where two passes race to delete the same file (one silently swallows the error), but that does not prevent the over-eviction of distinct files. The fix — a `SemaphoreSlim(1,1)` with non-blocking `Wait(0)` so excess concurrent triggers coalesce into a single pass — is the standard pattern prescribed by the CLAUDE.md convention (SemaphoreSlim for thread safety, never lock).

---

### 6. 🟡 MEDIUM — Lock-free GetAllTagsAsync fast path races with SaveTagLibraryAsync mutating the shared list

- **Location:** `Backend/TagFusion/Services/TagService.cs:76-82`
- **Lens:** backend-correctness · **Category:** concurrency · **Verifier confidence:** high

**What:** A new lock-free fast path returns the shared mutable _cachedTags instance without taking _semaphore. SaveTagLibraryAsync calls _cachedTags.Clear() (line 170) while holding the semaphore. Because the fast-path reader bypasses the semaphore and hands out the live List<Tag> reference, a concurrent save can Clear() the same list a caller is iterating, causing InvalidOperationException ('Collection was modified') or returning a transiently empty list. The bridge serves tags concurrently with tag-library saves, so this is reachable. Reassignment of _cachedTags under lock (line 122) does not protect callers already holding the old reference being Clear()'d.

**Evidence:**
```
if (_cachedTags.Count > 0 && File.Exists(_tagFilePath)
    && File.GetLastWriteTime(_tagFilePath) <= _lastLoadTime)
{
    return _cachedTags;
}
```

**Fix:** Have SaveTagLibraryAsync replace the reference (_cachedTags = new()) instead of mutating via Clear(), and/or return a snapshot copy from the fast path. Treat _cachedTags as immutable-once-published so lock-free reads are safe.

**Verified:** The fast-path in GetAllTagsAsync (lines 78-82) returns the shared _cachedTags List<Tag> instance directly, without acquiring _semaphore and without making a copy. SaveTagLibraryAsync (line 170) calls _cachedTags.Clear() while holding the semaphore. These two operations are not mutually exclusive: a caller that received the reference from the fast path and is iterating it can have the list mutated under it by a concurrent save, causing InvalidOperationException ('Collection was modified') or transiently observing an empty list. The _cachedTags = new list assignment at line 122 inside GetAllTagsAsync does not help because SaveTagLibraryAsync uses .Clear() on the original instance rather than replacing the field. The bridge dispatches concurrent requests, so a tag-grid load and a tag-library save arriving simultaneously is a realistic scenario, making this reachable in production. The fix is to replace _cachedTags.Clear() with _cachedTags = new List<Tag>() in SaveTagLibraryAsync (so existing holders keep their now-stale but undamaged snapshot), and optionally return a defensive copy from the fast path.

---

### 7. 🟡 MEDIUM — WriteTagsBatchAsync: a single backup failure fails the entire chunk even though no write occurred

- **Location:** `Backend/TagFusion/Services/ExifToolService.cs:251-286`
- **Lens:** backend-correctness · **Category:** bug · **Verifier confidence:** high

**What:** The per-file backup loop runs inside the same try that wraps the ExifTool write. FileBackupService.CreateBackupAsync rethrows on any failure (e.g. backup disk full, permission error, or a file exceeding... actually oversize is only logged, but Open/Copy errors throw). If backing up file #3 of a 50-file chunk throws, the catch marks ALL 50 paths as failed=false and skips the write entirely — even files that were never attempted. The caller sees a total batch failure caused purely by the safety-backup mechanism, not by the actual tag write. With backups enabled by default (BackupSettings.Enabled=true), one unbackup-able file blocks tagging of its whole batch.

**Evidence:**
```
foreach (var path in chunk)
    await _backupService.CreateBackupAsync(path, "metadata-tags-batch-write", cancellationToken);

var output = await RunExifToolAsync(args, cancellationToken);
```

**Fix:** Back up files individually with per-file try/catch (or make backup best-effort and not fail the write), so a backup error for one file does not abort the ExifTool write for the rest of the chunk.

**Verified:** The finding is confirmed by the source code. In ExifToolService.cs lines 251-286, the backup loop (`foreach (var path in chunk) await _backupService.CreateBackupAsync(...)`) runs inside the same `try` block that wraps `RunExifToolAsync`. In FileBackupService.cs lines 89-93, `CreateBackupAsync` has `catch (Exception ex) when (ex is not OperationCanceledException) { _logger.LogError(...); throw; }` — it rethrows on any I/O failure (disk full, permission denied, etc.). If backing up any single file throws, execution jumps to the outer `catch (Exception ex)` at line 281, which bulk-marks every path in the entire chunk as `result[path] = false` and skips `RunExifToolAsync` entirely. This means one unbackup-able file (e.g., backup disk full or a permission error on the backup directory) silently reports all 50 files in the chunk as tag-write failures, when in fact no write was attempted. Since `BackupSettings.Enabled=true` by default, this is a realistic failure mode on any path where the backup destination is unavailable.

---

### 8. 🟡 MEDIUM — WriteTagsBatchAsync per-path error attribution is substring-based and mis-attributes overlapping paths

- **Location:** `Backend/TagFusion/Services/ExifToolService.cs:263-275`
- **Lens:** backend-correctness · **Category:** bug · **Verifier confidence:** high

**What:** Failure attribution scans each 'Error:' line for any chunk path via line.IndexOf(path). If two files in the same chunk have paths where one is a prefix/substring of another (e.g. C:\a\img.jpg and C:\a\img.jpg.bak, or C:\photo\1.jpg and C:\photo\10.jpg under partial matching), an error for one path will also mark the other as failed, or vice-versa. Additionally, if ExifTool emits a fatal/global error line that contains no path at all, failedPaths stays empty and every file in the chunk is reported success=true despite the write having failed. Both directions corrupt the success/failure map returned to the UI.

**Evidence:**
```
foreach (var path in chunk)
{
    if (line.IndexOf(path, StringComparison.OrdinalIgnoreCase) >= 0)
        failedPaths.Add(path);
}
```

**Fix:** Prefer ExifTool's own per-file accounting: parse the '<n> image files updated' / 'files weren't updated' summary, or run with -execute per file when correctness of per-file status matters. At minimum, treat a chunk with any unattributable Error line as all-failed rather than all-succeeded, and match whole-path tokens rather than substrings.

**Verified:** The code at lines 263-275 of Backend/TagFusion/Services/ExifToolService.cs confirms both vulnerabilities described in the finding.

**Prong 1 — substring mis-attribution is real.** The loop does `line.IndexOf(path, StringComparison.OrdinalIgnoreCase) >= 0`. Because paths in a chunk can be prefixes of each other (e.g. `C:\photo\1.jpg` is a substring of `C:\photo\10.jpg`), an error line for the longer path will also match the shorter path, incorrectly adding it to `failedPaths`. Conversely, if a file with a longer path name fails, the shorter prefix path also gets marked failed.

**Prong 2 — unattributable global error lines silently succeed.** `LineIndicatesError` (line 740) returns true for any line starting with "Error:". If ExifTool emits a global fatal error such as `Error: Unknown option -Keywords` (no filepath in the line), no path in the chunk matches `line.IndexOf(path)`, `failedPaths` remains empty, and the loop at line 274-275 marks every file in the chunk as `result[path] = true` — reporting success for a write that entirely failed. This is the more dangerous of the two bugs: a batch write that fails completely due to bad arguments or a process issue would silently appear to the UI as all-succeeded.

Both bugs are directly and unambiguously present in the new code introduced in this changeset. The severity assessment of medium is appropriate: the substring mis-attribution requires a specific naming collision to trigger, and the global-error silent-success requires ExifTool to emit an unattributed error line (which does happen on option errors, corrupted binaries, or OS-level failures). Neither is on the every-call hot path, but when triggered, they corrupt the success/failure map returned to the UI and could leave image metadata in an unknown state.

---

### 9. 🟡 MEDIUM — Three locale copies now diverge in role: src/locales is bundled, public/locales+wwwroot/locales are unused but still hand-maintained

- **Location:** `Frontend/src/i18n.ts:9-14`
- **Lens:** conventions-i18n · **Category:** i18n · **Verifier confidence:** high

**What:** i18n.ts was changed to import the bundled translations from './locales/' (the NEW Frontend/src/locales/) instead of '../public/locales/'. Vite statically bundles these JSON files into JS chunks (de inline, en via dynamic import). There is no i18next-http-backend dependency and no loadPath/fetch of '/locales/*.json' anywhere in src (verified: only i18n.ts references locales). Therefore Frontend/public/locales/ is now the source of truth for nothing at runtime, yet Vite's copyPublicDir (default true) still copies public/locales/ into dist/locales/, and sync-wwwroot.mjs then copies dist/* into Backend/TagFusion/wwwroot/, so wwwroot/locales/ keeps getting produced and is even committed to git (git ls-files shows wwwroot/locales/de|en/common.json tracked, and this changeset hand-edits all three copies). Net effect: src/locales/ (real runtime source) and public/locales/ (shipped as loose, never-fetched files) are two independent copies a developer must keep in sync, with zero tooling enforcement. They are byte-identical right now (md5 confirmed for all three de and all three en files), so nothing is broken today, but the next edit to only one copy will silently desync, and because public/locales is never read an out-of-date public/locales would not even surface as a bug, masking the drift.

**Evidence:**
```
import deCommon from './locales/de/common.json';  // was '../public/locales/de/common.json'
```

**Fix:** Pick one source of truth and remove the duplication. Either delete Frontend/public/locales/ entirely (and stop committing wwwroot/locales/) since the bundled src/locales/ is now authoritative and the loose files are never fetched; or if loose runtime files are intentionally desired, keep public/locales as the single source and have src/locales import from it (or generate one from the other in a build step). At minimum add a build/test check asserting src/locales and public/locales have identical keys so they cannot silently diverge.

**Verified:** The finding is confirmed by direct code inspection. `Frontend/src/i18n.ts` (lines 9-14 in the diff) was changed to import from `./locales/de/common.json` and `./locales/en/common.json` (new untracked files under `Frontend/src/locales/`), replacing the previous imports from `../public/locales/`. There is no `i18next-http-backend` dependency and no `loadPath` anywhere; the `lazyLocaleLoaders` map only references `./locales/en/common.json`. So `Frontend/src/locales/` is the sole runtime source.

However, `Frontend/public/locales/de/common.json` and `en/common.json` are still tracked (`git ls-files` confirms), and this changeset edits them in parallel with the new `src/locales/` files. Vite's default `copyPublicDir: true` copies `public/locales/` into `dist/locales/` on every build, and `sync-wwwroot.mjs` then copies the whole `dist/` tree into `Backend/TagFusion/wwwroot/`, so `wwwroot/locales/` is also tracked and stays current. MD5 hashes confirm all three copies are byte-identical right now, but there is no build-time check enforcing this. The next developer to add a translation key to only `src/locales/` (the real runtime file) while forgetting `public/locales/` will cause silent divergence with no visible bug, because the loose files under `wwwroot/locales/` are never fetched by the runtime. The finding is real and the severity assessment (medium) is appropriate: no data loss today but a maintenance trap with no guard.

---

### 10. 🟡 MEDIUM — Lightbox navigates a different (unsorted/unfiltered) list than the grid displays

- **Location:** `Frontend/src/components/images/ImageGrid.tsx:129-138, 212-215`
- **Lens:** frontend-correctness · **Category:** bug · **Verifier confidence:** high

**What:** ImageGrid syncs the lightbox via setLightboxImages(activeImageList), where activeImageList is the raw store list (storeImages) or raw searchResults — NOT the filtered+sorted list that is actually rendered (displayImages / filteredAndSortedItems). ImageCard opens the lightbox with openLightbox(image) (no list), so the lightbox falls back to this raw list. The lightbox correctly recomputes the start index by path, but next/previous and the 'X / N' counter then walk a list whose ORDER and CONTENTS differ from the grid whenever a sort other than the backend order is active, a rating/tag filter is applied, or global-search results are sorted. Note this changeset explicitly made global search 'honor the sort/filter controls' for display (filterAndSortGridItems), but left the lightbox list on the raw searchResults, so the divergence is now more visible. The grid's own arrow-key navigation (line 327-347) uses displayImages, creating two different navigation orders for the same images.

**Evidence:**
```
const activeImageList = useMemo(() => { if (isGlobalSearch) return searchResults; return storeImages; }, ...); ... setLightboxImages(activeImageList);  // but rendered list is `displayImages` (filtered+sorted)
```

**Fix:** Sync the lightbox with the same list the grid renders. Build the display image list (the imageData of filteredAndSortedItems, i.e. displayImages) and pass that to setLightboxImages, so lightbox order/index and arrow-key grid navigation share one source of truth.

**Verified:** The code at lines 129-138 of ImageGrid.tsx confirms the bug exactly as described. `activeImageList` is either the raw `searchResults` or raw `storeImages` — neither has been passed through `filterAndSortGridItems`. The `useEffect` at lines 136-138 syncs this unfiltered, unsorted list to the lightbox store via `setLightboxImages(activeImageList)`. Meanwhile `displayImages` (lines 212-215) is derived from `filteredAndSortedItems` (which IS filtered and sorted) and is used for arrow-key navigation (lines 327-347). The two lists will diverge any time a rating filter, tag filter, or non-default sort order is active, and even more so after this changeset, which explicitly made global search honor sort/filter controls for `filteredAndSortedItems` while leaving the lightbox sync on the raw `searchResults`. A user who sorts by rating, opens an image in the lightbox, and presses Next will navigate to a different image than the one that appears next in the grid.

---

### 11. 🟡 MEDIUM — Tag import writes metadata to arbitrary absolute paths from an untrusted data file (no path validation)

- **Location:** `Backend/TagFusion/Services/TagExportService.cs:223-243`
- **Lens:** security · **Category:** security · **Verifier confidence:** high

**What:** ImportTagsFromCsvAsync and ImportTagsFromJsonAsync feed entries into ApplyImportedTagsAsync, which takes entry.Path verbatim from the imported file and calls _exifToolService.WriteTagsAsync / WriteRatingAsync on it. The only check is File.Exists(entry.Path) — there is no ValidatePath / root confinement. Importing a maliciously crafted .csv or .json (a realistic 'open this shared tag file' scenario) therefore lets the file's author pick any absolute path on disk (e.g. C:\Windows\... or another user's images) and have TagFusion overwrite that file's EXIF/IPTC/XMP metadata. This bypasses the system-directory protection that FileOperationService.ValidatePath enforces for copy/move/delete. Because metadata writes mutate the target file in place (-overwrite_original) with no undo, this can silently corrupt or alter files outside the intended image set.

**Evidence:**
```
var path = parts[0].Trim(); ... entries.Add(new TagExportEntry { Path = path, ... });  // then: if (!File.Exists(entry.Path)) {...} var success = await _exifToolService.WriteTagsAsync(entry.Path, entry.Tags);
```

**Fix:** Validate every imported entry.Path before writing: reject control chars, resolve Path.GetFullPath, and confine to an allowed root (e.g. the currently-open folder or a caller-supplied base directory) and/or reuse FileOperationService.ValidatePath to block system directories. Optionally restrict to supported image extensions.

**Verified:** The finding is confirmed by direct code inspection. In `Backend/TagFusion/Services/TagExportService.cs`, `ApplyImportedTagsAsync` (lines 223-271) accepts paths verbatim from the imported CSV or JSON data. The only guard is `File.Exists(entry.Path)` at line 232 — there is no call to `ValidatePath`, no root confinement, and no extension check. Both `_exifToolService.WriteTagsAsync(entry.Path, entry.Tags)` (line 239) and `_exifToolService.WriteRatingAsync(entry.Path, entry.Rating)` (line 242) subsequently invoke ExifTool with `-overwrite_original` on that path, which mutates the target file in-place with no undo.

The contrast with `FileOperationService` is sharp: `ValidatePath` (lines 309-335) blocks control characters and system directories (`C:\Windows`, `C:\Program Files`, etc.), but it is a `private static` method in `FileOperationService` — not shared with `TagExportService`. So a crafted import file placing an absolute path (e.g., `C:\Users\OtherUser\Documents\important.jpg` or any image the OS user has write access to) would pass the `File.Exists` check and receive an ExifTool metadata write.

The severity is medium rather than critical because: (1) the attack requires user interaction (the victim must manually import a crafted `.csv`/`.json` file through the UI), (2) the damage is limited to EXIF/IPTC/XMP metadata corruption — not arbitrary code execution — and ExifTool's own error handling limits writes to recognized image formats, (3) the OS user's normal permissions still apply, so truly sensitive system files (executables, `.dll`, etc.) would typically be rejected by ExifTool as unsupported file types rather than silently corrupted. Nonetheless, a crafted import file from an untrusted source can silently overwrite metadata on any image file outside the user's intended working set, which is a real, triggerable path corruption issue for a "share your tag library" scenario.

---

### 12. ⚪ LOW — EvictOldestIfOverLimit blocks a thread-pool thread on synchronous DB sync-over-async (GetAwaiter().GetResult)

- **Location:** `Backend/TagFusion/Services/ThumbnailService.cs:571, 612`
- **Lens:** backend-concurrency · **Category:** concurrency · **Verifier confidence:** high

**What:** Inside the background eviction (already on a Task.Run thread, no SynchronizationContext so it will not deadlock) the code blocks synchronously on two async DB calls: `db.GetOldestThumbnailKeysAsync(int.MaxValue).GetAwaiter().GetResult()` and `db.ForgetThumbnailAccessAsync(evictedKeys).GetAwaiter().GetResult()`. These acquire the DatabaseService read/write semaphores; under heavy thumbnail load multiple such blocked threads can pile up on the thread pool while also contending with the per-cache-hit fire-and-forget TouchThumbnailAccessAsync writes. It is not a deadlock (no captured context), but it is sync-over-async thread-pool starvation pressure and `int.MaxValue` pulls the entire ThumbnailAccess table into memory each pass.

**Evidence:**
```
orderedKeys = db.GetOldestThumbnailKeysAsync(int.MaxValue).GetAwaiter().GetResult();   ...   db.ForgetThumbnailAccessAsync(evictedKeys).GetAwaiter().GetResult();
```

**Fix:** Make EvictOldestIfOverLimit async (`private async Task`) and `await` the DB calls; the callers already use `_ = Task.Run(...)`, so awaiting fits naturally. Bound the GetOldestThumbnailKeysAsync limit instead of int.MaxValue.

**Verified:** The code at Backend/TagFusion/Services/ThumbnailService.cs confirms both sync-over-async calls exactly as described. `EvictOldestIfOverLimit` is declared `private void` (line 542) and is dispatched via `_ = Task.Run(EvictOldestIfOverLimit, CancellationToken.None)` (line 534). Inside, line 561 calls `db.GetOldestThumbnailKeysAsync(int.MaxValue).GetAwaiter().GetResult()` and line 611 calls `db.ForgetThumbnailAccessAsync(evictedKeys).GetAwaiter().GetResult()`. Both DB methods acquire semaphores via `WaitAsync` (confirmed in the diff: `_readSemaphore.WaitAsync` and `_writeSemaphore.WaitAsync`). There is no SynchronizationContext on the Task.Run thread so deadlock is not possible, but: (1) each eviction pass blocks a thread-pool thread while awaiting semaphore + async SQLite I/O, (2) `int.MaxValue` as the LIMIT pulls the entire ThumbnailAccess table into memory on every eviction check, and (3) concurrent cache-hit fire-and-forget `TouchThumbnailAccessAsync` writes contend on the same `_writeSemaphore`. The fix described in the recommendation (make the method `async Task` and `await` the DB calls, and bound the query limit) is correct. The severity of `low` is appropriate since there is no deadlock and eviction is infrequent under normal use.

---

### 13. ⚪ LOW — EvictOldestIfOverLimit blocks on async DB calls via GetAwaiter().GetResult()

- **Location:** `Backend/TagFusion/Services/ThumbnailService.cs:560-612`
- **Lens:** backend-correctness · **Category:** concurrency · **Verifier confidence:** high

**What:** Eviction is launched via Task.Run(EvictOldestIfOverLimit) (fire-and-forget) and then synchronously blocks a thread-pool thread on db.GetOldestThumbnailKeysAsync(int.MaxValue).GetAwaiter().GetResult() and db.ForgetThumbnailAccessAsync(...).GetAwaiter().GetResult(). These DB methods acquire _readSemaphore/_writeSemaphore. Meanwhile every cache hit fire-and-forgets TouchThumbnailAccessAsync (also _writeSemaphore). Under heavy scrolling this serializes a blocking call behind a stream of writes and ties up pool threads. It will not deadlock in production (separate read/write connections), but GetOldestThumbnailKeysAsync(int.MaxValue) also materializes the entire access table into a List<string> just to evict down to 80%, which is wasteful for large caches.

**Evidence:**
```
orderedKeys = db.GetOldestThumbnailKeysAsync(int.MaxValue).GetAwaiter().GetResult();
```

**Fix:** Make EvictOldestIfOverLimit async (await the DB calls) since it already runs on a Task. Bound the query (e.g. fetch only enough oldest keys to reach the target) instead of int.MaxValue.

**Verified:** The code at ThumbnailService.cs lines 542 and 561/611 directly confirms the finding. EvictOldestIfOverLimit is a synchronous void method launched fire-and-forget via Task.Run (lines 424 and 534). Inside it, db.GetOldestThumbnailKeysAsync(int.MaxValue).GetAwaiter().GetResult() (line 561) and db.ForgetThumbnailAccessAsync(evictedKeys).GetAwaiter().GetResult() (line 611) both block a thread-pool thread synchronously on async DB calls. The int.MaxValue argument also materializes the entire access table into a List when only enough oldest entries to reach the 80% target are needed. The severity is correctly assessed as low: since this is already on a Task.Run thread (not an ASP.NET synchronization context), deadlock cannot occur. The wasteful thread-pool blocking and full-table query are real inefficiencies, not phantom issues.

---

### 14. ⚪ LOW — updateBatchTag (a write action) added to RETRYABLE_ACTIONS labeled 'idempotent reads'

- **Location:** `Frontend/src/services/bridge.ts:85-108`
- **Lens:** bridge-contract · **Category:** contract · **Verifier confidence:** high

**What:** This changeset adds BRIDGE_ACTIONS.UPDATE_BATCH_TAG to RETRYABLE_ACTIONS, whose doc comment states 'Actions that are safe to retry (idempotent reads)'. updateBatchTag is not a read — it writes EXIF/IPTC/XMP metadata to files via ExifTool (TagHandler.UpdateBatchTagAsync add/remove). The retry only fires on a 120s 'Request timeout', so if the backend actually completed but the response was slow, the entire batch is re-executed, causing redundant ExifTool writes (and redundant per-file 'batchProgress' events). The final state is idempotent for add/remove with dedup, so this is not corruption, but it contradicts the documented invariant and re-does file writes the user already paid for. exportTagsXmp (also a write, sidecar files) was correctly left OUT of the set, making updateBatchTag's inclusion inconsistent.

**Evidence:**
```
/** Actions that are safe to retry (idempotent reads) */
  private static readonly RETRYABLE_ACTIONS = new Set<BridgeActionName>([ ... BRIDGE_ACTIONS.UPDATE_BATCH_TAG, ]);
```

**Fix:** Either remove UPDATE_BATCH_TAG from RETRYABLE_ACTIONS (treat writes as non-retryable like writeBatchTags/writeTags/setRating), or update the comment to 'idempotent operations' and confirm the backend tolerates duplicate execution. Given the 'idempotent reads' wording, removing it is the lower-risk choice.

**Verified:** The finding is confirmed by direct code inspection. In the diff, `BRIDGE_ACTIONS.UPDATE_BATCH_TAG` was newly added to `RETRYABLE_ACTIONS` in this changeset (Frontend/src/services/bridge.ts line 107), alongside the doc comment "Actions that are safe to retry (idempotent reads)" at line 85. The backend `UpdateBatchTagAsync` (TagHandler.cs lines 90-135) calls `_exifToolService.WriteTagsAsync` (line 116) and `_databaseService.SaveImageAsync` (line 122) — it is a file-writing, database-writing operation, not a read. On a 120s timeout + retry, the entire batch of ExifTool writes would be re-executed. The final state is idempotent (add with dedup, remove with equality check) so no data corruption occurs, which keeps severity at low rather than higher. One factual inaccuracy in the finding's framing: it claims `exportTagsXmp` "was correctly left OUT" of RETRYABLE_ACTIONS, but the diff shows `EXPORT_TAGS_XMP` was also added to the set in this same changeset (line 104). That inconsistency doesn't change the verdict on `UPDATE_BATCH_TAG` itself — the inclusion of a write action under an "idempotent reads" comment is a real documentation/semantic mismatch that could mislead future maintainers about retry safety of other write operations.

---

### 15. ⚪ LOW — saveTagLibrary reads payload via indexer instead of GetValueOrDefault

- **Location:** `Backend/TagFusion/Bridge/Handlers/TagHandler.cs:46`
- **Lens:** bridge-contract · **Category:** bug · **Verifier confidence:** high

**What:** saveTagLibrary uses payload?["library"] (dictionary indexer). If a message arrives with a non-null payload that lacks the 'library' key, this throws KeyNotFoundException, which is then caught by the generic handler and surfaced as the opaque German 'Ein unerwarteter Fehler ist aufgetreten.' Every other handler in this changeset reads optional keys defensively via PayloadHelper.GetString / payload.GetValueOrDefault(...). The current frontend always sends { library }, so this is not reachable today, but it is an inconsistency that turns a malformed payload into an unexpected-error toast instead of a clean no-op.

**Evidence:**
```
"saveTagLibrary" => await _tagService.SaveTagLibraryAsync(payload?["library"] ?? new object()),
```

**Fix:** Use payload?.GetValueOrDefault("library") ?? new object() to match the defensive pattern used everywhere else (PayloadHelper.* / GetValueOrDefault).

**Verified:** Line 46 of TagHandler.cs reads `payload?["library"]`. The null-conditional operator only guards against `payload` being null; it does not protect against a missing key in a non-null Dictionary<string,object>. If a caller sends a non-null payload that lacks the "library" key, `payload["library"]` throws KeyNotFoundException, which is caught by the generic handler and surfaces as an opaque error toast. All other handlers in this file use `payload.GetValueOrDefault(...)` or `PayloadHelper.*` for defensive key access. The inconsistency is genuine and the throw path is reachable by any malformed bridge message. The finding is correct; severity is low because the current frontend always sends the key.

---

### 16. ⚪ LOW — Generated build artifact wwwroot/locales/common.json is tracked in git and hand-edited

- **Location:** `Backend/TagFusion/wwwroot/locales/de/common.json:1-139`
- **Lens:** conventions-i18n · **Category:** convention · **Verifier confidence:** high

**What:** Backend/TagFusion/wwwroot/ is populated by the frontend build (sync-wwwroot.mjs recreates wwwroot from dist on every build:desktop, and .gitignore explicitly treats wwwroot as build output by ignoring wwwroot/assets/ with the comment 'copied into wwwroot by build_release.ps1 / sync:wwwroot'). wwwroot/locales/de|en/common.json are derived from public/locales via copyPublicDir, yet they are tracked in git and were modified in this changeset (git status shows both as modified). Committing a generated copy means one more place that must be manually kept in sync with the source and will produce noisy/conflicting diffs. It is consistent only by luck right now (md5 identical to public/locales).

**Evidence:**
```
.gitignore ignores 'Backend/TagFusion/wwwroot/assets/' but NOT wwwroot/locales/, which is equally build-generated
```

**Fix:** Treat wwwroot/locales/ the same as wwwroot/assets/: add it to .gitignore (or ignore all of wwwroot except the committed index.html) so the generated locale files are not hand-edited or committed. The authoritative edit should happen in the chosen source folder only.

**Verified:** The finding is confirmed. `Frontend/scripts/sync-wwwroot.mjs` calls `recreateDirectory(wwwrootDir)` followed by `copyDirectoryContents(distDir, wwwrootDir)`, which deletes the entire `Backend/TagFusion/wwwroot/` directory and repopulates it from the Vite `dist/` output on every `build:desktop` run. The locale files under `wwwroot/locales/` are therefore 100% build-generated artifacts — Vite copies them from `Frontend/public/locales/` via `copyPublicDir` during the build.

The `.gitignore` excludes `Backend/TagFusion/wwwroot/assets/` (the hashed JS bundles) with the comment "Hashed Dateinamen aendern sich bei jedem Build", but does NOT exclude `wwwroot/locales/`, creating an inconsistency. Both `Backend/TagFusion/wwwroot/locales/de/common.json` and `Backend/TagFusion/wwwroot/locales/en/common.json` are tracked in git (`git ls-files` confirms), and the current diff shows them modified in this changeset with changes **identical** to the source `Frontend/public/locales/de/common.json`.

The actual risk: if a developer edits only the `wwwroot/locales/` copy (believing it is the canonical source), the next `build:desktop` run will silently overwrite that edit. Conversely, committing both creates noisy duplicate diffs. The two copies are in sync right now only because they were edited together — there is no build-time enforcement. The correct fix is to add `Backend/TagFusion/wwwroot/locales/` (or all of `wwwroot/` except `index.html`) to `.gitignore`, matching the treatment of `wwwroot/assets/`.

---

### 17. ⚪ LOW — Optimistic-update error revert clobbers concurrent in-flight tag/rating updates

- **Location:** `Frontend/src/stores/slices/imageSlice.ts:188-244`
- **Lens:** frontend-correctness · **Category:** concurrency · **Verifier confidence:** high

**What:** updateImageTags/updateImageRating/addTagToImages/removeTagFromImages each capture a full prevImages/prevGridItems snapshot, apply an optimistic set, and on bridge failure restore the captured snapshot wholesale. If a second optimistic mutation (on any image) is dispatched before the first resolves and the first then FAILS, the revert restores a snapshot that predates the second mutation, silently discarding the second (still-pending or already-applied) optimistic change. Single-image updates back-to-back on a flaky bridge can lose edits.

**Evidence:**
```
const { images: prevImages, gridItems: prevGridItems } = get(); ... set({ images: updatedImages, ... }); try { await bridge.writeTags(...) } catch { set({ images: prevImages, gridItems: prevGridItems }); ... }
```

**Fix:** On error, revert by re-deriving from current state (e.g. remove just the failed tag / restore just the failed image's rating from the captured value) instead of replacing the whole images/gridItems arrays with a stale snapshot.

**Verified:** The code in Frontend/src/stores/slices/imageSlice.ts lines 188-244 exactly matches the described pattern. All four functions (updateImageTags, updateImageRating, addTagToImages, removeTagFromImages) capture a full `prevImages`/`prevGridItems` snapshot before applying an optimistic update, then restore that entire stale snapshot wholesale on bridge failure. If a second optimistic mutation is applied to state after the first snapshot was taken but before the first bridge call rejects, the failure-path `set({ images: prevImages, gridItems: prevGridItems })` overwrites the second mutation entirely — it never appears in the snapshot.

The finding is real and confirmed directly from the source. Severity is low (not medium/high) because: (1) bridge failures are uncommon for local/network filesystem operations; (2) the 120s bridge timeout makes the concurrent-mutation window long in theory but in practice users rarely chain mutations that quickly; (3) even if it occurs, the user sees an error toast and can re-apply their edit. There is no data loss at the file level — only UI state momentarily diverges from the server state. The recommended fix (revert by targeting only the affected image/tag from current state rather than replacing the whole array) is correct and would eliminate the issue.

---

### 18. ⚪ LOW — useThumbnail writes the cache (and IndexedDB) during render

- **Location:** `Frontend/src/hooks/useThumbnailManager.ts:307-310`
- **Lens:** frontend-correctness · **Category:** bug · **Verifier confidence:** high

**What:** useThumbnail calls cacheSet(imagePath, initialThumbnail) directly in the render body (before useSyncExternalStore). cacheSet mutates the module-level Map and triggers idbPut() (an async IndexedDB write). This is an impure side effect during render; with VirtuosoGrid mounting/unmounting cards on scroll and initialThumbnail = image.thumbnailBase64, it issues repeated IndexedDB writes on first render of each card. It does not loop (it is guarded by !cache.has and does not call notify), so it is not a crash, but it violates render purity and adds redundant IDB churn.

**Evidence:**
```
if (initialThumbnail && !cache.has(imagePath)) { cacheSet(imagePath, initialThumbnail); }  // runs during render; cacheSet → idbPut(...)
```

**Fix:** Seed the cache from initialThumbnail inside an effect (useEffect) or in requestThumbnail, not in the render body, so render stays pure and IDB writes only happen on commit.

**Verified:** The code at lines 308-310 of useThumbnailManager.ts is exactly as described. `useThumbnail` calls `cacheSet(imagePath, initialThumbnail)` directly in the render body (before any hooks), and `cacheSet` (lines 151-164) unconditionally calls `idbPut(key, value)` — an async IndexedDB write — whenever `value` is non-null. The guard `!cache.has(imagePath)` prevents it from firing on every re-render of the same card, but it still fires on the first render. With VirtuosoGrid mounting and unmounting cards on scroll, each newly-visible card with a pre-populated `initialThumbnail` will trigger an IndexedDB write during its initial render phase. This is an impure side effect during render: it mutates module-level state (the `Map`) and starts async I/O. It does not cause an infinite loop (no `notify()` call in this path) and is not a data-loss risk, so the severity remains low, but the finding is factually correct and confirmed directly from the source.

---

### 19. ⚪ LOW — Lightbox re-preloads ±3 full images on every background metadata update

- **Location:** `Frontend/src/components/lightbox/Lightbox.tsx:107-125`
- **Lens:** frontend-correctness · **Category:** bug · **Verifier confidence:** high

**What:** The adjacent-image preload effect depends on [isOpen, currentIndex, images]. The lightbox `images` array gets a brand-new reference whenever ImageGrid calls setLightboxImages(activeImageList), which happens on every storeImages change — including streamed background metadataUpdated events (uiSlice remaps images into a new array). So while the lightbox is open, each metadata batch re-runs this effect and re-issues up to 6 bridge.getFullImage() calls even though currentIndex/contents are unchanged. WebView2 caches the URLs so impact is bounded, but it is unnecessary work and bridge traffic.

**Evidence:**
```
useEffect(() => { ... preloadIndices.forEach((idx) => { const img = images[idx]; if (img?.path) bridge.getFullImage(img.path).catch(()=>{}); }); }, [isOpen, currentIndex, images]);
```

**Fix:** Depend on a stable key (e.g. images.length plus currentIndex, or the paths of the preload window) rather than the whole `images` array reference, so a new-but-equivalent array from a metadata refresh does not retrigger preloading.

**Verified:** The finding is confirmed by tracing the complete data flow through the code:

1. In `uiSlice.ts:168-210`, the `metadataUpdated` bridge event handler calls `images.map(...)` (always producing a new array reference) and calls `set({ images: updatedImages, ... })` only when `hasChanges === true` — meaning real tag/rating data changed.

2. `useImages()` in `appStore.ts:40` uses a standard Zustand selector with reference equality, so the new `images` array reference causes `ImageGrid` to re-render.

3. In `ImageGrid.tsx:129-138`, `activeImageList` is a `useMemo` that depends on `storeImages` — it recomputes because `storeImages` is now a new reference. The `useEffect` at lines 136-138 then calls `setLightboxImages(activeImageList)`, pushing the new-reference array into the lightbox store.

4. In `Lightbox.tsx:107-125`, the preload `useEffect` has `images` in its dependency array (`[isOpen, currentIndex, images]`). Since `images` is now a new array reference (even though the paths at `currentIndex ± 3` may be identical), React re-runs the effect and re-issues up to 6 `bridge.getFullImage()` calls.

The finding is real. The severity is correctly classified as `low` because: (a) the code comment at lines 103-106 explicitly acknowledges that preloading is "essentially free" with virtual-host URLs since WebView2 caches the HTTP responses; (b) the `hasChanges` guard ensures the preload only re-fires when actual metadata changed, not on every arbitrary re-render; (c) there is no data loss, crash, or user-visible error. The unnecessary bridge round-trips are redundant work but harmless in practice given WebView2's HTTP caching. The recommendation to stabilize the dependency (e.g., use a derived key based on the paths of the preload window rather than the whole `images` reference) is sound but non-urgent.

---

### 20. ⚪ LOW — Metadata writes via bridge bypass the system-directory protection used for file operations

- **Location:** `Backend/TagFusion/Bridge/Handlers/TagHandler.cs:59-90`
- **Lens:** security · **Category:** security · **Verifier confidence:** high

**What:** FileOperationService.ValidatePath deliberately blocks copy/move/delete/rename into Windows, Program Files and Program Files (x86), and rejects control chars / null bytes. The writeBatchTags and updateBatchTag bridge actions, however, take payload 'paths' straight from the bridge and pass them to ExifToolService.WriteTagsBatchAsync / WriteTagsAsync (which only check File.Exists) with no equivalent validation. Protection of the real filesystem is therefore inconsistent: the same caller that is forbidden from moving a file into C:\Windows can still rewrite the metadata of an image already living there. Severity is held low because the bridge is served only the bundled local UI (https://tagfusion.local / localhost:5173), not remote content, so payloads are not directly attacker-controlled — but the asymmetry undermines the stated hardening intent.

**Evidence:**
```
var paths = PayloadHelper.GetStringArray(payload, "paths"); ... var results = await _exifToolService.WriteTagsBatchAsync(paths, tags);  // no ValidatePath, unlike FileOperationService
```

**Fix:** Apply the same path validation (control-char rejection + system-directory block, ideally a shared validator) to paths before metadata writes, so EXIF/IPTC/XMP writes honor the same root/system-dir restrictions as copy/move/delete.

**Verified:** The finding is confirmed directly from the source. FileOperationService.ValidatePath (Backend/TagFusion/Services/FileOperationService.cs lines 284-311) rejects control characters and blocks paths under C:\Windows, Program Files, and Program Files (x86) for copy/move/delete/rename/openInExplorer/getProperties. The new writeBatchTags and updateBatchTag bridge actions in TagHandler.cs call PayloadHelper.GetStringArray(payload, "paths") and pass the result straight to _exifToolService.WriteTagsBatchAsync (line ~70 of the diff) and _exifToolService.WriteTagsAsync (line ~117 of the diff) with no ValidatePath call. ExifToolService.WriteTagsBatchAsync at line 222 only filters via .Where(File.Exists) — no system-directory or control-character check. So the asymmetry is real: the same UI caller blocked from moving a file into C:\Windows can still instruct ExifTool to overwrite the EXIF/IPTC/XMP metadata of any image already residing in a system directory. The low severity rating is correctly calibrated because the WebView2 bridge is served exclusively from https://tagfusion.local or http://localhost:5173 (MainWindow.xaml.cs lines 184-209), not from remote content, so payloads are only reachable from the bundled local UI — no remote exploitation path exists. The finding is an accurate description of an intentional-looking hardening gap rather than an exploitable vulnerability in practice.

---

### 21. ⚪ LOW — New KeyboardShortcutsOverlay re-implements the shared isTextInputTarget check inline

- **Location:** `Frontend/src/components/common/KeyboardShortcutsOverlay.tsx:18-19`
- **Lens:** simplification · **Category:** simplification · **Verifier confidence:** high

**What:** This changeset introduces a shared util utils/keyboardTarget.ts::isTextInputTarget(target) and adopts it in both useKeyboardShortcuts.ts (line 14) and ImageGrid.tsx (line 330). The newly-added KeyboardShortcutsOverlay.tsx — created in the same changeset — instead hand-rolls the same guard: it checks tagName === 'INPUT'/'TEXTAREA' + isContentEditable but omits the contenteditable=""/"true" attribute branch that the shared util covers, so it is both duplicated and slightly weaker.

**Evidence:**
```
const tag = (e.target as HTMLElement)?.tagName;
if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;
```

**Fix:** Import and call isTextInputTarget(e.target) here, matching the other two keyboard handlers. Removes the duplication and gains the contentEditable-attribute coverage for free.

**Verified:** The inline guard at KeyboardShortcutsOverlay.tsx lines 18-19 is confirmed duplicated: the same changeset introduces isTextInputTarget in utils/keyboardTarget.ts and adopts it in both useKeyboardShortcuts.ts (line 14) and ImageGrid.tsx (line 330), yet the new component hand-rolls the check instead of calling the shared util. The duplication concern is real. However, the "slightly weaker" claim in the finding is factually incorrect: the DOM property element.isContentEditable already returns true for elements whose contenteditable attribute is "" or "true", so the shared util's explicit getAttribute branches add no extra coverage over the inline check — both guards are behaviourally equivalent. The finding is valid as a simplification/consistency issue (import and call isTextInputTarget rather than repeating the logic), but not because of any functional gap.

---

### 22. ⚪ LOW — Bridge contract tests verify action names but not that handlers actually dispatch them

- **Location:** `Backend/TagFusion.Tests/Bridge/BridgeContractTests.cs:10-16`
- **Lens:** tests-quality · **Category:** test · **Verifier confidence:** high _(reviewer said medium, verifier corrected to low)_

**What:** BridgeContractTests asserts the union of every handler's `_supported` HashSet equals bridge-actions.json (and bridgeContract.test.ts mirrors this for the frontend). WebViewBridge builds `_actionMap` from `SupportedActions` and routes to `handler.HandleAsync`, whose switch ends in `_ => throw new NotSupportedException(...)`. Nothing asserts that each action in a handler's `_supported` set has a matching switch case. A developer who adds an action to `_supported` + the JSON contract + bridge.ts (so all three contract tests stay green) but forgets the `HandleAsync` case ships an action that routes to the handler and throws at runtime → user gets an error toast. The contract suite is presented as the bridge safety net but leaves this realistic gap. Only 2 of 6 handlers (ExifToolHandlerTests, TagHandlerTests) have per-action dispatch tests.

**Evidence:**
```
Assert.That(handlerActions, Is.EquivalentTo(contractActions)); // names only — never invokes HandleAsync per action
```

**Fix:** Add a test that, for each handler, iterates `SupportedActions` and asserts `HandleAsync(action, null)` does NOT throw NotSupportedException (a benign payload or expecting a different exception type). This closes the 'in _supported but no switch case' gap that the name-equivalence check cannot catch.

**Verified:** The structural gap described in the finding is real and confirmed by the code. BridgeContractTests at lines 10-16 uses regex to extract string literals from `_supported` HashSet initializers across all `*Handler.cs` files, then asserts name-set equivalence against `bridge-actions.json`. This check never invokes `HandleAsync`. WebViewBridge.ProcessMessageAsync routes by looking up the action in `_actionMap` (built from `SupportedActions`) and calls `handler.HandleAsync(action, payload)`. Every handler's `HandleAsync` ends with `_ => throw new NotSupportedException(...)`. So if an action appears in `_supported` but lacks a switch case in `HandleAsync`, it routes successfully through the bridge, hits the default arm, and throws at runtime — the contract test stays green because it only checks string membership.

However, no current handler actually has this gap. All six handlers (ExifToolHandler, FileSystemHandler, TagHandler, ImageEditHandler, FileOperationHandler, UtilityHandler) have switch cases that exactly cover their `_supported` sets as verified by direct reading. The finding describes a future regression risk (a developer adding to `_supported` without a matching case), not a present bug.

The severity should be lowered to low rather than medium: the gap is a latent test-coverage weakness in the contract test suite, not a bug that exists today. The contract test suite is structurally incomplete — it could miss a broken action — but all current actions are correctly dispatched.

---

### 23. ⚪ LOW — Frontend contract-extraction regex can span method boundaries and silently miss call sites

- **Location:** `Frontend/src/services/bridgeContract.test.ts:18-22`
- **Lens:** tests-quality · **Category:** test · **Verifier confidence:** high

**What:** extractFrontendActions() uses `/this\.send[\s\S]*?\(\s*BRIDGE_ACTIONS\.([A-Z0-9_]+)/g`. Because `[\s\S]*?` is unbounded, a `this.sendWithRetry<T>(action, ...)` call whose argument is the variable `action` (not a literal) will match the NEXT literal `BRIDGE_ACTIONS.X` further down the file, attributing it to the wrong call. It currently yields the correct set only because all 35 actions also appear in direct `this.send<T>(BRIDGE_ACTIONS.X)` calls, so dedup masks the imprecision. If a future action were reachable ONLY via sendWithRetry/sendOnce with a parameterized action, the test could under-count and silently pass while the contract drifts. The C# side has the same shape but is anchored to the HashSet body so is safer.

**Evidence:**
```
const matches = bridgeSource.matchAll(/this\.send[\s\S]*?\(\s*BRIDGE_ACTIONS\.([A-Z0-9_]+)/g);
```

**Fix:** Tighten the pattern to a single statement, e.g. match `BRIDGE_ACTIONS\.([A-Z0-9_]+)` directly (the test only needs the set of referenced action keys), or restrict the gap with `[^;]*?` so it cannot cross statement boundaries.

**Verified:** The finding is confirmed. In `bridgeContract.test.ts` line 20, the regex `this\.send[\s\S]*?\(\s*BRIDGE_ACTIONS\.([A-Z0-9_]+)` uses an unbounded `[\s\S]*?` lazy quantifier that can cross statement and method boundaries. In `bridge.ts`, `this.send` (line 111) calls `this.sendWithRetry(action, ...)` with a variable — not a literal `BRIDGE_ACTIONS.X`. Because `sendWithRetry` also matches the prefix `this\.send`, the regex engine starts a match there and expands `[\s\S]*?` lazily until it finds the next `BRIDGE_ACTIONS.X` literal anywhere later in the file (e.g., in the `RETRYABLE_ACTIONS` Set on lines 87-108, or in one of the public API methods). Today this is masked because every action that appears in `RETRYABLE_ACTIONS` and in public method bodies is also directly referenced as `this.send<T>(BRIDGE_ACTIONS.X, ...)` elsewhere, so `new Set(...)` deduplication keeps the result correct. The latent risk is real: any future action reachable only via `sendWithRetry`/`sendOnce` with a variable argument (not a literal at the call site) would be silently under-counted, allowing the contract test to pass while the actual contract has drifted. The fix is straightforward — drop `this\.send[\s\S]*?\(` entirely and match `BRIDGE_ACTIONS\.([A-Z0-9_]+)` directly, since the test only needs the set of referenced action keys.

---

### 24. ⚪ LOW — useResizeHandle test never exercises the direction='left' branch

- **Location:** `Frontend/src/hooks/useResizeHandle.test.tsx:34-47`
- **Lens:** tests-quality · **Category:** test · **Verifier confidence:** high

**What:** The new hook computes `delta = direction === 'left' ? -diff : diff` (useResizeHandle.ts:34) — the sign flip is the core difference between a left-anchored and right-anchored handle, and the Sidebar/TagPanel use both directions. Both tests pass direction='right', so the left branch (sign inversion) is untested. A regression that drops the negation for left handles would not be caught.

**Evidence:**
```
fireEvent.pointerMove(document, { clientX: 500, pointerId: 1 }); ... expect(onWidthChange).toHaveBeenNthCalledWith(1, 400); // direction always 'right'
```

**Fix:** Add one case with direction='left' asserting that a rightward pointer move (positive diff) shrinks the width (delta negated), mirroring the existing clamp assertions.

**Verified:** Confirmed directly from source. The implementation in Frontend/src/hooks/useResizeHandle.ts line 34 computes `const delta = direction === 'left' ? -diff : diff;` — the negation for a left-anchored handle is the only behavioural difference between the two directions. Both test cases in useResizeHandle.test.tsx (lines 37 and 52) hard-code `direction="right"`, so the `direction === 'left'` branch (sign inversion) is never executed by the test suite. A regression that removed the negation — e.g., accidentally writing `diff` unconditionally — would leave all existing tests green. The TestResizeHandle helper already accepts a `direction` prop of type `'left' | 'right'`, making it trivial to add a covering case, so the gap is a straightforward omission rather than a design limitation.

---

### 25. 🔵 INFO — Orphaned/duplicated doc-comment left above ExportTagsAsXmpSidecarsAsync

- **Location:** `Backend/TagFusion/Services/TagExportService.cs:138-146`
- **Lens:** simplification · **Category:** simplification · **Verifier confidence:** high

**What:** The new XMP-sidecar method was inserted directly between ImportTagsFromCsvAsync's original XML doc comment and its method body. The result is two consecutive <summary> blocks: a stray 'Import tags from CSV string...' summary (138-141) immediately followed by the XMP method's own summary (142-146). The actual ImportTagsFromCsvAsync at line 200 is now left with no doc comment, while its old comment dangles above an unrelated method.

**Evidence:**
```
    /// Import tags from CSV string and write to images via ExifTool.
    /// Format: Path;Tags (comma-separated);Rating
    /// </summary>
    /// <summary>
    /// Write per-image XMP sidecar files ...
    public async Task<...> ExportTagsAsXmpSidecarsAsync(...)
```

**Fix:** Delete the orphaned 3-line 'Import tags from CSV' summary block at 138-141 (or move it back down to sit directly above ImportTagsFromCsvAsync at line 200).

**Verified:** Lines 138-146 of Backend/TagFusion/Services/TagExportService.cs confirm the finding exactly. There are two back-to-back `<summary>` XML doc blocks above `ExportTagsAsXmpSidecarsAsync`: the first (138-141) reads "Import tags from CSV string and write to images via ExifTool. Format: Path;Tags (comma-separated);Rating" and closes with `</summary>`, then immediately a second `<summary>` (142-146) begins with the XMP sidecar description. The C# compiler will treat the first block as dangling/orphaned since a method can only have one XML doc comment and the second overwrites it. Meanwhile `ImportTagsFromCsvAsync` at line 200 has no doc comment at all — confirming the old comment was left behind when the new method was inserted between it and its intended method body.

---

### 26. 🔵 INFO — Stale comment 'Reset functions are already available from useFilterSort()' precedes a hand-written reset

- **Location:** `Frontend/src/components/images/ImageGrid.tsx:248`
- **Lens:** simplification · **Category:** simplification · **Verifier confidence:** high

**What:** A leftover comment claims reset functions come from useFilterSort(), but the very next lines define handleResetFilters locally by calling setSearchQuery/setFilterRating/setFilterTags directly. The comment contradicts the code immediately below it and reads as a refactor remnant.

**Evidence:**
```
  // Reset functions are already available from useFilterSort() above

  const handleResetFilters = useCallback(() => {
    setSearchQuery('');
    setFilterRating(null);
    setFilterTags([]);
  }, [setSearchQuery, setFilterRating, setFilterTags]);
```

**Fix:** Remove the stale comment (or correct it). Pure documentation cleanup; no behavior change.

**Verified:** Line 248 of Frontend/src/components/images/ImageGrid.tsx reads `// Reset functions are already available from useFilterSort() above`. The very next four lines (250-254) define `handleResetFilters` as a `useCallback` that calls `setSearchQuery('')`, `setFilterRating(null)`, and `setFilterTags([])` directly — it does not delegate to any reset function from `useFilterSort()`. The comment is a refactor remnant that directly contradicts the code below it. It is a real stale comment, not a false positive.

---

## Refuted findings (checked and dropped)

These were raised by a reviewer but the verifier could not confirm them against the code. Listed so you know they were considered.

### R1. ~~Parallel.ForEach body cancellation may surface as AggregateException and be swallowed as a warning~~  (low, lens: backend-correctness)
- **Location:** `Backend/TagFusion/Services/FileSystemService.cs:213-258`
- **Why dropped:** The finding's scenario cannot occur in practice. The only source of OperationCanceledException inside the Parallel.ForEach body is line 224 (`parallelOptions.CancellationToken.ThrowIfCancellationRequested()`), which is outside the inner try/catch block and therefore thrown directly into Parallel.ForEach. When a body throws an OCE matching the ParallelOptions.CancellationToken, the .NET Parallel class propagates it as a bare OperationCanceledException (not wrapped in AggregateException), so the outer `catch (OperationCanceledException)` at line 250 correctly intercepts it and rethrows.

The inner `catch (OperationCanceledException) { throw; }` block at lines 238-241 covers any OCE from `GetFolderStats`, but `GetFolderStats` (lines 280-307) has its own `catch (Exception ex)` that swallows all exceptions internally and returns (0,0,0) — it cannot propagate an OCE to its caller. So the inner rethrow at line 240 is dead code in practice.

The AggregateException wrapping scenario the reviewer describes would only apply if the inner try/catch caught and re-threw an OCE that did NOT match the registered cancellation token, but no such path exists here. The cancellation handling is correct.

### R2. ~~FileBackupService.CleanupExpiredBackups can delete the in-progress day directory (loses just-created backups)~~  (low, lens: backend-correctness)
- **Location:** `Backend/TagFusion/Services/FileBackupService.cs:110-129`
- **Why dropped:** The finding's core claim — that CleanupExpiredBackups can delete the in-progress day directory — does not hold in normal operation. The cleanup cutoff is DateTime.UtcNow.AddDays(-RetentionDays), and RetentionDays <= 0 is already guarded (line 112). Today's day directory either does not exist yet (and is created after cleanup, line 64) or has a LastWriteTimeUtc of today, which is never older than a positive RetentionDays cutoff. For the cleanup to prune today's directory, the directory would need a filesystem mtime set in the past by more than RetentionDays days — a scenario requiring deliberate tampering or an exotic restore, not normal operation.

The concurrency race claim is also unsupported by the actual call pattern. The batch backup path (ExifToolService.cs line 253-254) iterates sequentially with await foreach, not in parallel. Multiple concurrent CreateBackupAsync calls from independent operations could overlap, but all would call CleanupExpiredBackups() on old directories only, then call Directory.CreateDirectory(dayDir) for today (idempotent). There is no code path where one thread deletes the current day directory while another is copying into it, because the current day directory has a fresh mtime and is never selected by CleanupExpiredBackups under sane RetentionDays values.

### R3. ~~ExifTool argument injection: user-controlled file paths passed without a '--' end-of-options separator~~  (medium, lens: security)
- **Location:** `Backend/TagFusion/Services/ExifToolService.cs:248-249`
- **Why dropped:** The finding is mechanically correct: no `--` end-of-options separator is emitted before file paths in any code path (WriteTagsBatchAsync line 248-249, BuildWriteTagArgs line 729, ReadBatchMetadataAsync line 353-354). However, the attack is unreachable on Windows. ExifTool's `-stay_open` stdin mode treats any line beginning with `-` as an option. On Windows, all valid absolute paths begin with a drive letter followed by `:\` (e.g. `C:\...`). A path starting with `-` is not a valid Windows absolute path and cannot refer to a real file. WriteTagsBatchAsync additionally gates paths through `imagePaths.Where(File.Exists).ToList()` (line 222), so a dash-prefixed token would be dropped before reaching ExifTool. ReadBatchMetadataAsync (line 354) has no such File.Exists guard, but the paths it receives originate from actual directory enumeration in FileSystemHandler — real filesystem paths on Windows will never begin with `-`. The mitigating factor cited by the reviewer ("paths are gated by File.Exists and the UI normally supplies absolute C:\... paths") is not just "uncommon on the happy path" — it is structurally impossible for a well-formed Windows absolute path to begin with `-`, making this a non-exploitable theoretical concern on this platform.
