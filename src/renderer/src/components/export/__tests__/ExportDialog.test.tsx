import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ExportDialog, { ExportSettings } from '../ExportDialog';
import { MediaFile } from '../../../../../types/global';

// Mock the electron API
const mockElectronAPI = {
  invoke: vi.fn()
};

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true
});

describe('ExportDialog', () => {
  let mockFiles: MediaFile[];
  let mockOnClose: ReturnType<typeof vi.fn>;
  let mockOnExport: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFiles = [
      {
        path: '/test/image1.jpg',
        name: 'image1.jpg',
        extension: '.jpg',
        size: 1024000,
        dateModified: new Date(),
        type: 'image'
      },
      {
        path: '/test/image2.png',
        name: 'image2.png',
        extension: '.png',
        size: 2048000,
        dateModified: new Date(),
        type: 'image'
      },
      {
        path: '/test/video.mp4',
        name: 'video.mp4',
        extension: '.mp4',
        size: 10240000,
        dateModified: new Date(),
        type: 'video'
      }
    ];

    mockOnClose = vi.fn();
    mockOnExport = vi.fn();
    mockElectronAPI.invoke.mockClear();
  });

  it('should render when open', () => {
    render(
      <ExportDialog
        isOpen={true}
        files={mockFiles}
        onClose={mockOnClose}
        onExport={mockOnExport}
      />
    );

    expect(screen.getByText('Export Images')).toBeInTheDocument();
    expect(screen.getByText('2 images selected for export')).toBeInTheDocument();
    expect(screen.getByText('(1 video file will be skipped)')).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    render(
      <ExportDialog
        isOpen={false}
        files={mockFiles}
        onClose={mockOnClose}
        onExport={mockOnExport}
      />
    );

    expect(screen.queryByText('Export Images')).not.toBeInTheDocument();
  });

  it('should handle close button click', () => {
    render(
      <ExportDialog
        isOpen={true}
        files={mockFiles}
        onClose={mockOnClose}
        onExport={mockOnExport}
      />
    );

    fireEvent.click(screen.getByText('×'));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should handle cancel button click', () => {
    render(
      <ExportDialog
        isOpen={true}
        files={mockFiles}
        onClose={mockOnClose}
        onExport={mockOnExport}
      />
    );

    fireEvent.click(screen.getByText('Cancel'));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should apply preset settings', () => {
    render(
      <ExportDialog
        isOpen={true}
        files={mockFiles}
        onClose={mockOnClose}
        onExport={mockOnExport}
      />
    );

    fireEvent.click(screen.getByText('Web High Quality'));

    // Check that web size is selected
    expect(screen.getByDisplayValue('web')).toBeChecked();
    
    // Check quality slider
    const qualitySlider = screen.getByRole('slider');
    expect(qualitySlider).toHaveValue('85');
  });

  it('should handle size option changes', () => {
    render(
      <ExportDialog
        isOpen={true}
        files={mockFiles}
        onClose={mockOnClose}
        onExport={mockOnExport}
      />
    );

    // Select custom size
    fireEvent.click(screen.getByLabelText('Custom Size'));
    
    // Custom size inputs should appear
    expect(screen.getByPlaceholderText('Width')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Height')).toBeInTheDocument();
  });

  it('should handle custom dimensions input', () => {
    render(
      <ExportDialog
        isOpen={true}
        files={mockFiles}
        onClose={mockOnClose}
        onExport={mockOnExport}
      />
    );

    // Select custom size
    fireEvent.click(screen.getByLabelText('Custom Size'));
    
    // Enter custom dimensions
    const widthInput = screen.getByPlaceholderText('Width');
    const heightInput = screen.getByPlaceholderText('Height');
    
    fireEvent.change(widthInput, { target: { value: '800' } });
    fireEvent.change(heightInput, { target: { value: '600' } });
    
    expect(widthInput).toHaveValue(800);
    expect(heightInput).toHaveValue(600);
    expect(screen.getByText('Max 800×600')).toBeInTheDocument();
  });

  it('should handle format selection', () => {
    render(
      <ExportDialog
        isOpen={true}
        files={mockFiles}
        onClose={mockOnClose}
        onExport={mockOnExport}
      />
    );

    const formatSelect = screen.getByDisplayValue('JPEG');
    fireEvent.change(formatSelect, { target: { value: 'png' } });
    
    expect(formatSelect).toHaveValue('png');
    expect(screen.getByText('.png')).toBeInTheDocument();
  });

  it('should handle quality slider', () => {
    render(
      <ExportDialog
        isOpen={true}
        files={mockFiles}
        onClose={mockOnClose}
        onExport={mockOnExport}
      />
    );

    const qualitySlider = screen.getByRole('slider');
    fireEvent.change(qualitySlider, { target: { value: '70' } });
    
    expect(screen.getByText('Quality: 70%')).toBeInTheDocument();
  });

  it('should handle metadata preservation checkbox', () => {
    render(
      <ExportDialog
        isOpen={true}
        files={mockFiles}
        onClose={mockOnClose}
        onExport={mockOnExport}
      />
    );

    const metadataCheckbox = screen.getByLabelText('Preserve metadata (EXIF, tags, etc.)');
    fireEvent.click(metadataCheckbox);
    
    expect(metadataCheckbox).toBeChecked();
  });

  it('should handle directory selection', async () => {
    mockElectronAPI.invoke.mockResolvedValue('/selected/directory');

    render(
      <ExportDialog
        isOpen={true}
        files={mockFiles}
        onClose={mockOnClose}
        onExport={mockOnExport}
      />
    );

    fireEvent.click(screen.getByText('Browse...'));

    await waitFor(() => {
      expect(mockElectronAPI.invoke).toHaveBeenCalledWith('export:selectDirectory');
    });
  });

  it('should handle filename prefix and suffix', () => {
    render(
      <ExportDialog
        isOpen={true}
        files={mockFiles}
        onClose={mockOnClose}
        onExport={mockOnExport}
      />
    );

    const prefixInput = screen.getByPlaceholderText('Prefix (optional)');
    const suffixInput = screen.getByPlaceholderText('Suffix (optional)');
    
    fireEvent.change(prefixInput, { target: { value: 'exported_' } });
    fireEvent.change(suffixInput, { target: { value: '_final' } });
    
    expect(prefixInput).toHaveValue('exported_');
    expect(suffixInput).toHaveValue('_final');
  });

  it('should validate required fields before export', () => {
    render(
      <ExportDialog
        isOpen={true}
        files={mockFiles}
        onClose={mockOnClose}
        onExport={mockOnExport}
      />
    );

    // Try to export without selecting directory
    fireEvent.click(screen.getByText('Export 2 Images'));
    
    expect(mockOnExport).not.toHaveBeenCalled();
  });

  it('should validate custom dimensions', () => {
    render(
      <ExportDialog
        isOpen={true}
        files={mockFiles}
        onClose={mockOnClose}
        onExport={mockOnExport}
      />
    );

    // Select custom size without entering dimensions
    fireEvent.click(screen.getByLabelText('Custom Size'));
    
    // Set output directory
    const directoryInput = screen.getByPlaceholderText('Select output directory...');
    fireEvent.change(directoryInput, { target: { value: '/test/output' } });
    
    // Try to export
    fireEvent.click(screen.getByText('Export 2 Images'));
    
    expect(mockOnExport).not.toHaveBeenCalled();
  });

  it('should call onExport with correct settings', async () => {
    mockElectronAPI.invoke.mockResolvedValue('/test/output');

    render(
      <ExportDialog
        isOpen={true}
        files={mockFiles}
        onClose={mockOnClose}
        onExport={mockOnExport}
      />
    );

    // Configure settings
    fireEvent.click(screen.getByLabelText('Original Size'));
    
    const formatSelect = screen.getByDisplayValue('JPEG');
    fireEvent.change(formatSelect, { target: { value: 'png' } });
    
    const qualitySlider = screen.getByRole('slider');
    fireEvent.change(qualitySlider, { target: { value: '90' } });
    
    const metadataCheckbox = screen.getByLabelText('Preserve metadata (EXIF, tags, etc.)');
    fireEvent.click(metadataCheckbox);
    
    // Select directory
    fireEvent.click(screen.getByText('Browse...'));
    
    await waitFor(() => {
      expect(mockElectronAPI.invoke).toHaveBeenCalled();
    });

    // Export
    fireEvent.click(screen.getByText('Export 2 Images'));
    
    expect(mockOnExport).toHaveBeenCalledWith({
      size: 'original',
      quality: 90,
      format: 'png',
      preserveMetadata: true,
      outputDirectory: '/test/output',
      filenamePrefix: '',
      filenameSuffix: ''
    });
  });

  it('should show correct file count for images only', () => {
    const imageOnlyFiles = mockFiles.filter(f => f.type === 'image');
    
    render(
      <ExportDialog
        isOpen={true}
        files={imageOnlyFiles}
        onClose={mockOnClose}
        onExport={mockOnExport}
      />
    );

    expect(screen.getByText('2 images selected for export')).toBeInTheDocument();
    expect(screen.queryByText('video file')).not.toBeInTheDocument();
  });

  it('should handle single image file', () => {
    const singleFile = [mockFiles[0]];
    
    render(
      <ExportDialog
        isOpen={true}
        files={singleFile}
        onClose={mockOnClose}
        onExport={mockOnExport}
      />
    );

    expect(screen.getByText('1 image selected for export')).toBeInTheDocument();
    expect(screen.getByText('Export 1 Image')).toBeInTheDocument();
  });
});