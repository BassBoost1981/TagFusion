import type {
  BridgeMessage,
  BridgeResponse,
  BridgeEvent,
  ImageFile,
  FolderItem,
  Tag,
  GridItem,
  TagLibrary,
} from '../types';
import { BRIDGE_ACTIONS, type BridgeActionName } from './bridgeActions';

type EventCallback = (data: unknown) => void;

const isDebugLoggingEnabled = import.meta.env.DEV && import.meta.env.MODE !== 'test';

/** Debug-only logger — disabled in tests to keep output clean */
// eslint-disable-next-line no-console
const log = isDebugLoggingEnabled ? (...args: unknown[]) => console.log('[Bridge]', ...args) : () => {};

class BridgeService {
  private pendingRequests: Map<string, { resolve: (value: unknown) => void; reject: (reason: unknown) => void }> =
    new Map();
  private eventListeners: Map<string, Set<EventCallback>> = new Map();
  private isWebView: boolean;

  constructor() {
    this.isWebView = typeof window !== 'undefined' && !!window.chrome?.webview;
    log('isWebView:', this.isWebView);

    if (this.isWebView) {
      window.chrome!.webview!.addEventListener('message', (event) => {
        log('Received message:', event.data);
        this.handleMessage(event.data);
      });
    }
  }

  private generateId(): string {
    const random = crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
    return `${Date.now()}-${random}`;
  }

  private handleMessage(data: unknown): void {
    try {
      // PostWebMessageAsJson sends already-parsed objects, not strings
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      log('Parsed message:', JSON.stringify(parsed, null, 2));
      log('Message id:', parsed.id, 'Pending IDs:', Array.from(this.pendingRequests.keys()));

      // Check if it's a response to a pending request
      if (parsed.id && this.pendingRequests.has(parsed.id)) {
        const { resolve, reject } = this.pendingRequests.get(parsed.id)!;
        this.pendingRequests.delete(parsed.id);

        const response = parsed as BridgeResponse;
        log('Response for id:', parsed.id, 'success:', response.success);
        if (response.success) {
          resolve(response.data);
        } else {
          reject(new Error(response.error || 'Unknown error'));
        }
      }
      // Check if it's an event
      else if (parsed.event) {
        const event = parsed as BridgeEvent;
        const listeners = this.eventListeners.get(event.event);
        if (listeners) {
          listeners.forEach((callback) => callback(event.data));
        }
      } else {
        log('Unhandled - id not in pending:', parsed.id);
      }
    } catch (error) {
      console.error('Failed to parse bridge message:', error);
    }
  }

  /** Maximum number of retry attempts for failed requests */
  private static readonly MAX_RETRIES = 2;

  /** Base timeout in ms (doubled on each retry) */
  private static readonly BASE_TIMEOUT_MS = 120_000;

  /** Actions that are safe to retry (idempotent reads) */
  private static readonly RETRYABLE_ACTIONS = new Set<BridgeActionName>([
    BRIDGE_ACTIONS.GET_DRIVES,
    BRIDGE_ACTIONS.GET_FOLDERS,
    BRIDGE_ACTIONS.GET_IMAGES,
    BRIDGE_ACTIONS.GET_FOLDER_CONTENTS,
    BRIDGE_ACTIONS.READ_TAGS,
    BRIDGE_ACTIONS.GET_THUMBNAIL,
    BRIDGE_ACTIONS.GET_FULL_IMAGE,
    BRIDGE_ACTIONS.GET_THUMBNAILS_BATCH,
    BRIDGE_ACTIONS.GET_RATING,
    BRIDGE_ACTIONS.GET_ALL_TAGS,
    BRIDGE_ACTIONS.GET_TAG_LIBRARY,
    BRIDGE_ACTIONS.HEALTH_CHECK,
    BRIDGE_ACTIONS.SEARCH_IMAGES,
    BRIDGE_ACTIONS.FIND_DUPLICATES,
    BRIDGE_ACTIONS.GET_PROPERTIES,
    BRIDGE_ACTIONS.EXPORT_TAGS_JSON,
    BRIDGE_ACTIONS.EXPORT_TAGS_CSV,
    BRIDGE_ACTIONS.EXPORT_TAGS_XMP,
    BRIDGE_ACTIONS.WATCH_FOLDER,
    BRIDGE_ACTIONS.STOP_WATCHING,
    BRIDGE_ACTIONS.UPDATE_BATCH_TAG,
  ]);

  private async send<T>(action: BridgeActionName, payload?: Record<string, unknown>): Promise<T> {
    return this.sendWithRetry<T>(action, payload, 0);
  }

  private async sendWithRetry<T>(
    action: BridgeActionName,
    payload: Record<string, unknown> | undefined,
    attempt: number
  ): Promise<T> {
    const id = this.generateId();
    const message: BridgeMessage = { id, action, payload };
    log('Sending:', action, 'id:', id, attempt > 0 ? `(retry ${attempt})` : '');

    try {
      return await this.sendOnce<T>(id, message, action, payload, attempt);
    } catch (error) {
      const isTimeout = error instanceof Error && error.message === 'Request timeout';
      const canRetry = isTimeout && attempt < BridgeService.MAX_RETRIES && BridgeService.RETRYABLE_ACTIONS.has(action);

      if (canRetry) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 4000); // 1s, 2s, 4s
        log(`Retrying ${action} in ${delay}ms (attempt ${attempt + 1}/${BridgeService.MAX_RETRIES})`);
        await new Promise((r) => setTimeout(r, delay));
        return this.sendWithRetry<T>(action, payload, attempt + 1);
      }

      throw error;
    }
  }

  private sendOnce<T>(
    id: string,
    message: BridgeMessage,
    action: BridgeActionName,
    _payload: Record<string, unknown> | undefined,
    attempt: number
  ): Promise<T> {
    const timeoutMs = BridgeService.BASE_TIMEOUT_MS * Math.pow(1.5, attempt); // 120s, 180s, 270s

    return new Promise((resolve, reject) => {
      if (!this.isWebView) {
        log('Using mock response for:', action);
        setTimeout(() => {
          resolve(this.getMockResponse(action, _payload) as T);
        }, 100);
        return;
      }

      this.pendingRequests.set(id, { resolve: resolve as (value: unknown) => void, reject });
      const msgStr = JSON.stringify(message);
      log('Posting to WebView:', msgStr);
      window.chrome!.webview!.postMessage(msgStr);

      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          console.error('[Bridge] Timeout for:', action, 'id:', id, `(${Math.round(timeoutMs / 1000)}s)`);
          reject(new Error('Request timeout'));
        }
      }, timeoutMs);
    });
  }

  // Event subscription
  on(event: string, callback: EventCallback): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);

    return () => {
      this.eventListeners.get(event)?.delete(callback);
    };
  }

  // API Methods
  async getDrives(): Promise<FolderItem[]> {
    return this.send<FolderItem[]>(BRIDGE_ACTIONS.GET_DRIVES);
  }

  async getFolders(path: string): Promise<FolderItem[]> {
    return this.send<FolderItem[]>(BRIDGE_ACTIONS.GET_FOLDERS, { path });
  }

  async getImages(folderPath: string): Promise<ImageFile[]> {
    return this.send<ImageFile[]>(BRIDGE_ACTIONS.GET_IMAGES, { folderPath });
  }

  async getFolderContents(folderPath: string): Promise<GridItem[]> {
    return this.send<GridItem[]>(BRIDGE_ACTIONS.GET_FOLDER_CONTENTS, { folderPath });
  }

  async selectFolder(): Promise<string | null> {
    return this.send<string | null>(BRIDGE_ACTIONS.SELECT_FOLDER);
  }

  async readTags(imagePath: string): Promise<string[]> {
    return this.send<string[]>(BRIDGE_ACTIONS.READ_TAGS, { imagePath });
  }

  async writeTags(imagePath: string, tags: string[]): Promise<boolean> {
    return this.send<boolean>(BRIDGE_ACTIONS.WRITE_TAGS, { imagePath, tags });
  }

  async getThumbnail(imagePath: string): Promise<string> {
    return this.send<string>(BRIDGE_ACTIONS.GET_THUMBNAIL, { imagePath });
  }

  async getFullImage(imagePath: string, maxSize: number = 1920): Promise<string> {
    return this.send<string>(BRIDGE_ACTIONS.GET_FULL_IMAGE, { imagePath, maxSize });
  }

  async getThumbnailsBatch(imagePaths: string[]): Promise<Record<string, string | null>> {
    return this.send<Record<string, string | null>>(BRIDGE_ACTIONS.GET_THUMBNAILS_BATCH, { imagePaths });
  }

  async getRating(imagePath: string): Promise<number> {
    return this.send<number>(BRIDGE_ACTIONS.GET_RATING, { imagePath });
  }

  async setRating(imagePath: string, rating: number): Promise<boolean> {
    return this.send<boolean>(BRIDGE_ACTIONS.SET_RATING, { imagePath, rating });
  }

  async getAllTags(): Promise<Tag[]> {
    return this.send<Tag[]>(BRIDGE_ACTIONS.GET_ALL_TAGS);
  }

  async getTagLibrary(): Promise<TagLibrary> {
    return this.send<TagLibrary>(BRIDGE_ACTIONS.GET_TAG_LIBRARY);
  }

  async saveTagLibrary(library: TagLibrary): Promise<boolean> {
    return this.send<boolean>(BRIDGE_ACTIONS.SAVE_TAG_LIBRARY, { library });
  }

  // Image Edit Methods
  async rotateImages(paths: string[], angle: number): Promise<Record<string, boolean>> {
    return this.send<Record<string, boolean>>(BRIDGE_ACTIONS.ROTATE_IMAGES, { paths, angle });
  }

  async flipImages(paths: string[], horizontal: boolean): Promise<Record<string, boolean>> {
    return this.send<Record<string, boolean>>(BRIDGE_ACTIONS.FLIP_IMAGES, { paths, horizontal });
  }

  // File Operations
  async copyFiles(paths: string[], targetFolder: string): Promise<boolean> {
    return this.send<boolean>(BRIDGE_ACTIONS.COPY_FILES, { paths, targetFolder });
  }

  async moveFiles(paths: string[], targetFolder: string): Promise<boolean> {
    return this.send<boolean>(BRIDGE_ACTIONS.MOVE_FILES, { paths, targetFolder });
  }

  async deleteFiles(paths: string[]): Promise<boolean> {
    return this.send<boolean>(BRIDGE_ACTIONS.DELETE_FILES, { paths });
  }

  async rename(path: string, newName: string): Promise<boolean> {
    return this.send<boolean>(BRIDGE_ACTIONS.RENAME_FILE, { path, newName });
  }

  async openInExplorer(path: string): Promise<void> {
    return this.send<void>(BRIDGE_ACTIONS.OPEN_IN_EXPLORER, { path });
  }

  // Health Check / Diagnostics
  async healthCheck(): Promise<{
    allOk: boolean;
    checkedAt: string;
    databaseOk: boolean;
    databaseError?: string;
    exifToolOk: boolean;
    exifToolPath?: string;
    diskOk: boolean;
    diskFreeBytes: number;
    diskTotalBytes: number;
  }> {
    return this.send(BRIDGE_ACTIONS.HEALTH_CHECK);
  }

  // Search / Filter images by tags and/or rating
  async searchImages(tags?: string[], minRating?: number, limit?: number, offset?: number): Promise<ImageFile[]> {
    return this.send<ImageFile[]>(BRIDGE_ACTIONS.SEARCH_IMAGES, { tags, minRating, limit, offset });
  }

  // Batch tag operations — write identical tags to multiple images
  async writeBatchTags(paths: string[], tags: string[]): Promise<Record<string, boolean>> {
    return this.send<Record<string, boolean>>(BRIDGE_ACTIONS.WRITE_BATCH_TAGS, { paths, tags });
  }

  // Batch tag operations — merge or remove one tag across multiple images
  async updateBatchTag(paths: string[], tag: string, operation: 'add' | 'remove'): Promise<Record<string, boolean>> {
    return this.send<Record<string, boolean>>(BRIDGE_ACTIONS.UPDATE_BATCH_TAG, { paths, tag, operation });
  }

  // Folder watcher — start/stop watching a folder for changes
  async watchFolder(path: string): Promise<boolean> {
    return this.send<boolean>(BRIDGE_ACTIONS.WATCH_FOLDER, { path });
  }

  async stopWatching(): Promise<boolean> {
    return this.send<boolean>(BRIDGE_ACTIONS.STOP_WATCHING);
  }

  // Tag import/export
  async exportTagsJson(paths: string[]): Promise<string> {
    return this.send<string>(BRIDGE_ACTIONS.EXPORT_TAGS_JSON, { paths });
  }

  async exportTagsCsv(paths: string[]): Promise<string> {
    return this.send<string>(BRIDGE_ACTIONS.EXPORT_TAGS_CSV, { paths });
  }

  /**
   * Write a per-image XMP sidecar (.xmp file next to each source image).
   * Useful for RAW formats that can't be written inline.
   */
  async exportTagsXmp(paths: string[]): Promise<Record<string, boolean>> {
    return this.send<Record<string, boolean>>(BRIDGE_ACTIONS.EXPORT_TAGS_XMP, { paths });
  }

  async importTagsJson(data: string): Promise<Record<string, boolean>> {
    return this.send<Record<string, boolean>>(BRIDGE_ACTIONS.IMPORT_TAGS_JSON, { data });
  }

  async importTagsCsv(data: string): Promise<Record<string, boolean>> {
    return this.send<Record<string, boolean>>(BRIDGE_ACTIONS.IMPORT_TAGS_CSV, { data });
  }

  // Duplicate detection
  async findDuplicates(
    path: string,
    includeSubfolders: boolean = false
  ): Promise<{ hash: string; paths: string[]; fileSize: number }[]> {
    return this.send(BRIDGE_ACTIONS.FIND_DUPLICATES, { path, includeSubfolders });
  }

  async getProperties(path: string): Promise<{
    name: string;
    path: string;
    size: number;
    created: string;
    modified: string;
    isFolder: boolean;
    dimensions?: { width: number; height: number };
  }> {
    return this.send(BRIDGE_ACTIONS.GET_PROPERTIES, { path });
  }

  // Mock responses for development without WebView
  private getMockResponse(action: string, _payload?: Record<string, unknown>): unknown {
    switch (action) {
      case 'getDrives':
        return [
          {
            name: 'Lokaler Datenträger (C:)',
            path: 'C:\\',
            type: 'Drive',
            hasSubfolders: true,
            totalSize: 500 * 1024 ** 3,
            freeSpace: 200 * 1024 ** 3,
            driveFormat: 'NTFS',
            driveType: 'Fixed',
          },
          {
            name: 'Daten (D:)',
            path: 'D:\\',
            type: 'Drive',
            hasSubfolders: true,
            totalSize: 2000 * 1024 ** 3,
            freeSpace: 1500 * 1024 ** 3,
            driveFormat: 'NTFS',
            driveType: 'Fixed',
          },
          {
            name: 'Backup (E:)',
            path: 'E:\\',
            type: 'Drive',
            hasSubfolders: true,
            totalSize: 4000 * 1024 ** 3,
            freeSpace: 500 * 1024 ** 3,
            driveFormat: 'NTFS',
            driveType: 'Fixed',
          },
        ];
      case 'getFolders':
        return [
          { name: 'Pictures', path: 'C:\\Pictures', type: 'Folder', hasSubfolders: true },
          { name: 'Documents', path: 'C:\\Documents', type: 'Folder', hasSubfolders: false },
        ];
      case 'getImages':
        return [];
      case 'selectFolder':
        return 'C:\\Pictures';
      case 'readTags':
        return ['landscape', 'nature', 'sunset'];
      case 'getAllTags':
        return [
          { name: 'landscape', usageCount: 42, isFavorite: true },
          { name: 'nature', usageCount: 38, isFavorite: false },
        ];
      case 'healthCheck':
        return {
          allOk: true,
          checkedAt: new Date().toISOString(),
          databaseOk: true,
          exifToolOk: true,
          exifToolPath: 'Tools/exiftool.exe',
          diskOk: true,
          diskFreeBytes: 200 * 1024 ** 3,
          diskTotalBytes: 500 * 1024 ** 3,
        };
      case 'searchImages':
        return [];
      case 'writeBatchTags':
        return {};
      case 'watchFolder':
      case 'stopWatching':
        return true;
      case 'exportTagsJson':
        return '[]';
      case 'exportTagsCsv':
        return 'Path;Tags;Rating';
      case 'importTagsJson':
      case 'importTagsCsv':
        return {};
      case 'findDuplicates':
        return [];
      default:
        return null;
    }
  }
}

export const bridge = new BridgeService();
