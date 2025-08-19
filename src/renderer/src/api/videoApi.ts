import { VideoThumbnailOptions } from '../../../types/global';

export interface VideoThumbnailResult {
  thumbnail: string; // Base64 encoded image
  metadata?: {
    duration: number;
    width: number;
    height: number;
    fps: number;
    bitrate: number;
    codec: string;
    format: string;
  };
}

export interface VideoMetadataResult {
  duration: number;
  width: number;
  height: number;
  fps: number;
  bitrate: number;
  codec: string;
  format: string;
  title?: string;
  description?: string;
  tags?: string[];
  creationDate?: Date;
  location?: {
    latitude?: number;
    longitude?: number;
  };
}

export const videoApi = {
  /**
   * Generate a thumbnail for a video file
   */
  generateVideoThumbnail: async (filePath: string, options: VideoThumbnailOptions): Promise<VideoThumbnailResult> => {
    return window.electronAPI.invoke('video:generateThumbnail', filePath, options);
  },

  /**
   * Extract metadata from a video file
   */
  extractVideoMetadata: async (filePath: string): Promise<VideoMetadataResult> => {
    return window.electronAPI.invoke('video:extractMetadata', filePath);
  },

  /**
   * Check if a file is a supported video format
   */
  isVideoFile: async (filePath: string): Promise<boolean> => {
    return window.electronAPI.invoke('video:isVideoFile', filePath);
  },

  /**
   * Get list of supported video formats
   */
  getSupportedVideoFormats: async (): Promise<string[]> => {
    return window.electronAPI.invoke('video:getSupportedFormats');
  },

  /**
   * Generate thumbnails for multiple video files
   */
  generateBatchVideoThumbnails: async (
    filePaths: string[], 
    options: VideoThumbnailOptions
  ): Promise<Map<string, VideoThumbnailResult>> => {
    return window.electronAPI.invoke('video:generateBatchThumbnails', filePaths, options);
  },

  /**
   * Extract metadata from multiple video files
   */
  extractBatchVideoMetadata: async (filePaths: string[]): Promise<Map<string, VideoMetadataResult>> => {
    return window.electronAPI.invoke('video:extractBatchMetadata', filePaths);
  }
};

// Extend the global electronAPI interface
declare global {
  interface Window {
    electronAPI: {
      invoke: (channel: string, ...args: any[]) => Promise<any>;
      generateVideoThumbnail: (filePath: string, options: VideoThumbnailOptions) => Promise<VideoThumbnailResult>;
      // ... other existing methods
    };
  }
}