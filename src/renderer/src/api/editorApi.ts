import { MediaFile, ImageOperation } from '../../../types/global';

export interface EditorApiResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface SaveImageResult {
  outputPath: string;
}

export class EditorApi {
  /**
   * Open the image editor for a specific file
   */
  static async openEditor(file: MediaFile): Promise<EditorApiResult<{ windowId: number }>> {
    try {
      const result = await window.electronAPI.editor.open(file);
      
      if (result.success && result.windowId) {
        return {
          success: true,
          data: { windowId: result.windowId }
        };
      } else {
        return {
          success: false,
          error: result.error || 'Failed to open editor'
        };
      }
    } catch (error) {
      console.error('Error opening editor:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Close the image editor for a specific file
   */
  static async closeEditor(filePath: string): Promise<EditorApiResult> {
    try {
      const result = await window.electronAPI.editor.close(filePath);
      
      return {
        success: result.success,
        error: result.error
      };
    } catch (error) {
      console.error('Error closing editor:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Save edited image with applied operations
   */
  static async saveEditedImage(filePath: string, operations: ImageOperation[]): Promise<EditorApiResult<SaveImageResult>> {
    try {
      const result = await window.electronAPI.editor.save(filePath, operations);
      
      if (result.success && result.outputPath) {
        return {
          success: true,
          data: { outputPath: result.outputPath }
        };
      } else {
        return {
          success: false,
          error: result.error || 'Failed to save image'
        };
      }
    } catch (error) {
      console.error('Error saving image:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get the window ID for an editor instance
   */
  static async getEditorWindowId(filePath: string): Promise<EditorApiResult<{ windowId: number }>> {
    try {
      const windowId = await window.electronAPI.editor.getWindowId(filePath);
      
      if (windowId !== null) {
        return {
          success: true,
          data: { windowId }
        };
      } else {
        return {
          success: false,
          error: 'Editor window not found'
        };
      }
    } catch (error) {
      console.error('Error getting editor window ID:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check if an editor is currently open for a file
   */
  static async isEditorOpen(filePath: string): Promise<boolean> {
    try {
      const result = await this.getEditorWindowId(filePath);
      return result.success;
    } catch (error) {
      console.error('Error checking if editor is open:', error);
      return false;
    }
  }
}