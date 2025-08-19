import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MainLayout } from '../../renderer/src/components/layout/MainLayout';
import { ContentGrid } from '../../renderer/src/components/content/ContentGrid';
import { TagSystemPanel } from '../../renderer/src/components/tags/TagSystemPanel';
import { PropertiesPanel } from '../../renderer/src/components/properties/PropertiesPanel';
import { DIContainer } from '../../renderer/src/services/DIContainer';
import type { MediaFile, FolderItem, HierarchicalTag } from '../../types/global';

// Mock Electron APIs
const mockElectronAPI = {
  fileSystem: {
    getDirectoryContents: vi.fn(),
    getDirectoryTree: vi.fn(),
    copyFile: vi.fn(),
    moveFile: vi.fn()
  },
  metadata: {
    readMetadata: vi.fn(),
    writeMetadata: vi.fn(),
    extractTags: vi.fn(),
    writeTags: vi.fn(),
    writeRating: vi.fn()
  },
  thumbnails: {
    generateThumbnail: vi.fn(),
    getThumbnail: vi.fn(),
    cacheThumbnail: vi.fn()
  },
  dragDrop: {
    moveFilesToFolder: vi.fn(),
    addFilesToTags: vi.fn(),
    addFolderToFavorites: vi.fn()
  },
  export: {
    exportFiles: vi.fn(),
    selectDirectory: vi.fn()
  },
  configuration: {
    loadSettings: vi.fn(),
    saveSettings: vi.fn()
  }
};

// Mock window.electronAPI
Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true
});

describe('UI Workflow Integration Tests', () => {
  let user: ReturnType<typeof userEvent.setup>;
  let mockMediaFiles: MediaFile[];
  let mockFolders: FolderItem[];
  let mockTags: HierarchicalTag[];

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();

    // Setup mock data
    mockMediaFiles = [
      {
        path: '/test/image1.jpg',
        name: 'image1.jpg',
        extension: '.jpg',
        size: 1024000,
        dateModified: new Date('2024-01-01'),
        type: 'image',
        thumbnailPath: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/wA=='
      },
      {
        path: '/test/image2.png',
        name: 'image2.png',
        extension: '.png',
        size: 2048000,
        dateModified: new Date('2024-01-02'),
        type: 'image',
        thumbnailPath: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAGAWA0drAAAAABJRU5ErkJggg=='
      },
      {
        path: '/test/video1.mp4',
        name: 'video1.mp4',
        extension: '.mp4',
        size: 10240000,
        dateModified: new Date('2024-01-03'),
        type: 'video',
        thumbnailPath: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/wA=='
      }
    ];

    mockFolders = [
      {
        name: 'Subfolder1',
        path: '/test/Subfolder1',
        hasSubfolders: true,
        mediaCount: 5
      },
      {
        name: 'Subfolder2',
        path: '/test/Subfolder2',
        hasSubfolders: false,
        mediaCount: 2
      }
    ];

    mockTags = [
      {
        category: 'Nature',
        subcategory: 'Landscape',
        tag: 'Mountains',
        fullPath: 'Nature/Landscape/Mountains'
      },
      {
        category: 'Nature',
        subcategory: 'Animals',
        tag: 'Birds',
        fullPath: 'Nature/Animals/Birds'
      },
      {
        category: 'Events',
        subcategory: undefined,
        tag: 'Wedding',
        fullPath: 'Events/Wedding'
      }
    ];

    // Setup default mock responses
    mockElectronAPI.fileSystem.getDirectoryContents.mockResolvedValue({
      folders: mockFolders,
      mediaFiles: mockMediaFiles,
      path: '/test'
    });

    mockElectronAPI.metadata.extractTags.mockResolvedValue(mockTags);
    mockElectronAPI.metadata.readMetadata.mockResolvedValue({
      tags: mockTags,
      rating: 4,
      dateCreated: new Date('2024-01-01'),
      cameraInfo: {
        make: 'Canon',
        model: 'EOS 5D',
        lens: 'EF 50mm f/1.8'
      }
    });

    mockElectronAPI.thumbnails.generateThumbnail.mockResolvedValue('mock-thumbnail-data');
    mockElectronAPI.configuration.loadSettings.mockResolvedValue({
      language: 'en',
      theme: 'system',
      favorites: [],
      tagHierarchy: []
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('File Selection and Navigation', () => {
    it('should select files and update properties panel', async () => {
      const TestComponent = () => (
        <DIContainer>
          <div style={{ display: 'flex' }}>
            <ContentGrid
              items={[...mockFolders, ...mockMediaFiles]}
              viewMode="grid"
              selectedItems={new Set()}
              onItemSelect={vi.fn()}
              onItemDoubleClick={vi.fn()}
              onContextMenu={vi.fn()}
            />
            <PropertiesPanel
              selectedItem={mockMediaFiles[0]}
              metadata={{
                tags: mockTags,
                rating: 4,
                dateCreated: new Date('2024-01-01')
              }}
              onMetadataChange={vi.fn()}
            />
          </div>
        </DIContainer>
      );

      render(<TestComponent />);

      // Find and click on first image
      const imageItem = screen.getByText('image1.jpg');
      expect(imageItem).toBeInTheDocument();

      await act(async () => {
        await user.click(imageItem);
      });

      // Properties panel should show file information
      await waitFor(() => {
        expect(screen.getByText('image1.jpg')).toBeInTheDocument();
        expect(screen.getByText('1.02 MB')).toBeInTheDocument(); // File size
      });
    });

    it('should handle multi-selection with Ctrl+Click', async () => {
      let selectedItems = new Set<string>();
      const handleItemSelect = vi.fn((item, event) => {
        if (event.ctrlKey) {
          if (selectedItems.has(item.path)) {
            selectedItems.delete(item.path);
          } else {
            selectedItems.add(item.path);
          }
        } else {
          selectedItems.clear();
          selectedItems.add(item.path);
        }
      });

      const TestComponent = () => (
        <DIContainer>
          <ContentGrid
            items={mockMediaFiles}
            viewMode="grid"
            selectedItems={selectedItems}
            onItemSelect={handleItemSelect}
            onItemDoubleClick={vi.fn()}
            onContextMenu={vi.fn()}
          />
        </DIContainer>
      );

      render(<TestComponent />);

      // Select first item
      const firstImage = screen.getByText('image1.jpg');
      await act(async () => {
        await user.click(firstImage);
      });

      expect(handleItemSelect).toHaveBeenCalledWith(
        mockMediaFiles[0],
        expect.objectContaining({ ctrlKey: false })
      );

      // Ctrl+Click second item
      const secondImage = screen.getByText('image2.png');
      await act(async () => {
        await user.click(secondImage, { ctrlKey: true });
      });

      expect(handleItemSelect).toHaveBeenCalledWith(
        mockMediaFiles[1],
        expect.objectContaining({ ctrlKey: true })
      );
    });

    it('should navigate folders on double-click', async () => {
      const handleDoubleClick = vi.fn();

      const TestComponent = () => (
        <DIContainer>
          <ContentGrid
            items={mockFolders}
            viewMode="grid"
            selectedItems={new Set()}
            onItemSelect={vi.fn()}
            onItemDoubleClick={handleDoubleClick}
            onContextMenu={vi.fn()}
          />
        </DIContainer>
      );

      render(<TestComponent />);

      const folderItem = screen.getByText('Subfolder1');
      
      await act(async () => {
        await user.dblClick(folderItem);
      });

      expect(handleDoubleClick).toHaveBeenCalledWith(mockFolders[0]);
    });
  });

  describe('Tag Management Workflow', () => {
    it('should display and manage tag hierarchy', async () => {
      const handleTagCreate = vi.fn();
      const handleTagSelect = vi.fn();

      const TestComponent = () => (
        <DIContainer>
          <TagSystemPanel
            tagHierarchy={[
              {
                id: '1',
                name: 'Nature',
                parent: undefined,
                children: [
                  {
                    id: '2',
                    name: 'Landscape',
                    parent: '1',
                    children: [
                      {
                        id: '3',
                        name: 'Mountains',
                        parent: '2',
                        children: [],
                        level: 2
                      }
                    ],
                    level: 1
                  }
                ],
                level: 0
              }
            ]}
            selectedTags={[]}
            onTagSelect={handleTagSelect}
            onTagCreate={handleTagCreate}
            onTagDelete={vi.fn()}
            onTagEdit={vi.fn()}
          />
        </DIContainer>
      );

      render(<TestComponent />);

      // Should display tag hierarchy
      expect(screen.getByText('Nature')).toBeInTheDocument();
      expect(screen.getByText('Landscape')).toBeInTheDocument();
      expect(screen.getByText('Mountains')).toBeInTheDocument();

      // Click on a tag
      const mountainsTag = screen.getByText('Mountains');
      await act(async () => {
        await user.click(mountainsTag);
      });

      expect(handleTagSelect).toHaveBeenCalled();
    });

    it('should handle tag creation workflow', async () => {
      const handleTagCreate = vi.fn();

      const TestComponent = () => (
        <DIContainer>
          <TagSystemPanel
            tagHierarchy={[]}
            selectedTags={[]}
            onTagSelect={vi.fn()}
            onTagCreate={handleTagCreate}
            onTagDelete={vi.fn()}
            onTagEdit={vi.fn()}
          />
        </DIContainer>
      );

      render(<TestComponent />);

      // Look for add tag button or context menu
      const addButton = screen.getByRole('button', { name: /add tag/i });
      await act(async () => {
        await user.click(addButton);
      });

      // Should show tag creation form
      const tagNameInput = screen.getByLabelText(/tag name/i);
      await act(async () => {
        await user.type(tagNameInput, 'New Tag');
      });

      const saveButton = screen.getByRole('button', { name: /save/i });
      await act(async () => {
        await user.click(saveButton);
      });

      expect(handleTagCreate).toHaveBeenCalledWith(expect.any(String), 'New Tag');
    });
  });

  describe('Drag and Drop Operations', () => {
    it('should handle file drag and drop to tags', async () => {
      mockElectronAPI.dragDrop.addFilesToTags.mockResolvedValue(undefined);

      const TestComponent = () => (
        <DIContainer>
          <div style={{ display: 'flex' }}>
            <ContentGrid
              items={mockMediaFiles}
              viewMode="grid"
              selectedItems={new Set([mockMediaFiles[0].path])}
              onItemSelect={vi.fn()}
              onItemDoubleClick={vi.fn()}
              onContextMenu={vi.fn()}
            />
            <TagSystemPanel
              tagHierarchy={[
                {
                  id: '1',
                  name: 'Nature',
                  parent: undefined,
                  children: [],
                  level: 0
                }
              ]}
              selectedTags={[]}
              onTagSelect={vi.fn()}
              onTagCreate={vi.fn()}
              onTagDelete={vi.fn()}
              onTagEdit={vi.fn()}
            />
          </div>
        </DIContainer>
      );

      render(<TestComponent />);

      const imageItem = screen.getByText('image1.jpg');
      const tagItem = screen.getByText('Nature');

      // Simulate drag and drop
      await act(async () => {
        fireEvent.dragStart(imageItem, {
          dataTransfer: {
            setData: vi.fn(),
            getData: vi.fn().mockReturnValue(JSON.stringify([mockMediaFiles[0]]))
          }
        });
      });

      await act(async () => {
        fireEvent.dragOver(tagItem, {
          preventDefault: vi.fn()
        });
      });

      await act(async () => {
        fireEvent.drop(tagItem, {
          preventDefault: vi.fn(),
          dataTransfer: {
            getData: vi.fn().mockReturnValue(JSON.stringify([mockMediaFiles[0]]))
          }
        });
      });

      await waitFor(() => {
        expect(mockElectronAPI.dragDrop.addFilesToTags).toHaveBeenCalledWith(
          [mockMediaFiles[0]],
          expect.objectContaining({ fullPath: 'Nature' })
        );
      });
    });

    it('should handle folder drag to favorites', async () => {
      mockElectronAPI.dragDrop.addFolderToFavorites.mockResolvedValue(undefined);

      const TestComponent = () => (
        <DIContainer>
          <div style={{ display: 'flex' }}>
            <ContentGrid
              items={mockFolders}
              viewMode="grid"
              selectedItems={new Set()}
              onItemSelect={vi.fn()}
              onItemDoubleClick={vi.fn()}
              onContextMenu={vi.fn()}
            />
            <div data-testid="favorites-panel">
              {/* Favorites panel would be here */}
            </div>
          </div>
        </DIContainer>
      );

      render(<TestComponent />);

      const folderItem = screen.getByText('Subfolder1');
      const favoritesPanel = screen.getByTestId('favorites-panel');

      // Simulate drag and drop
      await act(async () => {
        fireEvent.dragStart(folderItem, {
          dataTransfer: {
            setData: vi.fn(),
            getData: vi.fn().mockReturnValue(JSON.stringify(mockFolders[0]))
          }
        });
      });

      await act(async () => {
        fireEvent.drop(favoritesPanel, {
          preventDefault: vi.fn(),
          dataTransfer: {
            getData: vi.fn().mockReturnValue(JSON.stringify(mockFolders[0]))
          }
        });
      });

      await waitFor(() => {
        expect(mockElectronAPI.dragDrop.addFolderToFavorites).toHaveBeenCalledWith(
          mockFolders[0]
        );
      });
    });
  });

  describe('Context Menu Operations', () => {
    it('should show context menu on right-click', async () => {
      const handleContextMenu = vi.fn();

      const TestComponent = () => (
        <DIContainer>
          <ContentGrid
            items={mockMediaFiles}
            viewMode="grid"
            selectedItems={new Set()}
            onItemSelect={vi.fn()}
            onItemDoubleClick={vi.fn()}
            onContextMenu={handleContextMenu}
          />
        </DIContainer>
      );

      render(<TestComponent />);

      const imageItem = screen.getByText('image1.jpg');

      await act(async () => {
        fireEvent.contextMenu(imageItem);
      });

      expect(handleContextMenu).toHaveBeenCalledWith(
        mockMediaFiles[0],
        expect.any(Object)
      );
    });

    it('should handle rating from context menu', async () => {
      mockElectronAPI.metadata.writeRating.mockResolvedValue(undefined);

      const TestComponent = () => {
        const [showContextMenu, setShowContextMenu] = React.useState(false);
        const [contextMenuPosition, setContextMenuPosition] = React.useState({ x: 0, y: 0 });

        const handleContextMenu = (item: MediaFile, event: React.MouseEvent) => {
          setContextMenuPosition({ x: event.clientX, y: event.clientY });
          setShowContextMenu(true);
        };

        const handleRating = async (rating: number) => {
          await mockElectronAPI.metadata.writeRating(mockMediaFiles[0].path, rating);
          setShowContextMenu(false);
        };

        return (
          <DIContainer>
            <ContentGrid
              items={mockMediaFiles}
              viewMode="grid"
              selectedItems={new Set()}
              onItemSelect={vi.fn()}
              onItemDoubleClick={vi.fn()}
              onContextMenu={handleContextMenu}
            />
            {showContextMenu && (
              <div
                data-testid="context-menu"
                style={{
                  position: 'fixed',
                  left: contextMenuPosition.x,
                  top: contextMenuPosition.y,
                  background: 'white',
                  border: '1px solid #ccc',
                  padding: '8px'
                }}
              >
                <button onClick={() => handleRating(5)}>Rate 5 Stars</button>
                <button onClick={() => handleRating(4)}>Rate 4 Stars</button>
                <button onClick={() => handleRating(3)}>Rate 3 Stars</button>
              </div>
            )}
          </DIContainer>
        );
      };

      render(<TestComponent />);

      const imageItem = screen.getByText('image1.jpg');

      // Right-click to show context menu
      await act(async () => {
        fireEvent.contextMenu(imageItem, { clientX: 100, clientY: 100 });
      });

      // Context menu should appear
      const contextMenu = screen.getByTestId('context-menu');
      expect(contextMenu).toBeInTheDocument();

      // Click on rating option
      const ratingButton = screen.getByText('Rate 5 Stars');
      await act(async () => {
        await user.click(ratingButton);
      });

      expect(mockElectronAPI.metadata.writeRating).toHaveBeenCalledWith(
        mockMediaFiles[0].path,
        5
      );
    });
  });

  describe('Search and Filter Integration', () => {
    it('should filter content based on search query', async () => {
      const TestComponent = () => {
        const [searchQuery, setSearchQuery] = React.useState('');
        const [filteredItems, setFilteredItems] = React.useState(mockMediaFiles);

        React.useEffect(() => {
          if (searchQuery) {
            const filtered = mockMediaFiles.filter(item =>
              item.name.toLowerCase().includes(searchQuery.toLowerCase())
            );
            setFilteredItems(filtered);
          } else {
            setFilteredItems(mockMediaFiles);
          }
        }, [searchQuery]);

        return (
          <DIContainer>
            <div>
              <input
                type="text"
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="search-input"
              />
              <ContentGrid
                items={filteredItems}
                viewMode="grid"
                selectedItems={new Set()}
                onItemSelect={vi.fn()}
                onItemDoubleClick={vi.fn()}
                onContextMenu={vi.fn()}
              />
            </div>
          </DIContainer>
        );
      };

      render(<TestComponent />);

      // Initially should show all files
      expect(screen.getByText('image1.jpg')).toBeInTheDocument();
      expect(screen.getByText('image2.png')).toBeInTheDocument();
      expect(screen.getByText('video1.mp4')).toBeInTheDocument();

      // Search for 'image'
      const searchInput = screen.getByTestId('search-input');
      await act(async () => {
        await user.type(searchInput, 'image');
      });

      // Should only show image files
      await waitFor(() => {
        expect(screen.getByText('image1.jpg')).toBeInTheDocument();
        expect(screen.getByText('image2.png')).toBeInTheDocument();
        expect(screen.queryByText('video1.mp4')).not.toBeInTheDocument();
      });
    });

    it('should filter by file type', async () => {
      const TestComponent = () => {
        const [fileTypeFilter, setFileTypeFilter] = React.useState<'all' | 'image' | 'video'>('all');
        const [filteredItems, setFilteredItems] = React.useState(mockMediaFiles);

        React.useEffect(() => {
          if (fileTypeFilter === 'all') {
            setFilteredItems(mockMediaFiles);
          } else {
            const filtered = mockMediaFiles.filter(item => item.type === fileTypeFilter);
            setFilteredItems(filtered);
          }
        }, [fileTypeFilter]);

        return (
          <DIContainer>
            <div>
              <select
                value={fileTypeFilter}
                onChange={(e) => setFileTypeFilter(e.target.value as any)}
                data-testid="file-type-filter"
              >
                <option value="all">All Files</option>
                <option value="image">Images Only</option>
                <option value="video">Videos Only</option>
              </select>
              <ContentGrid
                items={filteredItems}
                viewMode="grid"
                selectedItems={new Set()}
                onItemSelect={vi.fn()}
                onItemDoubleClick={vi.fn()}
                onContextMenu={vi.fn()}
              />
            </div>
          </DIContainer>
        );
      };

      render(<TestComponent />);

      const filterSelect = screen.getByTestId('file-type-filter');

      // Filter to images only
      await act(async () => {
        await user.selectOptions(filterSelect, 'image');
      });

      await waitFor(() => {
        expect(screen.getByText('image1.jpg')).toBeInTheDocument();
        expect(screen.getByText('image2.png')).toBeInTheDocument();
        expect(screen.queryByText('video1.mp4')).not.toBeInTheDocument();
      });

      // Filter to videos only
      await act(async () => {
        await user.selectOptions(filterSelect, 'video');
      });

      await waitFor(() => {
        expect(screen.queryByText('image1.jpg')).not.toBeInTheDocument();
        expect(screen.queryByText('image2.png')).not.toBeInTheDocument();
        expect(screen.getByText('video1.mp4')).toBeInTheDocument();
      });
    });
  });

  describe('Performance and Responsiveness', () => {
    it('should handle large file lists efficiently', async () => {
      // Create a large list of mock files
      const largeFileList: MediaFile[] = Array.from({ length: 1000 }, (_, i) => ({
        path: `/test/image${i}.jpg`,
        name: `image${i}.jpg`,
        extension: '.jpg',
        size: 1024000,
        dateModified: new Date(),
        type: 'image',
        thumbnailPath: 'mock-thumbnail'
      }));

      const TestComponent = () => (
        <DIContainer>
          <ContentGrid
            items={largeFileList}
            viewMode="grid"
            selectedItems={new Set()}
            onItemSelect={vi.fn()}
            onItemDoubleClick={vi.fn()}
            onContextMenu={vi.fn()}
          />
        </DIContainer>
      );

      const startTime = Date.now();
      render(<TestComponent />);
      const renderTime = Date.now() - startTime;

      // Should render within reasonable time (less than 1 second)
      expect(renderTime).toBeLessThan(1000);

      // Should show at least some items (virtualization might limit visible items)
      expect(screen.getByText('image0.jpg')).toBeInTheDocument();
    });

    it('should debounce search input', async () => {
      const mockSearch = vi.fn();
      
      const TestComponent = () => {
        const [searchQuery, setSearchQuery] = React.useState('');

        React.useEffect(() => {
          const timeoutId = setTimeout(() => {
            if (searchQuery) {
              mockSearch(searchQuery);
            }
          }, 300); // 300ms debounce

          return () => clearTimeout(timeoutId);
        }, [searchQuery]);

        return (
          <DIContainer>
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="search-input"
            />
          </DIContainer>
        );
      };

      render(<TestComponent />);

      const searchInput = screen.getByTestId('search-input');

      // Type quickly
      await act(async () => {
        await user.type(searchInput, 'test');
      });

      // Should not have called search immediately
      expect(mockSearch).not.toHaveBeenCalled();

      // Wait for debounce
      await waitFor(() => {
        expect(mockSearch).toHaveBeenCalledWith('test');
      }, { timeout: 500 });

      // Should only be called once despite multiple keystrokes
      expect(mockSearch).toHaveBeenCalledTimes(1);
    });
  });
});