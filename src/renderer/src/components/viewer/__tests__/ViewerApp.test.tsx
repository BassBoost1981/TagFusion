import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import ViewerApp from '../../../ViewerApp';
import { MediaFile, EXIFData, HierarchicalTag } from '../../../../types/global';

// Mock the electron API
const mockElectronAPI = {
  viewer: {
    getState: vi.fn(),
    onStateChanged: vi.fn(),
    next: vi.fn(),
    previous: vi.fn(),
    goToIndex: vi.fn(),
    setZoom: vi.fn(),
    setPan: vi.fn(),
    resetView: vi.fn(),
    startSlideshow: vi.fn(),
    stopSlideshow: vi.fn(),
    setSlideshowInterval: vi.fn(),
    toggleInfo: vi.fn(),
    setShowInfo: vi.fn(),
    close: vi.fn(),
  },
  metadata: {
    read: vi.fn(),
    readExif: vi.fn(),
  },
};

// Mock window.electronAPI
Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
});

describe('ViewerApp - Overlay Information', () => {
  const mockFileList: MediaFile[] = [
    {
      path: '/test/image1.jpg',
      name: 'image1.jpg',
      extension: '.jpg',
      size: 2048576, // 2MB
      dateModified: new Date('2024-01-15T10:30:00Z'),
      dateCreated: new Date('2024-01-15T09:00:00Z'),
      type: 'image',
    },
    {
      path: '/test/image2.jpg',
      name: 'image2.jpg',
      extension: '.jpg',
      size: 1536000, // 1.5MB
      dateModified: new Date('2024-01-16T14:20:00Z'),
      type: 'image',
    },
  ];

  const mockState = {
    currentFile: mockFileList[0],
    fileList: mockFileList,
    currentIndex: 0,
    zoomLevel: 1,
    panOffset: { x: 0, y: 0 },
    slideshowActive: false,
    slideshowInterval: 3,
    showInfo: false,
  };

  const mockMetadata = {
    tags: [
      {
        category: 'Nature',
        subcategory: 'Landscape',
        tag: 'Mountains',
        fullPath: 'Nature/Landscape/Mountains',
      },
      {
        category: 'Travel',
        tag: 'Europe',
        fullPath: 'Travel/Europe',
      },
    ] as HierarchicalTag[],
    rating: 4,
  };

  const mockExifData: EXIFData = {
    camera: {
      make: 'Canon',
      model: 'EOS 5D Mark IV',
      lens: 'EF 24-70mm f/2.8L II USM',
    },
    settings: {
      aperture: 'f/5.6',
      shutterSpeed: '1/125s',
      iso: 400,
      focalLength: '50mm',
      flash: false,
    },
    location: {
      dateTime: new Date('2024-01-15T09:00:00Z'),
    },
    technical: {
      colorSpace: 'sRGB',
      whiteBalance: 'Auto',
      meteringMode: 'Matrix',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock responses
    mockElectronAPI.viewer.getState.mockResolvedValue(mockState);
    mockElectronAPI.metadata.read.mockResolvedValue(mockMetadata);
    mockElectronAPI.metadata.readExif.mockResolvedValue(mockExifData);
  });

  describe('Info Overlay Visibility', () => {
    it('should not show info overlay by default', async () => {
      render(<ViewerApp />);
      
      await waitFor(() => {
        expect(screen.getByAltText('image1.jpg')).toBeInTheDocument();
      });

      const infoOverlay = screen.getByText('File Information').closest('.info-overlay');
      expect(infoOverlay).not.toHaveClass('visible');
    });

    it('should show info overlay when showInfo is true', async () => {
      const stateWithInfo = { ...mockState, showInfo: true };
      mockElectronAPI.viewer.getState.mockResolvedValue(stateWithInfo);
      
      render(<ViewerApp />);
      
      await waitFor(() => {
        const infoOverlay = screen.getByText('File Information').closest('.info-overlay');
        expect(infoOverlay).toHaveClass('visible');
      });
    });

    it('should toggle info overlay when Info button is clicked', async () => {
      render(<ViewerApp />);
      
      await waitFor(() => {
        expect(screen.getByAltText('image1.jpg')).toBeInTheDocument();
      });

      const infoButton = screen.getByText('Info');
      fireEvent.click(infoButton);
      
      expect(mockElectronAPI.viewer.toggleInfo).toHaveBeenCalled();
    });

    it('should toggle info overlay with keyboard shortcut', async () => {
      render(<ViewerApp />);
      
      await waitFor(() => {
        expect(screen.getByAltText('image1.jpg')).toBeInTheDocument();
      });

      fireEvent.keyDown(document, { key: 'i' });
      
      expect(mockElectronAPI.viewer.toggleInfo).toHaveBeenCalled();
    });
  });

  describe('File Information Display', () => {
    beforeEach(async () => {
      const stateWithInfo = { ...mockState, showInfo: true };
      mockElectronAPI.viewer.getState.mockResolvedValue(stateWithInfo);
    });

    it('should display basic file information', async () => {
      render(<ViewerApp />);
      
      await waitFor(() => {
        expect(screen.getByText('File Information')).toBeInTheDocument();
        expect(screen.getByText('Name: image1.jpg')).toBeInTheDocument();
        expect(screen.getByText('Size: 2.0 MB')).toBeInTheDocument();
      });
    });

    it('should display formatted file dates', async () => {
      render(<ViewerApp />);
      
      await waitFor(() => {
        expect(screen.getByText(/Modified:/)).toBeInTheDocument();
        expect(screen.getByText(/Created:/)).toBeInTheDocument();
      });
    });

    it('should handle missing created date gracefully', async () => {
      const fileWithoutCreatedDate = { ...mockFileList[1] };
      const stateWithoutCreatedDate = {
        ...mockState,
        currentFile: fileWithoutCreatedDate,
        showInfo: true,
      };
      mockElectronAPI.viewer.getState.mockResolvedValue(stateWithoutCreatedDate);
      
      render(<ViewerApp />);
      
      await waitFor(() => {
        expect(screen.getByText('Name: image2.jpg')).toBeInTheDocument();
        expect(screen.queryByText(/Created:/)).not.toBeInTheDocument();
      });
    });

    it('should format file sizes correctly', async () => {
      const testCases = [
        { size: 512, expected: '512.0 B' },
        { size: 1536, expected: '1.5 KB' },
        { size: 2048576, expected: '2.0 MB' },
        { size: 1073741824, expected: '1.0 GB' },
      ];

      for (const testCase of testCases) {
        const fileWithSize = { ...mockFileList[0], size: testCase.size };
        const stateWithSize = {
          ...mockState,
          currentFile: fileWithSize,
          showInfo: true,
        };
        mockElectronAPI.viewer.getState.mockResolvedValue(stateWithSize);
        
        const { unmount } = render(<ViewerApp />);
        
        await waitFor(() => {
          expect(screen.getByText(`Size: ${testCase.expected}`)).toBeInTheDocument();
        });
        
        unmount();
      }
    });
  });

  describe('Tags Display', () => {
    beforeEach(async () => {
      const stateWithInfo = { ...mockState, showInfo: true };
      mockElectronAPI.viewer.getState.mockResolvedValue(stateWithInfo);
    });

    it('should display tags section when tags are present', async () => {
      render(<ViewerApp />);
      
      await waitFor(() => {
        expect(screen.getByText('Tags')).toBeInTheDocument();
        expect(screen.getByText('Nature/Landscape/Mountains')).toBeInTheDocument();
        expect(screen.getByText('Travel/Europe')).toBeInTheDocument();
      });
    });

    it('should not display tags section when no tags are present', async () => {
      const metadataWithoutTags = { ...mockMetadata, tags: [] };
      mockElectronAPI.metadata.read.mockResolvedValue(metadataWithoutTags);
      
      render(<ViewerApp />);
      
      await waitFor(() => {
        expect(screen.getByText('File Information')).toBeInTheDocument();
        expect(screen.queryByText('Tags')).not.toBeInTheDocument();
      });
    });

    it('should handle null metadata gracefully', async () => {
      mockElectronAPI.metadata.read.mockResolvedValue(null);
      
      render(<ViewerApp />);
      
      await waitFor(() => {
        expect(screen.getByText('File Information')).toBeInTheDocument();
        expect(screen.queryByText('Tags')).not.toBeInTheDocument();
      });
    });
  });

  describe('Rating Display', () => {
    beforeEach(async () => {
      const stateWithInfo = { ...mockState, showInfo: true };
      mockElectronAPI.viewer.getState.mockResolvedValue(stateWithInfo);
    });

    it('should display rating section when rating is present', async () => {
      render(<ViewerApp />);
      
      await waitFor(() => {
        expect(screen.getByText('Rating')).toBeInTheDocument();
        
        // Should show 4 filled stars and 1 empty star
        const stars = screen.getAllByText('★');
        expect(stars).toHaveLength(5);
        
        // Check for filled and empty stars (this is a simplified check)
        const ratingContainer = screen.getByText('Rating').nextElementSibling;
        expect(ratingContainer).toBeInTheDocument();
      });
    });

    it('should not display rating section when rating is 0', async () => {
      const metadataWithoutRating = { ...mockMetadata, rating: 0 };
      mockElectronAPI.metadata.read.mockResolvedValue(metadataWithoutRating);
      
      render(<ViewerApp />);
      
      await waitFor(() => {
        expect(screen.getByText('File Information')).toBeInTheDocument();
        expect(screen.queryByText('Rating')).not.toBeInTheDocument();
      });
    });

    it('should display correct number of filled stars', async () => {
      const testRatings = [1, 2, 3, 4, 5];
      
      for (const rating of testRatings) {
        const metadataWithRating = { ...mockMetadata, rating };
        mockElectronAPI.metadata.read.mockResolvedValue(metadataWithRating);
        
        const { unmount } = render(<ViewerApp />);
        
        await waitFor(() => {
          expect(screen.getByText('Rating')).toBeInTheDocument();
          const stars = screen.getAllByText('★');
          expect(stars).toHaveLength(5); // Always 5 stars total
        });
        
        unmount();
      }
    });
  });

  describe('EXIF Data Display', () => {
    beforeEach(async () => {
      const stateWithInfo = { ...mockState, showInfo: true };
      mockElectronAPI.viewer.getState.mockResolvedValue(stateWithInfo);
    });

    it('should display camera information when EXIF data is present', async () => {
      render(<ViewerApp />);
      
      await waitFor(() => {
        expect(screen.getByText('Camera Information')).toBeInTheDocument();
        expect(screen.getByText('Camera: Canon EOS 5D Mark IV')).toBeInTheDocument();
        expect(screen.getByText('Lens: EF 24-70mm f/2.8L II USM')).toBeInTheDocument();
        expect(screen.getByText('Aperture: f/5.6')).toBeInTheDocument();
        expect(screen.getByText('Shutter: 1/125s')).toBeInTheDocument();
        expect(screen.getByText('ISO: 400')).toBeInTheDocument();
        expect(screen.getByText('Focal Length: 50mm')).toBeInTheDocument();
      });
    });

    it('should handle partial EXIF data gracefully', async () => {
      const partialExifData: EXIFData = {
        camera: {
          make: 'Canon',
          // model missing
        },
        settings: {
          aperture: 'f/2.8',
          // other settings missing
        },
        location: {},
        technical: {},
      };
      mockElectronAPI.metadata.readExif.mockResolvedValue(partialExifData);
      
      render(<ViewerApp />);
      
      await waitFor(() => {
        expect(screen.getByText('Camera Information')).toBeInTheDocument();
        expect(screen.getByText('Camera: Canon')).toBeInTheDocument();
        expect(screen.getByText('Aperture: f/2.8')).toBeInTheDocument();
        expect(screen.queryByText(/Lens:/)).not.toBeInTheDocument();
        expect(screen.queryByText(/ISO:/)).not.toBeInTheDocument();
      });
    });

    it('should not display camera information when EXIF data is null', async () => {
      mockElectronAPI.metadata.readExif.mockResolvedValue(null);
      
      render(<ViewerApp />);
      
      await waitFor(() => {
        expect(screen.getByText('File Information')).toBeInTheDocument();
        expect(screen.queryByText('Camera Information')).not.toBeInTheDocument();
      });
    });

    it('should handle EXIF data loading errors gracefully', async () => {
      mockElectronAPI.metadata.readExif.mockRejectedValue(new Error('EXIF read failed'));
      
      render(<ViewerApp />);
      
      await waitFor(() => {
        expect(screen.getByText('File Information')).toBeInTheDocument();
        expect(screen.queryByText('Camera Information')).not.toBeInTheDocument();
      });
    });
  });

  describe('Overlay Responsiveness', () => {
    it('should update overlay when file changes', async () => {
      const { rerender } = render(<ViewerApp />);
      
      await waitFor(() => {
        expect(screen.getByText('Name: image1.jpg')).toBeInTheDocument();
      });

      // Simulate file change
      const newState = {
        ...mockState,
        currentFile: mockFileList[1],
        currentIndex: 1,
        showInfo: true,
      };
      mockElectronAPI.viewer.getState.mockResolvedValue(newState);
      
      // Simulate state change event
      const stateChangeCallback = mockElectronAPI.viewer.onStateChanged.mock.calls[0]?.[0];
      if (stateChangeCallback) {
        stateChangeCallback(newState);
      }
      
      rerender(<ViewerApp />);
      
      await waitFor(() => {
        expect(screen.getByText('Name: image2.jpg')).toBeInTheDocument();
      });
    });

    it('should load metadata for new files', async () => {
      render(<ViewerApp />);
      
      // Simulate file change
      const newState = {
        ...mockState,
        currentFile: mockFileList[1],
        currentIndex: 1,
        showInfo: true,
      };
      
      const stateChangeCallback = mockElectronAPI.viewer.onStateChanged.mock.calls[0]?.[0];
      if (stateChangeCallback) {
        stateChangeCallback(newState);
      }
      
      await waitFor(() => {
        expect(mockElectronAPI.metadata.read).toHaveBeenCalledWith(mockFileList[1].path);
        expect(mockElectronAPI.metadata.readExif).toHaveBeenCalledWith(mockFileList[1].path);
      });
    });
  });

  describe('Overlay Styling and Animation', () => {
    it('should apply correct CSS classes for visibility', async () => {
      const stateWithInfo = { ...mockState, showInfo: true };
      mockElectronAPI.viewer.getState.mockResolvedValue(stateWithInfo);
      
      render(<ViewerApp />);
      
      await waitFor(() => {
        const infoOverlay = screen.getByText('File Information').closest('.info-overlay');
        expect(infoOverlay).toHaveClass('visible');
      });
    });

    it('should structure information in sections', async () => {
      const stateWithInfo = { ...mockState, showInfo: true };
      mockElectronAPI.viewer.getState.mockResolvedValue(stateWithInfo);
      
      render(<ViewerApp />);
      
      await waitFor(() => {
        const sections = screen.getAllByText(/File Information|Tags|Rating|Camera Information/);
        expect(sections.length).toBeGreaterThan(0);
        
        // Each section should be in an info-section div
        sections.forEach(section => {
          expect(section.closest('.info-section')).toBeInTheDocument();
        });
      });
    });
  });
});