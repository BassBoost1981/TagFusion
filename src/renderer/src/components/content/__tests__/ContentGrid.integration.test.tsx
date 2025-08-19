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
    name: 'item1.jpg',
    path: 'C:\\item1.jpg',
    type: 'image',
    dateModified: new Date('2024-01-15'),
    hasSubfolders: false,
    mediaCount: 0,
    extension: '.jpg',
    size: 1000000,
  },
  {
    id: '2',
    name: 'item2.jpg',
    path: 'C:\\item2.jpg',
    type: 'image',
    dateModified: new Date('2024-01-14'),
    hasSubfolders: false,
    mediaCount: 0,
    extension: '.jpg',
    size: 2000000,
  },
  {
    id: '3',
    name: 'item3.jpg',
    path: 'C:\\item3.jpg',
    type: 'image',
    dateModified: new Date('2024-01-13'),
    hasSubfolders: false,
    mediaCount: 0,
    extension: '.jpg',
    size: 3000000,
  },
];

describe('ContentGrid Multi-Selection Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.getBoundingClientRect = mockGetBoundingClientRect;
  });

  it('handles Windows-standard multi-selection behavior', async () => {
    const onItemSelect = vi.fn();
    const selectedItems = new Set<string>();
    
    const { rerender } = render(
      <ContentGrid
        items={mockItems}
        viewMode="grid"
        selectedItems={selectedItems}
        onItemSelect={onItemSelect}
        onItemDoubleClick={vi.fn()}
        thumbnailSize={80}
        sortBy="name"
        sortOrder="asc"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('item1.jpg')).toBeInTheDocument();
    });

    // Single selection
    const item1 = screen.getByText('item1.jpg').closest('.grid-item');
    fireEvent.click(item1!);
    
    expect(onItemSelect).toHaveBeenCalledWith(
      mockItems[0],
      expect.objectContaining({ ctrlKey: false, shiftKey: false })
    );

    // Ctrl+Click for multi-selection
    const item2 = screen.getByText('item2.jpg').closest('.grid-item');
    fireEvent.click(item2!, { ctrlKey: true });
    
    expect(onItemSelect).toHaveBeenCalledWith(
      mockItems[1],
      expect.objectContaining({ ctrlKey: true, shiftKey: false })
    );

    // Shift+Click for range selection
    const item3 = screen.getByText('item3.jpg').closest('.grid-item');
    fireEvent.click(item3!, { shiftKey: true });
    
    expect(onItemSelect).toHaveBeenCalledWith(
      mockItems[2],
      expect.objectContaining({ ctrlKey: false, shiftKey: true })
    );
  });

  it('shows visual selection feedback', async () => {
    const selectedItems = new Set(['C:\\item1.jpg', 'C:\\item3.jpg']);
    
    render(
      <ContentGrid
        items={mockItems}
        viewMode="grid"
        selectedItems={selectedItems}
        onItemSelect={vi.fn()}
        onItemDoubleClick={vi.fn()}
        thumbnailSize={80}
        sortBy="name"
        sortOrder="asc"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('item1.jpg')).toBeInTheDocument();
    });

    // Check that selected items have the selected class
    const item1 = screen.getByText('item1.jpg').closest('.grid-item');
    const item2 = screen.getByText('item2.jpg').closest('.grid-item');
    const item3 = screen.getByText('item3.jpg').closest('.grid-item');

    expect(item1).toHaveClass('selected');
    expect(item2).not.toHaveClass('selected');
    expect(item3).toHaveClass('selected');
  });

  it('works in both grid and list view modes', async () => {
    const onItemSelect = vi.fn();
    
    // Test grid view
    const { rerender } = render(
      <ContentGrid
        items={mockItems}
        viewMode="grid"
        selectedItems={new Set()}
        onItemSelect={onItemSelect}
        onItemDoubleClick={vi.fn()}
        thumbnailSize={80}
        sortBy="name"
        sortOrder="asc"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('item1.jpg')).toBeInTheDocument();
    });

    const gridItem = screen.getByText('item1.jpg').closest('.grid-item');
    fireEvent.click(gridItem!);
    expect(onItemSelect).toHaveBeenCalled();

    // Test list view
    onItemSelect.mockClear();
    rerender(
      <ContentGrid
        items={mockItems}
        viewMode="list"
        selectedItems={new Set()}
        onItemSelect={onItemSelect}
        onItemDoubleClick={vi.fn()}
        thumbnailSize={80}
        sortBy="name"
        sortOrder="asc"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('item1.jpg')).toBeInTheDocument();
    });

    const listItem = screen.getByText('item1.jpg').closest('.list-item');
    fireEvent.click(listItem!);
    expect(onItemSelect).toHaveBeenCalled();
  });
});