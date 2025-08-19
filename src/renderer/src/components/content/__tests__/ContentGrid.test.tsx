import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ContentGrid, GridItem } from '../ContentGrid';
import { vi } from 'vitest';

// Mock CSS imports
vi.mock('../ContentGrid.css', () => ({}));

// Mock getBoundingClientRect to provide container dimensions
const mockGetBoundingClientRect = vi.fn(() => ({
  width: 800,
  height: 600,
  top: 0,
  left: 0,
  bottom: 600,
  right: 800,
  x: 0,
  y: 0,
  toJSON: vi.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation((callback) => ({
  observe: vi.fn((element) => {
    // Simulate initial size observation
    callback([{
      target: element,
      contentRect: { width: 800, height: 600 },
    }]);
  }),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

const mockItems: GridItem[] = [
  {
    id: '1',
    name: 'Documents',
    path: 'C:\\Documents\\',
    type: 'folder',
    dateModified: new Date('2024-01-15'),
    hasSubfolders: true,
    mediaCount: 25,
    extension: '',
    size: 0,
  },
  {
    id: '2',
    name: 'vacation.jpg',
    path: 'C:\\vacation.jpg',
    type: 'image',
    size: 2500000,
    dateModified: new Date('2024-01-13'),
    extension: '.jpg',
    hasSubfolders: false,
    mediaCount: 0,
  },
  {
    id: '3',
    name: 'video.mp4',
    path: 'C:\\video.mp4',
    type: 'video',
    size: 15000000,
    dateModified: new Date('2024-01-11'),
    extension: '.mp4',
    hasSubfolders: false,
    mediaCount: 0,
  },
];

describe('ContentGrid', () => {
  const defaultProps = {
    items: mockItems,
    viewMode: 'grid' as const,
    selectedItems: new Set<string>(),
    onItemSelect: vi.fn(),
    onItemDoubleClick: vi.fn(),
    thumbnailSize: 80,
    sortBy: 'name' as const,
    sortOrder: 'asc' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock getBoundingClientRect for all elements
    Element.prototype.getBoundingClientRect = mockGetBoundingClientRect;
  });

  it('renders grid items correctly', async () => {
    render(<ContentGrid {...defaultProps} />);
    
    // Wait for the virtualized grid to render
    await waitFor(() => {
      expect(screen.getByText('Documents')).toBeInTheDocument();
    });
    
    expect(screen.getByText('vacation.jpg')).toBeInTheDocument();
    expect(screen.getByText('video.mp4')).toBeInTheDocument();
  });

  it('handles item selection', async () => {
    const onItemSelect = vi.fn();
    render(<ContentGrid {...defaultProps} onItemSelect={onItemSelect} />);
    
    await waitFor(() => {
      expect(screen.getByText('Documents')).toBeInTheDocument();
    });
    
    const firstItem = screen.getByText('Documents').closest('.grid-item');
    expect(firstItem).toBeInTheDocument();
    
    fireEvent.click(firstItem!);
    expect(onItemSelect).toHaveBeenCalledWith(
      mockItems[0],
      expect.any(Object)
    );
  });

  it('handles double click', async () => {
    const onItemDoubleClick = vi.fn();
    render(<ContentGrid {...defaultProps} onItemDoubleClick={onItemDoubleClick} />);
    
    await waitFor(() => {
      expect(screen.getByText('Documents')).toBeInTheDocument();
    });
    
    const firstItem = screen.getByText('Documents').closest('.grid-item');
    expect(firstItem).toBeInTheDocument();
    
    fireEvent.doubleClick(firstItem!);
    expect(onItemDoubleClick).toHaveBeenCalledWith(mockItems[0]);
  });

  it('shows selected items with correct styling', async () => {
    const selectedItems = new Set(['C:\\vacation.jpg']);
    render(<ContentGrid {...defaultProps} selectedItems={selectedItems} />);
    
    await waitFor(() => {
      expect(screen.getByText('vacation.jpg')).toBeInTheDocument();
    });
    
    const selectedItem = screen.getByText('vacation.jpg').closest('.grid-item');
    expect(selectedItem).toHaveClass('selected');
  });

  it('switches between grid and list view', async () => {
    const { rerender } = render(<ContentGrid {...defaultProps} viewMode="grid" />);
    
    await waitFor(() => {
      expect(document.querySelector('.virtual-grid')).toBeTruthy();
    });
    
    // Check grid view
    expect(document.querySelector('.virtual-grid')).toBeTruthy();
    expect(document.querySelector('.virtual-list')).toBeFalsy();
    
    // Switch to list view
    rerender(<ContentGrid {...defaultProps} viewMode="list" />);
    
    await waitFor(() => {
      expect(document.querySelector('.virtual-list')).toBeTruthy();
    });
    
    expect(document.querySelector('.virtual-list')).toBeTruthy();
    expect(document.querySelector('.virtual-grid')).toBeFalsy();
  });

  it('sorts items correctly', async () => {
    render(<ContentGrid {...defaultProps} sortBy="name" sortOrder="asc" />);
    
    await waitFor(() => {
      expect(screen.getByText('Documents')).toBeInTheDocument();
    });
    
    const items = screen.getAllByText(/Documents|vacation\.jpg|video\.mp4/);
    // Folders should come first, then files alphabetically
    expect(items[0]).toHaveTextContent('Documents');
    expect(items[1]).toHaveTextContent('vacation.jpg');
    expect(items[2]).toHaveTextContent('video.mp4');
  });

  it('formats file sizes correctly', async () => {
    render(<ContentGrid {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Documents')).toBeInTheDocument();
    });
    
    // Should show file size for files but not folders
    expect(screen.getByText('2.4 MB')).toBeInTheDocument(); // vacation.jpg
    expect(screen.getByText('14.3 MB')).toBeInTheDocument(); // video.mp4
  });

  it('displays correct icons for different file types', async () => {
    render(<ContentGrid {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Documents')).toBeInTheDocument();
    });
    
    const folderIcon = screen.getByText('📁');
    const imageIcon = screen.getByText('🖼️');
    const videoIcon = screen.getByText('🎥');
    
    expect(folderIcon).toBeInTheDocument();
    expect(imageIcon).toBeInTheDocument();
    expect(videoIcon).toBeInTheDocument();
  });

  it('handles context menu', async () => {
    const onContextMenu = vi.fn();
    render(<ContentGrid {...defaultProps} onContextMenu={onContextMenu} />);
    
    await waitFor(() => {
      expect(screen.getByText('Documents')).toBeInTheDocument();
    });
    
    const firstItem = screen.getByText('Documents').closest('.grid-item');
    expect(firstItem).toBeInTheDocument();
    
    fireEvent.contextMenu(firstItem!);
    expect(onContextMenu).toHaveBeenCalledWith(
      mockItems[0],
      expect.any(Object)
    );
  });
});