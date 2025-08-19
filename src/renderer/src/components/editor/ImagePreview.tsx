import React, { useState, useRef, useEffect } from 'react';
import { MediaFile, CropArea } from '../../../../types/global';
import { EditorTool } from './ImageEditor';
import './ImagePreview.css';

export interface ImagePreviewProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  file: MediaFile;
  activeTool: EditorTool | null;
  onCropSelect: (cropArea: CropArea) => void;
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({
  canvasRef,
  file,
  activeTool,
  onCropSelect,
}) => {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [cropSelection, setCropSelection] = useState<CropArea | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Reset zoom and pan when file changes
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
    setCropSelection(null);
  }, [file]);

  useEffect(() => {
    // Reset crop selection when tool changes
    if (activeTool?.type !== 'crop') {
      setCropSelection(null);
      setIsCropping(false);
    }
  }, [activeTool]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(Math.max(zoomLevel * delta, 0.1), 5);
    setZoomLevel(newZoom);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (activeTool?.type === 'crop') {
      // Start crop selection
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = (e.clientX - rect.left - panOffset.x) / zoomLevel;
      const y = (e.clientY - rect.top - panOffset.y) / zoomLevel;

      setCropSelection({ x, y, width: 0, height: 0 });
      setIsCropping(true);
    } else {
      // Start panning
      setIsDragging(true);
      setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isCropping && cropSelection) {
      // Update crop selection
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const currentX = (e.clientX - rect.left - panOffset.x) / zoomLevel;
      const currentY = (e.clientY - rect.top - panOffset.y) / zoomLevel;

      setCropSelection({
        x: Math.min(cropSelection.x, currentX),
        y: Math.min(cropSelection.y, currentY),
        width: Math.abs(currentX - cropSelection.x),
        height: Math.abs(currentY - cropSelection.y),
      });
    } else if (isDragging) {
      // Update pan offset
      setPanOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    if (isCropping && cropSelection && cropSelection.width > 0 && cropSelection.height > 0) {
      onCropSelect(cropSelection);
      setCropSelection(null);
    }
    setIsDragging(false);
    setIsCropping(false);
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev * 1.2, 5));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev / 1.2, 0.1));
  };

  const handleZoomReset = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleFitToWindow = () => {
    if (!canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    
    const containerWidth = container.clientWidth - 40; // Account for padding
    const containerHeight = container.clientHeight - 40;
    
    const scaleX = containerWidth / canvas.width;
    const scaleY = containerHeight / canvas.height;
    const scale = Math.min(scaleX, scaleY, 1); // Don't zoom in beyond 100%
    
    setZoomLevel(scale);
    setPanOffset({ x: 0, y: 0 });
  };

  return (
    <div className="image-preview" ref={containerRef}>
      <div className="preview-controls">
        <div className="zoom-controls">
          <button
            className="control-button"
            onClick={handleZoomOut}
            title="Zoom Out (-)"
          >
            🔍-
          </button>
          <span className="zoom-level">{Math.round(zoomLevel * 100)}%</span>
          <button
            className="control-button"
            onClick={handleZoomIn}
            title="Zoom In (+)"
          >
            🔍+
          </button>
          <button
            className="control-button"
            onClick={handleZoomReset}
            title="Reset Zoom (Ctrl+0)"
          >
            🎯
          </button>
          <button
            className="control-button"
            onClick={handleFitToWindow}
            title="Fit to Window"
          >
            📐
          </button>
        </div>
        
        {activeTool && (
          <div className="active-tool-indicator">
            <span className="tool-icon">{activeTool.icon}</span>
            <span className="tool-name">{activeTool.name}</span>
            {activeTool.type === 'crop' && (
              <span className="tool-hint">Click and drag to select crop area</span>
            )}
          </div>
        )}
      </div>

      <div
        className={`canvas-container ${activeTool?.type === 'crop' ? 'crop-mode' : ''}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <canvas
          ref={canvasRef}
          className="preview-canvas"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
            cursor: activeTool?.type === 'crop' ? 'crosshair' : isDragging ? 'grabbing' : 'grab',
          }}
        />
        
        {cropSelection && isCropping && (
          <div
            className="crop-selection"
            style={{
              left: cropSelection.x * zoomLevel + panOffset.x,
              top: cropSelection.y * zoomLevel + panOffset.y,
              width: cropSelection.width * zoomLevel,
              height: cropSelection.height * zoomLevel,
            }}
          />
        )}
      </div>

      <div className="preview-info">
        <span className="file-name">{file.name}</span>
        <span className="file-size">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
      </div>
    </div>
  );
};