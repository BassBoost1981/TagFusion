import { globalShortcut, BrowserWindow } from 'electron';

export interface GlobalShortcutHandlers {
  onToggleWindow?: () => void;
  onQuit?: () => void;
  onNewWindow?: () => void;
  onMinimizeWindow?: () => void;
  onMaximizeWindow?: () => void;
  onCloseWindow?: () => void;
}

export class KeyboardShortcutsService {
  private mainWindow: BrowserWindow | null = null;
  private handlers: GlobalShortcutHandlers = {};
  private registeredShortcuts: Set<string> = new Set();

  constructor(mainWindow?: BrowserWindow) {
    this.mainWindow = mainWindow || null;
  }

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  setHandlers(handlers: GlobalShortcutHandlers): void {
    this.handlers = { ...this.handlers, ...handlers };
  }

  registerGlobalShortcuts(): void {
    // Only register global shortcuts that make sense for the application
    const shortcuts = [
      {
        accelerator: 'CommandOrControl+Shift+I',
        handler: () => this.toggleDevTools(),
      },
      {
        accelerator: 'CommandOrControl+R',
        handler: () => this.reloadWindow(),
      },
      {
        accelerator: 'CommandOrControl+Shift+R',
        handler: () => this.forceReloadWindow(),
      },
      {
        accelerator: 'F11',
        handler: () => this.toggleFullscreen(),
      },
      {
        accelerator: 'CommandOrControl+M',
        handler: () => this.minimizeWindow(),
      },
      {
        accelerator: 'CommandOrControl+W',
        handler: () => this.closeWindow(),
      },
    ];

    shortcuts.forEach(({ accelerator, handler }) => {
      try {
        const success = globalShortcut.register(accelerator, handler);
        if (success) {
          this.registeredShortcuts.add(accelerator);
          console.log(`Registered global shortcut: ${accelerator}`);
        } else {
          console.warn(`Failed to register global shortcut: ${accelerator}`);
        }
      } catch (error) {
        console.error(`Error registering shortcut ${accelerator}:`, error);
      }
    });
  }

  unregisterGlobalShortcuts(): void {
    this.registeredShortcuts.forEach(accelerator => {
      try {
        globalShortcut.unregister(accelerator);
        console.log(`Unregistered global shortcut: ${accelerator}`);
      } catch (error) {
        console.error(`Error unregistering shortcut ${accelerator}:`, error);
      }
    });
    this.registeredShortcuts.clear();
  }

  unregisterAllShortcuts(): void {
    try {
      globalShortcut.unregisterAll();
      this.registeredShortcuts.clear();
      console.log('Unregistered all global shortcuts');
    } catch (error) {
      console.error('Error unregistering all shortcuts:', error);
    }
  }

  private toggleDevTools(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      if (this.mainWindow.webContents.isDevToolsOpened()) {
        this.mainWindow.webContents.closeDevTools();
      } else {
        this.mainWindow.webContents.openDevTools();
      }
    }
  }

  private reloadWindow(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.reload();
    }
  }

  private forceReloadWindow(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.reloadIgnoringCache();
    }
  }

  private toggleFullscreen(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      const isFullscreen = this.mainWindow.isFullScreen();
      this.mainWindow.setFullScreen(!isFullscreen);
    }
  }

  private minimizeWindow(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.minimize();
      this.handlers.onMinimizeWindow?.();
    }
  }

  private closeWindow(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.close();
      this.handlers.onCloseWindow?.();
    }
  }

  // Method to check if a shortcut is registered
  isShortcutRegistered(accelerator: string): boolean {
    return this.registeredShortcuts.has(accelerator);
  }

  // Method to get all registered shortcuts
  getRegisteredShortcuts(): string[] {
    return Array.from(this.registeredShortcuts);
  }

  // Method to register a custom global shortcut
  registerCustomShortcut(accelerator: string, handler: () => void): boolean {
    try {
      const success = globalShortcut.register(accelerator, handler);
      if (success) {
        this.registeredShortcuts.add(accelerator);
        console.log(`Registered custom global shortcut: ${accelerator}`);
        return true;
      } else {
        console.warn(`Failed to register custom global shortcut: ${accelerator}`);
        return false;
      }
    } catch (error) {
      console.error(`Error registering custom shortcut ${accelerator}:`, error);
      return false;
    }
  }

  // Method to unregister a specific shortcut
  unregisterShortcut(accelerator: string): boolean {
    try {
      globalShortcut.unregister(accelerator);
      this.registeredShortcuts.delete(accelerator);
      console.log(`Unregistered global shortcut: ${accelerator}`);
      return true;
    } catch (error) {
      console.error(`Error unregistering shortcut ${accelerator}:`, error);
      return false;
    }
  }
}