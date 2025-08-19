import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { TagSystemPanel } from '../TagSystemPanel';
import { MediaFile, TagHierarchyNode, HierarchicalTag } from '../../../../../types/global';

// Mock CSS import
vi.mock('../TagSystemPanel.css', () => ({}));

const mockMediaFile: MediaFile = {
  path: '/test/vacation.jpg',
  name: 'vacation.jpg',
  extension: 'jpg',
  size: 2500000,
  dateModified: new Date('2024-01-13T10:30:00'),
  dateCreated: new Date('2024-01-13T10:30:00'),
  type: 'image',
};

const mockTagHierarchy: TagHierarchyNode[] = [
  {
    id: 'nature',
    name: 'Nature',
    level: 0,
    parent: undefined,
    children: [
      {
        id: 'landscape',
        name: 'Landscape',
        level: 1,
        parent: 'nature',
        children: [
          { id: 'mountains', name: 'Mountains', level: 2, parent: 'landscape', children: [] },
          { id: 'lakes', name: 'Lakes', level: 2, parent: 'landscape', children: [] },
        ],
      },
    ],
  },
  {
    id: 'events',
    name: 'Events',
    level: 0,
    parent: undefined,
    children: [
      {
        id: 'vacation',
        name: 'Vacation',
        level: 1,
        parent: 'events',
        children: [],
      },
    ],
  },
];

describe('TagSystemPanel', () => {
  const defaultProps = {
    selectedFiles: [],
    tagHierarchy: mockTagHierarchy,
  };

  beforeEach(() => {
    // Mock window.confirm
    window.confirm = vi.fn(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders tag hierarchy correctly', () => {
    render(<TagSystemPanel {...defaultProps} />);
    
    expect(screen.getByText('Nature')).toBeInTheDocument();
    expect(screen.getByText('Events')).toBeInTheDocument();
    expect(screen.getByText('Landscape')).toBeInTheDocument();
    expect(screen.getByText('Vacation')).toBeInTheDocument();
  });

  it('expands and collapses tag nodes', () => {
    render(<TagSystemPanel {...defaultProps} />);
    
    // Initially, Nature node should be collapsed, so Landscape should not be visible
    expect(screen.queryByText('Landscape')).not.toBeInTheDocument();
    
    // Click to expand Nature
    const expandButton = screen.getAllByText('▶')[0];
    fireEvent.click(expandButton);
    
    // Now Landscape should be visible
    expect(screen.getByText('Landscape')).toBeInTheDocument();
  });

  it('shows selected files info when files are selected', () => {
    const props = {
      ...defaultProps,
      selectedFiles: [mockMediaFile],
    };

    render(<TagSystemPanel {...props} />);
    
    expect(screen.getByText('Selected: 1 item(s)')).toBeInTheDocument();
    expect(screen.getByText('Drag tags to files or click ➕ to assign tags')).toBeInTheDocument();
  });

  it('calls onTagAssign when assign button is clicked', () => {
    const onTagAssign = vi.fn();
    const props = {
      ...defaultProps,
      selectedFiles: [mockMediaFile],
      onTagAssign,
    };

    render(<TagSystemPanel {...props} />);
    
    const assignButtons = screen.getAllByTitle(/Assign.*to.*selected/);
    fireEvent.click(assignButtons[0]);

    expect(onTagAssign).toHaveBeenCalledWith(
      [mockMediaFile],
      [expect.objectContaining({
        category: 'Nature',
        tag: 'Nature',
        fullPath: 'Nature',
      })]
    );
  });

  it('calls onTagFilter when filter button is clicked', () => {
    const onTagFilter = vi.fn();
    const props = {
      ...defaultProps,
      onTagFilter,
    };

    render(<TagSystemPanel {...props} />);
    
    const filterButtons = screen.getAllByTitle(/Filter by/);
    fireEvent.click(filterButtons[0]);

    expect(onTagFilter).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'Nature',
        tag: 'Nature',
        fullPath: 'Nature',
      })
    );
  });

  it('calls onTagFilter when tag name is clicked', () => {
    const onTagFilter = vi.fn();
    const props = {
      ...defaultProps,
      onTagFilter,
    };

    render(<TagSystemPanel {...props} />);
    
    const tagName = screen.getByText('Nature');
    fireEvent.click(tagName);

    expect(onTagFilter).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'Nature',
        tag: 'Nature',
        fullPath: 'Nature',
      })
    );
  });

  it('shows context menu on right click', () => {
    render(<TagSystemPanel {...defaultProps} />);
    
    const tagItem = screen.getByText('Nature').closest('.tag-item');
    fireEvent.contextMenu(tagItem!);

    expect(screen.getByText('✏️ Edit')).toBeInTheDocument();
    expect(screen.getByText('➕ Add Child')).toBeInTheDocument();
    expect(screen.getByText('🗑️ Delete')).toBeInTheDocument();
  });

  it('enters edit mode when edit is clicked from context menu', async () => {
    const props = {
      ...defaultProps,
      onTagEdit: vi.fn(),
    };

    render(<TagSystemPanel {...props} />);
    
    const tagItem = screen.getByText('Nature').closest('.tag-item');
    fireEvent.contextMenu(tagItem!);
    
    const editButton = screen.getByText('✏️ Edit');
    fireEvent.click(editButton);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Nature')).toBeInTheDocument();
    });
  });

  it('calls onTagEdit when edit is submitted', async () => {
    const onTagEdit = vi.fn();
    const props = {
      ...defaultProps,
      onTagEdit,
    };

    render(<TagSystemPanel {...props} />);
    
    const tagItem = screen.getByText('Nature').closest('.tag-item');
    fireEvent.contextMenu(tagItem!);
    
    const editButton = screen.getByText('✏️ Edit');
    fireEvent.click(editButton);

    await waitFor(() => {
      const input = screen.getByDisplayValue('Nature');
      fireEvent.change(input, { target: { value: 'Wildlife' } });
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    expect(onTagEdit).toHaveBeenCalledWith('nature', 'Wildlife');
  });

  it('calls onTagDelete when delete is confirmed', () => {
    const onTagDelete = vi.fn();
    const props = {
      ...defaultProps,
      onTagDelete,
    };

    render(<TagSystemPanel {...props} />);
    
    const tagItem = screen.getByText('Nature').closest('.tag-item');
    fireEvent.contextMenu(tagItem!);
    
    const deleteButton = screen.getByText('🗑️ Delete');
    fireEvent.click(deleteButton);

    expect(window.confirm).toHaveBeenCalledWith(
      'Are you sure you want to delete "Nature" and all its children?'
    );
    expect(onTagDelete).toHaveBeenCalledWith('nature');
  });

  it('does not delete when deletion is cancelled', () => {
    window.confirm = vi.fn(() => false);
    const onTagDelete = vi.fn();
    const props = {
      ...defaultProps,
      onTagDelete,
    };

    render(<TagSystemPanel {...props} />);
    
    const tagItem = screen.getByText('Nature').closest('.tag-item');
    fireEvent.contextMenu(tagItem!);
    
    const deleteButton = screen.getByText('🗑️ Delete');
    fireEvent.click(deleteButton);

    expect(onTagDelete).not.toHaveBeenCalled();
  });

  it('shows new tag input when add button is clicked', () => {
    const props = {
      ...defaultProps,
      onTagCreate: vi.fn(),
    };

    render(<TagSystemPanel {...props} />);
    
    const addButton = screen.getByTitle('Add new tag category');
    fireEvent.click(addButton);

    expect(screen.getByPlaceholderText('Enter category name...')).toBeInTheDocument();
  });

  it('calls onTagCreate when new tag is submitted', async () => {
    const onTagCreate = vi.fn();
    const props = {
      ...defaultProps,
      onTagCreate,
    };

    render(<TagSystemPanel {...props} />);
    
    const addButton = screen.getByTitle('Add new tag category');
    fireEvent.click(addButton);

    const input = screen.getByPlaceholderText('Enter category name...');
    fireEvent.change(input, { target: { value: 'New Category' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onTagCreate).toHaveBeenCalledWith(null, 'New Category');
  });

  it('shows add child option in context menu', () => {
    const props = {
      ...defaultProps,
      onTagCreate: vi.fn(),
    };

    render(<TagSystemPanel {...props} />);
    
    const tagItem = screen.getByText('Nature').closest('.tag-item');
    fireEvent.contextMenu(tagItem!);
    
    const addChildButton = screen.getByText('➕ Add Child');
    fireEvent.click(addChildButton);

    expect(screen.getByPlaceholderText('Enter tag name...')).toBeInTheDocument();
  });

  it('disables assign button when no files are selected', () => {
    render(<TagSystemPanel {...defaultProps} />);
    
    const assignButtons = screen.getAllByTitle('Select files to assign tags');
    expect(assignButtons[0]).toBeDisabled();
  });

  it('builds correct full path for nested tags', () => {
    const onTagFilter = vi.fn();
    const props = {
      ...defaultProps,
      onTagFilter,
    };

    render(<TagSystemPanel {...props} />);
    
    // First expand Nature to see Landscape
    const natureExpandButton = screen.getAllByText('▶')[0];
    fireEvent.click(natureExpandButton);
    
    // Then expand Landscape to see Mountains
    const landscapeExpandButton = screen.getByText('Landscape').closest('.tag-item')?.querySelector('.expand-btn');
    if (landscapeExpandButton) {
      fireEvent.click(landscapeExpandButton);
    }
    
    // Now click on Mountains tag (Nature/Landscape/Mountains)
    const mountainsTag = screen.getByText('Mountains');
    fireEvent.click(mountainsTag);

    expect(onTagFilter).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'Nature',
        subcategory: 'Landscape',
        tag: 'Mountains',
        fullPath: 'Nature/Landscape/Mountains',
      })
    );
  });
});