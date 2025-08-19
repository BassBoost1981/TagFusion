import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { PropertiesPanel } from '../PropertiesPanel';
import { MediaFile } from '../../../../../types/global';

// Mock CSS import
vi.mock('../PropertiesPanel.css', () => ({}));

const mockMediaFile: MediaFile = {
  path: '/test/vacation.jpg',
  name: 'vacation.jpg',
  extension: 'jpg',
  size: 2500000,
  dateModified: new Date('2024-01-13T10:30:00'),
  dateCreated: new Date('2024-01-13T10:30:00'),
  type: 'image',
  thumbnailPath: '/test/vacation_thumb.jpg',
};

const mockVideoFile: MediaFile = {
  path: '/test/video.mp4',
  name: 'video.mp4',
  extension: 'mp4',
  size: 50000000,
  dateModified: new Date('2024-01-14T15:45:00'),
  dateCreated: new Date('2024-01-14T15:45:00'),
  type: 'video',
};

describe('PropertiesPanel', () => {
  const defaultProps = {
    selectedItems: new Set<string>(),
    selectedFiles: [],
  };

  it('renders no selection message when no items selected', () => {
    render(<PropertiesPanel {...defaultProps} />);
    
    expect(screen.getByText('No items selected')).toBeInTheDocument();
  });

  it('renders single file properties correctly', () => {
    const props = {
      ...defaultProps,
      selectedItems: new Set(['/test/vacation.jpg']),
      selectedFiles: [mockMediaFile],
    };

    render(<PropertiesPanel {...props} />);
    
    expect(screen.getByText('vacation.jpg')).toBeInTheDocument();
    expect(screen.getByText('2.4 MB')).toBeInTheDocument();
    expect(screen.getByText('JPG Image')).toBeInTheDocument();
    expect(screen.getByText('13.1.2024')).toBeInTheDocument();
  });

  it('renders batch information for multiple files', () => {
    const props = {
      ...defaultProps,
      selectedItems: new Set(['/test/vacation.jpg', '/test/video.mp4']),
      selectedFiles: [mockMediaFile, mockVideoFile],
    };

    render(<PropertiesPanel {...props} />);
    
    expect(screen.getByText('2 items')).toBeInTheDocument();
    expect(screen.getByText('50.1 MB')).toBeInTheDocument(); // Total size
    expect(screen.getByText('JPG Image, MP4 Video')).toBeInTheDocument();
  });

  it('toggles technical details when button is clicked', async () => {
    const props = {
      ...defaultProps,
      selectedItems: new Set(['/test/vacation.jpg']),
      selectedFiles: [mockMediaFile],
    };

    render(<PropertiesPanel {...props} />);
    
    const toggleButton = screen.getByTitle('Toggle technical details');
    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(screen.getByText('Camera Information')).toBeInTheDocument();
      expect(screen.getByText('Canon')).toBeInTheDocument();
      expect(screen.getByText('EOS 5D Mark IV')).toBeInTheDocument();
    });
  });

  it('calls onEditClick when edit button is clicked', () => {
    const onEditClick = vi.fn();
    const props = {
      ...defaultProps,
      selectedItems: new Set(['/test/vacation.jpg']),
      selectedFiles: [mockMediaFile],
      onEditClick,
    };

    render(<PropertiesPanel {...props} />);
    
    const editButton = screen.getByText('Edit');
    fireEvent.click(editButton);

    expect(onEditClick).toHaveBeenCalledWith(mockMediaFile);
  });

  it('calls onFullscreenClick when fullscreen button is clicked', () => {
    const onFullscreenClick = vi.fn();
    const props = {
      ...defaultProps,
      selectedItems: new Set(['/test/vacation.jpg']),
      selectedFiles: [mockMediaFile],
      onFullscreenClick,
    };

    render(<PropertiesPanel {...props} />);
    
    const fullscreenButton = screen.getByText('Fullscreen');
    fireEvent.click(fullscreenButton);

    expect(onFullscreenClick).toHaveBeenCalledWith(mockMediaFile);
  });

  it('calls onRatingChange when star is clicked', () => {
    const onRatingChange = vi.fn();
    const props = {
      ...defaultProps,
      selectedItems: new Set(['/test/vacation.jpg']),
      selectedFiles: [mockMediaFile],
      onRatingChange,
    };

    render(<PropertiesPanel {...props} />);
    
    const stars = screen.getAllByText('⭐');
    fireEvent.click(stars[4]); // Click 5th star

    expect(onRatingChange).toHaveBeenCalledWith([mockMediaFile], 5);
  });

  it('disables edit button for video files', () => {
    const props = {
      ...defaultProps,
      selectedItems: new Set(['/test/video.mp4']),
      selectedFiles: [mockVideoFile],
    };

    render(<PropertiesPanel {...props} />);
    
    const editButton = screen.getByText('Edit');
    expect(editButton).toBeDisabled();
    expect(editButton).toHaveAttribute('title', 'Editing only available for images');
  });

  it('formats file sizes correctly', () => {
    const largeFile: MediaFile = {
      ...mockMediaFile,
      size: 1073741824, // 1 GB
    };

    const props = {
      ...defaultProps,
      selectedItems: new Set(['/test/large.jpg']),
      selectedFiles: [largeFile],
    };

    render(<PropertiesPanel {...props} />);
    
    expect(screen.getByText('1 GB')).toBeInTheDocument();
  });

  it('shows batch rating action for multiple files', () => {
    const onRatingChange = vi.fn();
    const props = {
      ...defaultProps,
      selectedItems: new Set(['/test/vacation.jpg', '/test/video.mp4']),
      selectedFiles: [mockMediaFile, mockVideoFile],
      onRatingChange,
    };

    render(<PropertiesPanel {...props} />);
    
    const batchRateButton = screen.getByText('Rate All ⭐⭐⭐⭐⭐');
    fireEvent.click(batchRateButton);

    expect(onRatingChange).toHaveBeenCalledWith([mockMediaFile, mockVideoFile], 5);
  });

  it('displays file creation date when available', () => {
    const props = {
      ...defaultProps,
      selectedItems: new Set(['/test/vacation.jpg']),
      selectedFiles: [mockMediaFile],
    };

    render(<PropertiesPanel {...props} />);
    
    expect(screen.getByText('Created:')).toBeInTheDocument();
    expect(screen.getByText('13.1.2024')).toBeInTheDocument();
  });

  it('handles files without creation date gracefully', () => {
    const fileWithoutCreationDate: MediaFile = {
      ...mockMediaFile,
      dateCreated: undefined,
    };

    const props = {
      ...defaultProps,
      selectedItems: new Set(['/test/vacation.jpg']),
      selectedFiles: [fileWithoutCreationDate],
    };

    render(<PropertiesPanel {...props} />);
    
    expect(screen.queryByText('Created:')).not.toBeInTheDocument();
  });
});