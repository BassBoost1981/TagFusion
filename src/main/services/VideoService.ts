import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { MediaFile, VideoThumbnailOptions } from '../../types/global';

export interface VideoMetadata {
  duration: number; // in seconds
  width: number;
  height: number;
  fps: number;
  bitrate: number;
  codec: string;
  format: string;
}

export interface IVideoService {
  generateVideoThumbnail(filePath: string, options: VideoThumbnailOptions): Promise<string>;
  extractVideoMetadata(filePath: string): Promise<VideoMetadata>;
  isVideoFile(filePath: string): boolean;
  getSupportedVideoFormats(): string[];
  initializeFFmpeg(): Promise<void>;
  dispose(): Promise<void>;
}

export class VideoService implements IVideoService {
  private ffmpeg: FFmpeg;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;
  
  private readonly supportedVideoExtensions = [
    '.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.webm', '.m4v', '.3gp', '.ogv'
  ];

  constructor() {
    this.ffmpeg = new FFmpeg();
  }

  public async initializeFFmpeg(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.doInitializeFFmpeg();
    return this.initializationPromise;
  }

  private async doInitializeFFmpeg(): Promise<void> {
    try {
      // Load FFmpeg core and wasm files
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
      
      await this.ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      this.isInitialized = true;
      console.log('FFmpeg initialized successfully');
    } catch (error) {
      console.error('Failed to initialize FFmpeg:', error);
      this.isInitialized = false;
      this.initializationPromise = null;
      throw new Error('Failed to initialize video processing engine');
    }
  }

  public isVideoFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return this.supportedVideoExtensions.includes(ext);
  }

  public getSupportedVideoFormats(): string[] {
    return [...this.supportedVideoExtensions];
  }

  public async generateVideoThumbnail(filePath: string, options: VideoThumbnailOptions): Promise<string> {
    if (!this.isVideoFile(filePath)) {
      throw new Error(`File ${filePath} is not a supported video format`);
    }

    await this.initializeFFmpeg();

    try {
      // Check if file exists
      await fs.access(filePath);

      // Read the video file
      const videoData = await fs.readFile(filePath);
      const inputFileName = 'input' + path.extname(filePath);
      const outputFileName = 'thumbnail.jpg';

      // Write input file to FFmpeg virtual filesystem
      await this.ffmpeg.writeFile(inputFileName, new Uint8Array(videoData));

      // Extract thumbnail at specified time offset
      const timeOffset = options.timeOffset || 1; // Default to 1 second
      const width = options.width || 200;
      const height = options.height || 150;
      const quality = options.quality || 80;

      // FFmpeg command to extract thumbnail
      await this.ffmpeg.exec([
        '-i', inputFileName,
        '-ss', timeOffset.toString(),
        '-vframes', '1',
        '-vf', `scale=${width}:${height}`,
        '-q:v', Math.round((100 - quality) / 10).toString(), // Convert quality to FFmpeg scale
        '-y', // Overwrite output file
        outputFileName
      ]);

      // Read the generated thumbnail
      const thumbnailData = await this.ffmpeg.readFile(outputFileName);
      
      // Clean up virtual filesystem
      await this.ffmpeg.deleteFile(inputFileName);
      await this.ffmpeg.deleteFile(outputFileName);

      // Convert to base64
      const base64 = Buffer.from(thumbnailData as Uint8Array).toString('base64');
      return `data:image/jpeg;base64,${base64}`;

    } catch (error) {
      console.error(`Failed to generate video thumbnail for ${filePath}:`, error);
      throw new Error(`Video thumbnail generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async extractVideoMetadata(filePath: string): Promise<VideoMetadata> {
    if (!this.isVideoFile(filePath)) {
      throw new Error(`File ${filePath} is not a supported video format`);
    }

    await this.initializeFFmpeg();

    try {
      // Check if file exists
      await fs.access(filePath);

      // Read the video file
      const videoData = await fs.readFile(filePath);
      const inputFileName = 'input' + path.extname(filePath);

      // Write input file to FFmpeg virtual filesystem
      await this.ffmpeg.writeFile(inputFileName, new Uint8Array(videoData));

      // Extract metadata using ffprobe-like functionality
      let metadata: VideoMetadata = {
        duration: 0,
        width: 0,
        height: 0,
        fps: 0,
        bitrate: 0,
        codec: 'unknown',
        format: path.extname(filePath).substring(1)
      };

      // Set up logging to capture metadata
      let metadataOutput = '';
      this.ffmpeg.on('log', ({ message }) => {
        metadataOutput += message + '\n';
      });

      try {
        // Run FFmpeg with info output (this will fail but give us metadata)
        await this.ffmpeg.exec(['-i', inputFileName, '-f', 'null', '-']);
      } catch (error) {
        // Expected to fail, but we get metadata in the log
      }

      // Parse metadata from output
      metadata = this.parseVideoMetadata(metadataOutput, metadata);

      // Clean up
      await this.ffmpeg.deleteFile(inputFileName);

      return metadata;

    } catch (error) {
      console.error(`Failed to extract video metadata for ${filePath}:`, error);
      throw new Error(`Video metadata extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseVideoMetadata(output: string, defaultMetadata: VideoMetadata): VideoMetadata {
    const metadata = { ...defaultMetadata };

    try {
      // Parse duration
      const durationMatch = output.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
      if (durationMatch) {
        const hours = parseInt(durationMatch[1]);
        const minutes = parseInt(durationMatch[2]);
        const seconds = parseInt(durationMatch[3]);
        const centiseconds = parseInt(durationMatch[4]);
        metadata.duration = hours * 3600 + minutes * 60 + seconds + centiseconds / 100;
      }

      // Parse video stream info
      const videoStreamMatch = output.match(/Stream #\d+:\d+.*?: Video: (\w+).*?(\d+)x(\d+).*?(\d+(?:\.\d+)?) fps/);
      if (videoStreamMatch) {
        metadata.codec = videoStreamMatch[1];
        metadata.width = parseInt(videoStreamMatch[2]);
        metadata.height = parseInt(videoStreamMatch[3]);
        metadata.fps = parseFloat(videoStreamMatch[4]);
      }

      // Parse bitrate
      const bitrateMatch = output.match(/bitrate: (\d+) kb\/s/);
      if (bitrateMatch) {
        metadata.bitrate = parseInt(bitrateMatch[1]) * 1000; // Convert to bits per second
      }

    } catch (error) {
      console.warn('Failed to parse some video metadata:', error);
    }

    return metadata;
  }

  public async dispose(): Promise<void> {
    if (this.isInitialized) {
      try {
        await this.ffmpeg.terminate();
        this.isInitialized = false;
        this.initializationPromise = null;
      } catch (error) {
        console.error('Error disposing VideoService:', error);
      }
    }
  }
}