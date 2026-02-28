import type { BridgeMessage, BridgeResponse, BridgeEvent, ImageFile, FolderItem, Tag, GridItem, TagLibrary } from '../types';

type EventCallback = (data: unknown) => void;

class BridgeService {
  private pendingRequests: Map<string, { resolve: (value: unknown) => void; reject: (reason: unknown) => void }> = new Map();
  private eventListeners: Map<string, Set<EventCallback>> = new Map();
  private isWebView: boolean;

  constructor() {
    this.isWebView = typeof window !== 'undefined' && !!window.chrome?.webview;
    console.log('[Bridge] isWebView:', this.isWebView);

    if (this.isWebView) {
      window.chrome!.webview!.addEventListener('message', (event) => {
        console.log('[Bridge] Received message:', event.data);
        this.handleMessage(event.data);
      });
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private handleMessage(data: unknown): void {
    try {
      // PostWebMessageAsJson sends already-parsed objects, not strings
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      console.log('[Bridge] Parsed message:', JSON.stringify(parsed, null, 2));
      console.log('[Bridge] Message id:', parsed.id, 'Pending IDs:', Array.from(this.pendingRequests.keys()));

      // Check if it's a response to a pending request
      if (parsed.id && this.pendingRequests.has(parsed.id)) {
        const { resolve, reject } = this.pendingRequests.get(parsed.id)!;
        this.pendingRequests.delete(parsed.id);

        const response = parsed as BridgeResponse;
        console.log('[Bridge] Response for id:', parsed.id, 'success:', response.success);
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
          listeners.forEach(callback => callback(event.data));
        }
      } else {
        console.log('[Bridge] Unhandled - id not in pending:', parsed.id);
      }
    } catch (error) {
      console.error('Failed to parse bridge message:', error);
    }
  }

  private async send<T>(action: string, payload?: Record<string, unknown>): Promise<T> {
    const id = this.generateId();
    const message: BridgeMessage = { id, action, payload };
    console.log('[Bridge] Sending:', action, 'id:', id);

    return new Promise((resolve, reject) => {
      if (!this.isWebView) {
        console.log('[Bridge] Using mock response for:', action);
        // Mock responses for development
        setTimeout(() => {
          resolve(this.getMockResponse(action, payload) as T);
        }, 100);
        return;
      }

      this.pendingRequests.set(id, { resolve: resolve as (value: unknown) => void, reject });
      const msgStr = JSON.stringify(message);
      console.log('[Bridge] Posting to WebView:', msgStr);
      window.chrome!.webview!.postMessage(msgStr);

      // Timeout after 120 seconds (increased from 30s for slow network drives)
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          console.error('[Bridge] Timeout for:', action, 'id:', id);
          reject(new Error('Request timeout'));
        }
      }, 120000);
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
    return this.send<FolderItem[]>('getDrives');
  }

  async getFolders(path: string): Promise<FolderItem[]> {
    return this.send<FolderItem[]>('getFolders', { path });
  }

  async getImages(folderPath: string): Promise<ImageFile[]> {
    return this.send<ImageFile[]>('getImages', { folderPath });
  }

  async getFolderContents(folderPath: string): Promise<GridItem[]> {
    return this.send<GridItem[]>('getFolderContents', { folderPath });
  }

  async selectFolder(): Promise<string | null> {
    return this.send<string | null>('selectFolder');
  }

  async readTags(imagePath: string): Promise<string[]> {
    return this.send<string[]>('readTags', { imagePath });
  }

  async writeTags(imagePath: string, tags: string[]): Promise<boolean> {
    return this.send<boolean>('writeTags', { imagePath, tags });
  }

  async getThumbnail(imagePath: string): Promise<string> {
    return this.send<string>('getThumbnail', { imagePath });
  }

  async getFullImage(imagePath: string, maxSize: number = 1920): Promise<string> {
    return this.send<string>('getFullImage', { imagePath, maxSize });
  }

  async getThumbnailsBatch(imagePaths: string[]): Promise<Record<string, string | null>> {
    return this.send<Record<string, string | null>>('getThumbnailsBatch', { imagePaths });
  }

  async getRating(imagePath: string): Promise<number> {
    return this.send<number>('getRating', { imagePath });
  }

  async setRating(imagePath: string, rating: number): Promise<boolean> {
    return this.send<boolean>('setRating', { imagePath, rating });
  }

  async getAllTags(): Promise<Tag[]> {
    return this.send<Tag[]>('getAllTags');
  }

  async getTagLibrary(): Promise<TagLibrary> {
    return this.send<TagLibrary>('getTagLibrary');
  }

  async saveTagLibrary(library: TagLibrary): Promise<boolean> {
    return this.send<boolean>('saveTagLibrary', { library });
  }

  // Image Edit Methods
  async rotateImages(paths: string[], angle: number): Promise<Record<string, boolean>> {
    return this.send<Record<string, boolean>>('rotateImages', { paths, angle });
  }

  async flipImages(paths: string[], horizontal: boolean): Promise<Record<string, boolean>> {
    return this.send<Record<string, boolean>>('flipImages', { paths, horizontal });
  }

  // File Operations
  async copyFiles(paths: string[], targetFolder: string): Promise<boolean> {
    return this.send<boolean>('copyFiles', { paths, targetFolder });
  }

  async moveFiles(paths: string[], targetFolder: string): Promise<boolean> {
    return this.send<boolean>('moveFiles', { paths, targetFolder });
  }

  async deleteFiles(paths: string[]): Promise<boolean> {
    return this.send<boolean>('deleteFiles', { paths });
  }

  async rename(path: string, newName: string): Promise<boolean> {
    return this.send<boolean>('renameFile', { path, newName });
  }

  async openInExplorer(path: string): Promise<void> {
    return this.send<void>('openInExplorer', { path });
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
    return this.send('getProperties', { path });
  }

  // Mock responses for development without WebView
  private getMockResponse(action: string, _payload?: Record<string, unknown>): unknown {
    switch (action) {
      case 'getDrives':
        return [
          {
            name: 'Lokaler Datenträger (C:)', path: 'C:\\', type: 'Drive', hasSubfolders: true,
            totalSize: 500 * 1024 ** 3, freeSpace: 200 * 1024 ** 3, driveFormat: 'NTFS', driveType: 'Fixed'
          },
          {
            name: 'Daten (D:)', path: 'D:\\', type: 'Drive', hasSubfolders: true,
            totalSize: 2000 * 1024 ** 3, freeSpace: 1500 * 1024 ** 3, driveFormat: 'NTFS', driveType: 'Fixed'
          },
          {
            name: 'Backup (E:)', path: 'E:\\', type: 'Drive', hasSubfolders: true,
            totalSize: 4000 * 1024 ** 3, freeSpace: 500 * 1024 ** 3, driveFormat: 'NTFS', driveType: 'Fixed'
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
      default:
        return null;
    }
  }
}

export const bridge = new BridgeService();

