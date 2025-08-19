import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ExportProgressDialog, { ExportProgress } from '../ExportProgressDialog';

describe('ExportProgressDialog', () => {
  let mockOnCancel: ReturnType<typeof vi.fn>;
  let mockOnClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnCancel = vi.fn();
    mockOnClose = vi.fn();
  });

  it('should not render when closed', () => {
    const progress: ExportProgress = {
      current: 0,
      total: 10,
      currentFile: '',
      completed: false
    };

    render(
      <ExportProgressDialog
        isOpen={false}
        progress={progress}
        onCancel={mockOnCancel}
        onClose={mockOnClose}
      />
    );

    expect(screen.queryByText('Exporting Images...')).not.toBeInTheDocument();
  });

  it('should render progress dialog when open', () => {
    const progress: ExportProgress = {
      current: 3,
      total: 10,
      currentFile: 'image3.jpg',
      completed: false
    };

    render(
      <ExportProgressDialog
        isOpen={true}
        progress={progress}
        onCancel={mockOnCancel}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Exporting Images...')).toBeInTheDocument();
    expect(screen.getByText('Processing 3 of 10 images')).toBeInTheDocument();
    expect(screen.getByText('30%')).toBeInTheDocument();
    expect(screen.getByText('image3.jpg')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('should show completion state', () => {
    const progress: ExportProgress = {
      current: 10,
      total: 10,
      currentFile: '',
      completed: true
    };

    render(
      <ExportProgressDialog
        isOpen={true}
        progress={progress}
        onCancel={mockOnCancel}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Export Complete')).toBeInTheDocument();
    expect(screen.getByText('Successfully exported 10 of 10 images')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('Close')).toBeInTheDocument();
    expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
  });

  it('should show error state', () => {
    const progress: ExportProgress = {
      current: 5,
      total: 10,
      currentFile: '',
      completed: false,
      error: 'Failed to export image5.jpg: Permission denied'
    };

    render(
      <ExportProgressDialog
        isOpen={true}
        progress={progress}
        onCancel={mockOnCancel}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Export Complete')).toBeInTheDocument();
    expect(screen.getByText('Export Error:')).toBeInTheDocument();
    expect(screen.getByText('Failed to export image5.jpg: Permission denied')).toBeInTheDocument();
    expect(screen.getByText('Close')).toBeInTheDocument();
    expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
  });

  it('should handle cancel button click', () => {
    const progress: ExportProgress = {
      current: 3,
      total: 10,
      currentFile: 'image3.jpg',
      completed: false
    };

    render(
      <ExportProgressDialog
        isOpen={true}
        progress={progress}
        onCancel={mockOnCancel}
        onClose={mockOnClose}
      />
    );

    fireEvent.click(screen.getByText('Cancel'));
    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should handle close button click', () => {
    const progress: ExportProgress = {
      current: 10,
      total: 10,
      currentFile: '',
      completed: true
    };

    render(
      <ExportProgressDialog
        isOpen={true}
        progress={progress}
        onCancel={mockOnCancel}
        onClose={mockOnClose}
      />
    );

    fireEvent.click(screen.getByText('Close'));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should calculate percentage correctly', () => {
    const progress: ExportProgress = {
      current: 7,
      total: 20,
      currentFile: 'image7.jpg',
      completed: false
    };

    render(
      <ExportProgressDialog
        isOpen={true}
        progress={progress}
        onCancel={mockOnCancel}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('35%')).toBeInTheDocument();
  });

  it('should handle zero total files', () => {
    const progress: ExportProgress = {
      current: 0,
      total: 0,
      currentFile: '',
      completed: false
    };

    render(
      <ExportProgressDialog
        isOpen={true}
        progress={progress}
        onCancel={mockOnCancel}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.getByText('Processing 0 of 0 images')).toBeInTheDocument();
  });

  it('should not show current file when completed', () => {
    const progress: ExportProgress = {
      current: 5,
      total: 5,
      currentFile: 'image5.jpg',
      completed: true
    };

    render(
      <ExportProgressDialog
        isOpen={true}
        progress={progress}
        onCancel={mockOnCancel}
        onClose={mockOnClose}
      />
    );

    expect(screen.queryByText('Current file:')).not.toBeInTheDocument();
    expect(screen.queryByText('image5.jpg')).not.toBeInTheDocument();
  });

  it('should show progress bar with correct width', () => {
    const progress: ExportProgress = {
      current: 6,
      total: 10,
      currentFile: 'image6.jpg',
      completed: false
    };

    render(
      <ExportProgressDialog
        isOpen={true}
        progress={progress}
        onCancel={mockOnCancel}
        onClose={mockOnClose}
      />
    );

    const progressBar = document.querySelector('.progress-bar');
    expect(progressBar).toHaveStyle({ width: '60%' });
  });

  it('should not show cancel button when onCancel is not provided', () => {
    const progress: ExportProgress = {
      current: 3,
      total: 10,
      currentFile: 'image3.jpg',
      completed: false
    };

    render(
      <ExportProgressDialog
        isOpen={true}
        progress={progress}
        onClose={mockOnClose}
      />
    );

    expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
  });
});