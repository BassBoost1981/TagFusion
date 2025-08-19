import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { ContextMenu } from '../ContextMenu';
import { ContextMenuConfig, ContextMenuAction, MediaFile } from '../../../../../types/global';

describe('ContextMenu', () => {
  const mockMediaFile: MediaFile = {
    path: '/test/image.jpg',
    name: 'image.jpg',
    extension: '.jpg',
    size: 1024,
    dateModified: new Date(),
    type: 'image'
  };

  const mockConfig: ContextMenuConfig = {
    items: [
      {
        id: 'edit',
        label: 'Bearbeiten',
        action: 'edit',
        shortcut: 'Enter',
        icon: '✏️'
      },
      {
        id: 'separator1',
        label: '',
        action: '',
        separator: true
      },
      {
        id: 'rating',
        label: 'Bewertung',
        action: 'rating',
        icon: '⭐',
        submenu: [
          { id: 'rate1', label: '⭐', action: 'rate', value: 1 },
          { id: 'rate2', label: '⭐⭐', action: 'rate', value: 2 }
        ]
      },
      {
        id: 'delete',
        label: 'Löschen',
        action: 'delete',
        shortcut: 'Delete',
        icon: '🗑️'
      }
    ],
    position: { x: 100, y: 100 },
    target: mockMediaFile,
    targetType: 'file'
  };

  const mockOnAction = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders context menu with items', () => {
    render(
      <ContextMenu
        config={mockConfig}
        onAction={mockOnAction}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Bearbeiten')).toBeInTheDocument();
    expect(screen.getByText('Enter')).toBeInTheDocument();
    expect(screen.getByText('Bewertung')).toBeInTheDocument();
    expect(screen.getByText('Löschen')).toBeInTheDocument();
  });

  it('renders separator correctly', () => {
    render(
      <ContextMenu
        config={mockConfig}
        onAction={mockOnAction}
        onClose={mockOnClose}
      />
    );

    const separator = document.querySelector('.context-menu-separator');
    expect(separator).toBeInTheDocument();
  });

  it('calls onAction when menu item is clicked', () => {
    render(
      <ContextMenu
        config={mockConfig}
        onAction={mockOnAction}
        onClose={mockOnClose}
      />
    );

    fireEvent.click(screen.getByText('Bearbeiten'));

    expect(mockOnAction).toHaveBeenCalledWith({
      type: 'edit',
      payload: undefined,
      target: mockMediaFile,
      selectedItems: undefined
    });
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('shows submenu on hover', async () => {
    render(
      <ContextMenu
        config={mockConfig}
        onAction={mockOnAction}
        onClose={mockOnClose}
      />
    );

    const ratingItem = screen.getByText('Bewertung');
    fireEvent.mouseEnter(ratingItem);

    await waitFor(() => {
      const submenu = document.querySelector('.context-submenu');
      expect(submenu).toBeInTheDocument();
      expect(submenu?.textContent).toContain('⭐');
      expect(submenu?.textContent).toContain('⭐⭐');
    });
  });

  it('calls onAction with submenu item value', async () => {
    render(
      <ContextMenu
        config={mockConfig}
        onAction={mockOnAction}
        onClose={mockOnClose}
      />
    );

    const ratingItem = screen.getByText('Bewertung');
    fireEvent.mouseEnter(ratingItem);

    await waitFor(() => {
      const submenu = document.querySelector('.context-submenu');
      expect(submenu).toBeInTheDocument();
    });

    const submenuItems = document.querySelectorAll('.context-submenu .context-menu-item');
    fireEvent.click(submenuItems[0]); // Click first star rating

    expect(mockOnAction).toHaveBeenCalledWith({
      type: 'rate',
      payload: 1,
      target: mockMediaFile,
      selectedItems: undefined
    });
  });

  it('closes menu on outside click', () => {
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <ContextMenu
          config={mockConfig}
          onAction={mockOnAction}
          onClose={mockOnClose}
        />
      </div>
    );

    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('closes menu on Escape key', () => {
    render(
      <ContextMenu
        config={mockConfig}
        onAction={mockOnAction}
        onClose={mockOnClose}
      />
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('does not render when config is null', () => {
    const { container } = render(
      <ContextMenu
        config={null}
        onAction={mockOnAction}
        onClose={mockOnClose}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('positions menu correctly', () => {
    render(
      <ContextMenu
        config={mockConfig}
        onAction={mockOnAction}
        onClose={mockOnClose}
      />
    );

    const menu = document.querySelector('.context-menu') as HTMLElement;
    expect(menu.style.left).toBe('100px');
    expect(menu.style.top).toBe('100px');
  });

  it('does not trigger action for disabled items', () => {
    const configWithDisabled: ContextMenuConfig = {
      ...mockConfig,
      items: [
        {
          id: 'disabled',
          label: 'Disabled Item',
          action: 'disabled',
          disabled: true
        }
      ]
    };

    render(
      <ContextMenu
        config={configWithDisabled}
        onAction={mockOnAction}
        onClose={mockOnClose}
      />
    );

    fireEvent.click(screen.getByText('Disabled Item'));
    expect(mockOnAction).not.toHaveBeenCalled();
    expect(mockOnClose).not.toHaveBeenCalled();
  });
});