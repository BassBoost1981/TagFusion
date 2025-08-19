const { parentPort } = require('worker_threads');
const sharp = require('sharp');
const { FFmpeg } = require('@ffmpeg/ffmpeg');
const { fetchFile, toBlobURL } = require('@ffmpeg/util');
const fs = require('fs/promises');
const path = require('path');

let ffmpeg = null;
let ffmpegLoaded = false;

async function initializeFFmpeg() {
  if (ffmpegLoaded) return;
  
  try {
    ffmpeg = new FFmpeg();
    
    // Load FFmpeg with WebAssembly
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    
    ffmpegLoaded = true;
  } catch (error) {
    console.error('Failed to initialize FFmpeg:', error);
    throw error;
  }
}

async function generateImageThumbnail(filePath, options) {
  try {
    const { width, height, quality = 80, format = 'jpeg' } = options;
    
    const buffer = await sharp(filePath)
      .resize(width, height, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality })
      .toBuffer();
    
    return `data:image/${format};base64,${buffer.toString('base64')}`;
  } catch (error) {
    throw new Error(`Failed to generate image thumbnail: ${error.message}`);
  }
}

async function generateVideoThumbnail(filePath, options) {
  try {
    if (!ffmpeg) {
      await initializeFFmpeg();
    }
    
    if (!ffmpeg) {
      throw new Error('FFmpeg not initialized');
    }

    const { width, height, timeOffset = 1, quality = 80 } = options;
    const inputFileName = path.basename(filePath);
    const outputFileName = 'thumbnail.jpg';
    
    // Read the video file
    const videoData = await fs.readFile(filePath);
    await ffmpeg.writeFile(inputFileName, new Uint8Array(videoData));
    
    // Extract frame at specified time offset
    await ffmpeg.exec([
      '-i', inputFileName,
      '-ss', timeOffset.toString(),
      '-vframes', '1',
      '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`,
      '-q:v', Math.floor((100 - quality) / 10).toString(),
      outputFileName
    ]);
    
    // Read the generated thumbnail
    const thumbnailData = await ffmpeg.readFile(outputFileName);
    const buffer = Buffer.from(thumbnailData);
    
    // Clean up temporary files
    await ffmpeg.deleteFile(inputFileName);
    await ffmpeg.deleteFile(outputFileName);
    
    return `data:image/jpeg;base64,${buffer.toString('base64')}`;
  } catch (error) {
    throw new Error(`Failed to generate video thumbnail: ${error.message}`);
  }
}

// Handle messages from main thread
if (parentPort) {
  parentPort.on('message', async (request) => {
    try {
      let thumbnail;
      
      if (request.type === 'image') {
        thumbnail = await generateImageThumbnail(request.filePath, request.options);
      } else if (request.type === 'video') {
        thumbnail = await generateVideoThumbnail(request.filePath, request.options);
      } else {
        throw new Error(`Unsupported thumbnail type: ${request.type}`);
      }
      
      parentPort.postMessage({ thumbnail });
    } catch (error) {
      parentPort.postMessage({ error: error.message });
    }
  });
}