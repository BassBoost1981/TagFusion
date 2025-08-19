import React, { useState, useEffect, useRef } from 'react';
import { MediaFile, ImageOperation } from '../../../../types/global';
import { EditorToolbar } from './EditorToolbar';
import { ImagePreview } from './ImagePreview';
import { ToolControlPanel } from './ToolControlPanel';
import './ImageEditor.css';

export interface ImageEditorProps {
  file: MediaFile;
  onSave: (operations: ImageOperation[]) => void;
  onCancel: () => void;
}

export interface EditorTool {
  id: string;
  name: string;
  icon: string;
  type: 'brightness' | 'contrast' | 'saturation' | 'rotate' | 'crop' | 'resize';
}

export const ImageEditor: React.FC<ImageEditorProps> = ({ file, onSave, onCancel }) => {
  const [operations, setOperations] = useState<ImageOperation[]>([]);
  const [activeTool, setActiveTool] = useState<EditorTool | null>(null);
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null);
  const [previewImage, setPreviewImage] = useState<HTMLImageElement | null>(null);
  const [undoStack, setUndoStack] = useState<ImageOperation[][]>([]);
  const [redoStack, setRedoStack] = useState<ImageOperation[][]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const tools: EditorTool[] = [
    { id: 'brightness', name: 'Brightness', icon: '☀️', type: 'brightness' },
    { id: 'contrast', name: 'Contrast', icon: '🔆', type: 'contrast' },
    { id: 'saturation', name: 'Saturation', icon: '🎨', type: 'saturation' },
    { id: 'rotate-left', name: 'Rotate Left', icon: '↶', type: 'rotate' },
    { id: 'rotate-right', name: 'Rotate Right', icon: '↷', type: 'rotate' },
    { id: 'crop', name: 'Crop', icon: '✂️', type: 'crop' },
    { id: 'resize', name: 'Resize', icon: '📏', type: 'resize' },
  ];

  useEffect(() => {
    loadOriginalImage();
  }, [file]);

  const loadOriginalImage = async () => {
    try {
      const img = new Image();
      img.onload = () => {
        setOriginalImage(img);
        setPreviewImage(img);
        drawImageToCanvas(img);
      };
      img.onerror = (error) => {
        console.error('Error loading image:', error);
      };
      img.src = `file://${file.path}`;
    } catch (error) {
      console.error('Error loading original image:', error);
    }
  };

  const drawImageToCanvas = (img: HTMLImageElement) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to image size
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    // Clear canvas and draw image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
  };

  const applyOperation = (operation: ImageOperation) => {
    // Save current state to undo stack
    setUndoStack(prev => [...prev, [...operations]]);
    setRedoStack([]); // Clear redo stack when new operation is applied

    const newOperations = [...operations, operation];
    setOperations(newOperations);
    
    // Apply operations to canvas
    applyOperationsToCanvas(newOperations);
  };

  const applyOperationsToCanvas = (ops: ImageOperation[]) => {
    if (!originalImage || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Reset canvas to original image
    canvas.width = originalImage.naturalWidth;
    canvas.height = originalImage.naturalHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(originalImage, 0, 0);

    // Apply each operation in sequence
    ops.forEach(op => {
      switch (op.type) {
        case 'brightness':
          applyBrightnessFilter(ctx, canvas, op.value as number);
          break;
        case 'contrast':
          applyContrastFilter(ctx, canvas, op.value as number);
          break;
        case 'saturation':
          applySaturationFilter(ctx, canvas, op.value as number);
          break;
        case 'rotate':
          applyRotation(ctx, canvas, (op.value as any).degrees);
          break;
        case 'crop':
          applyCrop(ctx, canvas, op.value as any);
          break;
        case 'resize':
          applyResize(ctx, canvas, op.value as number);
          break;
      }
    });
  };

  const applyBrightnessFilter = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, value: number) => {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, Math.max(0, data[i] + value));     // Red
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + value)); // Green
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + value)); // Blue
    }

    ctx.putImageData(imageData, 0, 0);
  };

  const applyContrastFilter = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, value: number) => {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const factor = (259 * (value + 255)) / (255 * (259 - value));

    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, Math.max(0, factor * (data[i] - 128) + 128));     // Red
      data[i + 1] = Math.min(255, Math.max(0, factor * (data[i + 1] - 128) + 128)); // Green
      data[i + 2] = Math.min(255, Math.max(0, factor * (data[i + 2] - 128) + 128)); // Blue
    }

    ctx.putImageData(imageData, 0, 0);
  };

  const applySaturationFilter = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, value: number) => {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const saturation = value / 100;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const gray = 0.299 * r + 0.587 * g + 0.114 * b;

      data[i] = Math.min(255, Math.max(0, gray + saturation * (r - gray)));
      data[i + 1] = Math.min(255, Math.max(0, gray + saturation * (g - gray)));
      data[i + 2] = Math.min(255, Math.max(0, gray + saturation * (b - gray)));
    }

    ctx.putImageData(imageData, 0, 0);
  };

  const applyRotation = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, degrees: number) => {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // For 90-degree rotations, we need to swap width/height
    if (degrees === 90 || degrees === 270) {
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return;

      tempCanvas.width = canvas.height;
      tempCanvas.height = canvas.width;

      tempCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
      tempCtx.rotate((degrees * Math.PI) / 180);
      tempCtx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);

      canvas.width = tempCanvas.width;
      canvas.height = tempCanvas.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(tempCanvas, 0, 0);
    } else {
      // For 180-degree rotation
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((degrees * Math.PI) / 180);
      ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
    }
  };

  const applyCrop = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, cropArea: any) => {
    const imageData = ctx.getImageData(cropArea.x, cropArea.y, cropArea.width, cropArea.height);
    canvas.width = cropArea.width;
    canvas.height = cropArea.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.putImageData(imageData, 0, 0);
  };

  const applyResize = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, scale: number) => {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const newWidth = Math.round(canvas.width * scale);
    const newHeight = Math.round(canvas.height * scale);

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    tempCanvas.width = newWidth;
    tempCanvas.height = newHeight;
    tempCtx.drawImage(canvas, 0, 0, newWidth, newHeight);

    canvas.width = newWidth;
    canvas.height = newHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(tempCanvas, 0, 0);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;

    const previousState = undoStack[undoStack.length - 1];
    setRedoStack(prev => [...prev, [...operations]]);
    setUndoStack(prev => prev.slice(0, -1));
    setOperations(previousState);
    applyOperationsToCanvas(previousState);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;

    const nextState = redoStack[redoStack.length - 1];
    setUndoStack(prev => [...prev, [...operations]]);
    setRedoStack(prev => prev.slice(0, -1));
    setOperations(nextState);
    applyOperationsToCanvas(nextState);
  };

  const handleReset = () => {
    setUndoStack(prev => [...prev, [...operations]]);
    setRedoStack([]);
    setOperations([]);
    if (originalImage) {
      drawImageToCanvas(originalImage);
    }
  };

  const handleSave = async () => {
    if (!canvasRef.current) {
      console.error('Canvas not available for saving');
      return;
    }

    try {
      // Get canvas data as base64
      const canvasDataUrl = canvasRef.current.toDataURL('image/jpeg', 0.9);
      
      // Generate output path
      const outputPath = generateEditedFilePath(file.path);
      
      // Save canvas to file via main process
      const result = await window.electronAPI.editor.saveCanvas(canvasDataUrl, outputPath, 90);
      
      if (result.success) {
        // Also call the original onSave with operations for compatibility
        onSave(operations);
      } else {
        console.error('Failed to save canvas:', result.error);
        // Still call onSave to let parent handle the error
        onSave(operations);
      }
    } catch (error) {
      console.error('Error saving canvas:', error);
      // Fallback to original save method
      onSave(operations);
    }
  };

  const generateEditedFilePath = (originalPath: string): string => {
    const lastDotIndex = originalPath.lastIndexOf('.');
    if (lastDotIndex === -1) {
      return `${originalPath}_edited`;
    }
    const basePath = originalPath.substring(0, lastDotIndex);
    const extension = originalPath.substring(lastDotIndex);
    return `${basePath}_edited${extension}`;
  };

  return (
    <div className="image-editor">
      <EditorToolbar
        tools={tools}
        activeTool={activeTool}
        onToolSelect={setActiveTool}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onReset={handleReset}
        onSave={handleSave}
        onCancel={onCancel}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
      />
      
      <div className="editor-content">
        <div className="preview-area">
          <ImagePreview
            canvasRef={canvasRef}
            file={file}
            activeTool={activeTool}
            onCropSelect={(cropArea) => {
              if (activeTool?.type === 'crop') {
                applyOperation({
                  type: 'crop',
                  value: cropArea,
                  timestamp: new Date()
                });
              }
            }}
          />
        </div>
        
        {activeTool && (
          <div className="tool-panel">
            <ToolControlPanel
              tool={activeTool}
              onApplyOperation={applyOperation}
            />
          </div>
        )}
      </div>
    </div>
  );
};