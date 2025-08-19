import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImageEditor } from '../ImageEditor';
import { MediaFile } from '../../../../../types/global';

// Mock HTML5 Canvas API
const mockCanvas = {
  getContext: vi.fn(() => ({
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({
      data: new Uint8ClampedArray(4),
      width: 100,
      height: 100,
    })),
    putImageData: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
  })),
  width: 100,
  height: 100,
};

// Mock Image constructor
global.Image = class {
  onload: (() => void) | null = null;
  onerror: ((error: any) => void) | null = null;
  src = '';
  naturalWidth = 100;
  naturalHeight = 100;

  constructor() {
    setTimeout(() => {
      if (this.onload) {
        this.onload();
      }
    }, 0);
  }
} as any;

// Mock HTMLCanvasElement
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: vi.fn(() => mockCanvas.getContext()),
});

describe('ImageEditor', () => {
  const mockFile: MediaFile = {
    path: '/test/image.jpg',
    name: 'image.jpg',
    extension: 'jpg',
    size: 1024000,
    dateModified: new Date(),
    type: 'image',
  };

  const mockOnSave = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render editor with toolbar and preview', async () => {
    render(
      <ImageEditor
        file={mockFile}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    // Check if toolbar is rendered
    expect(screen.getByText(/Save/)).toBeInTheDocument();
    expect(screen.getByText(/Cancel/)).toBeInTheDocument();
    expect(screen.getByText(/Undo/)).toBeInTheDocument();
    expect(screen.getByText(/Redo/)).toBeInTheDocument();

    // Check if tools are rendered
    expect(screen.getByText('Brightness')).toBeInTheDocument();
    expect(screen.getByText('Contrast')).toBeInTheDocument();
    expect(screen.getByText('Saturation')).toBeInTheDocument();
    expect(screen.getByText('Rotate Left')).toBeInTheDocument();
    expect(screen.getByText('Rotate Right')).toBeInTheDocument();
    expect(screen.getByText('Crop')).toBeInTheDocument();
    expect(screen.getByText('Resize')).toBeInTheDocument();
  });

  it('should call onCancel when cancel button is clicked', () => {
    render(
      <ImageEditor
        file={mockFile}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    fireEvent.click(screen.getByText(/Cancel/));
    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should call onSave when save button is clicked', () => {
    render(
      <ImageEditor
        file={mockFile}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    fireEvent.click(screen.getByText(/Save/));
    expect(mockOnSave).toHaveBeenCalledWith([]);
  });

  it('should activate tool when tool button is clicked', () => {
    render(
      <ImageEditor
        file={mockFile}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    const brightnessButton = screen.getByText('Brightness').closest('button');
    fireEvent.click(brightnessButton!);

    expect(brightnessButton).toHaveClass('active');
  });

  it('should deactivate tool when active tool is clicked again', () => {
    render(
      <ImageEditor
        file={mockFile}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    const brightnessButton = screen.getByText('Brightness').closest('button');
    
    // Activate tool
    fireEvent.click(brightnessButton!);
    expect(brightnessButton).toHaveClass('active');

    // Deactivate tool
    fireEvent.click(brightnessButton!);
    expect(brightnessButton).not.toHaveClass('active');
  });

  it('should show tool control panel when tool is active', () => {
    render(
      <ImageEditor
        file={mockFile}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    const brightnessButton = screen.getByText('Brightness').closest('button');
    fireEvent.click(brightnessButton!);

    // Tool control panel should be visible
    expect(screen.getByText(/Brightness:/)).toBeInTheDocument();
    expect(screen.getByText(/Apply/)).toBeInTheDocument();
    expect(screen.getByDisplayValue('0')).toBeInTheDocument(); // The slider should be visible
  });

  it('should enable undo button after applying operation', async () => {
    render(
      <ImageEditor
        file={mockFile}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    // Initially undo should be disabled
    const undoButton = screen.getByText(/Undo/).closest('button');
    expect(undoButton).toHaveClass('disabled');

    // Activate brightness tool
    const brightnessButton = screen.getByText('Brightness').closest('button');
    fireEvent.click(brightnessButton!);

    // Apply brightness operation
    const applyButton = screen.getByText(/Apply/);
    fireEvent.click(applyButton);

    // Wait for operation to be applied
    await waitFor(() => {
      expect(undoButton).not.toHaveClass('disabled');
    });
  });

  it('should handle rotation operations', () => {
    render(
      <ImageEditor
        file={mockFile}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    // Activate rotate tool
    const rotateButton = screen.getByText('Rotate Left').closest('button');
    fireEvent.click(rotateButton!);

    // Check if rotate controls are shown
    expect(screen.getByText(/90° Left/)).toBeInTheDocument();
    expect(screen.getByText(/90° Right/)).toBeInTheDocument();
    expect(screen.getByText(/180°/)).toBeInTheDocument();
  });

  it('should handle crop tool activation', () => {
    render(
      <ImageEditor
        file={mockFile}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    // Activate crop tool
    const cropButton = screen.getByText('Crop').closest('button');
    fireEvent.click(cropButton!);

    // Check if crop instructions are shown
    expect(screen.getByText(/Click and drag on the image/)).toBeInTheDocument();
    expect(screen.getByText('Aspect Ratio Presets:')).toBeInTheDocument();
  });

  it('should handle resize tool', () => {
    render(
      <ImageEditor
        file={mockFile}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    // Activate resize tool
    const resizeButton = screen.getByText('Resize').closest('button');
    fireEvent.click(resizeButton!);

    // Check if resize controls are shown
    expect(screen.getByText('Scale: 100%')).toBeInTheDocument();
    expect(screen.getByText('Apply Resize')).toBeInTheDocument();
  });

  it('should reset all operations when reset button is clicked', async () => {
    render(
      <ImageEditor
        file={mockFile}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    // Apply an operation first
    const brightnessButton = screen.getByText(/Brightness/).closest('button');
    fireEvent.click(brightnessButton!);
    
    const applyButton = screen.getByText(/Apply/);
    fireEvent.click(applyButton);

    // Wait for undo to be enabled
    await waitFor(() => {
      const undoButton = screen.getByText(/Undo/).closest('button');
      expect(undoButton).not.toHaveClass('disabled');
    });

    // Click reset (the main toolbar reset button)
    const resetButton = screen.getByTitle('Reset to Original');
    fireEvent.click(resetButton);

    // Undo should be enabled (because reset adds to undo stack)
    await waitFor(() => {
      const undoButton = screen.getByText(/Undo/).closest('button');
      expect(undoButton).not.toHaveClass('disabled');
    });
  });
});