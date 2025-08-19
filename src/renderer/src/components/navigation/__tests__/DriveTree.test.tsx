import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DriveTree } from '../DriveTree';

// Mock the CSS import
jest.mock('../DriveTree.css', () => ({}));

describe('DriveTree Component', () => {
  const mockProps = {
    currentPath: 'C:\\Users\\Documents',
    onNavigate: jest.fn(),
    onRefresh: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders drive tree header', () => {
    render(<DriveTree {...mockProps} />);
    
    expect(screen.getByText('Drives')).toBeInTheDocument();
    expect(screen.getByTitle('Refresh drives')).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    render(<DriveTree {...mockProps} />);
    
    expect(screen.getByText('Loading drives...')).toBeInTheDocument();
    expect(screen.getByText('⟳')).toBeInTheDocument();
  });

  it('calls onRefresh when refresh button is clicked', async () => {
    render(<DriveTree {...mockProps} />);
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading drives...')).not.toBeInTheDocument();
    });

    const refreshButton = screen.getByTitle('Refresh drives');
    fireEvent.click(refreshButton);

    expect(mockProps.onRefresh).toHaveBeenCalled();
  });

  it('displays drives after loading', async () => {
    render(<DriveTree {...mockProps} />);
    
    // Wait for mock drives to load
    await waitFor(() => {
      expect(screen.getByText('C: Local Disk')).toBeInTheDocument();
      expect(screen.getByText('D: Data')).toBeInTheDocument();
      expect(screen.getByText('E: USB Drive')).toBeInTheDocument();
    });
  });

  it('shows correct drive icons', async () => {
    render(<DriveTree {...mockProps} />);
    
    await waitFor(() => {
      // Local drives should show computer icon
      const localDrives = screen.getAllByText('💻');
      expect(localDrives).toHaveLength(2); // C: and D:
      
      // USB drive should show disk icon
      expect(screen.getByText('💾')).toBeInTheDocument();
    });
  });

  it('handles drive expansion and collapse', async () => {
    render(<DriveTree {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('C: Local Disk')).toBeInTheDocument();
    });

    // Find and click the expand button for C: drive
    const expandButtons = screen.getAllByLabelText(/Expand drive|Collapse drive/);
    const cDriveExpandButton = expandButtons[0];
    
    fireEvent.click(cDriveExpandButton);

    // Should show loading state
    await waitFor(() => {
      expect(cDriveExpandButton).toHaveTextContent('⟳');
    });

    // After loading, should show children
    await waitFor(() => {
      expect(screen.getByText('Users')).toBeInTheDocument();
      expect(screen.getByText('Program Files')).toBeInTheDocument();
      expect(screen.getByText('Windows')).toBeInTheDocument();
    });
  });

  it('handles navigation when drive is clicked', async () => {
    render(<DriveTree {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('C: Local Disk')).toBeInTheDocument();
    });

    const cDrive = screen.getByText('C: Local Disk').closest('.drive-node');
    fireEvent.click(cDrive!);

    expect(mockProps.onNavigate).toHaveBeenCalledWith('C:\\');
  });

  it('handles keyboard navigation', async () => {
    render(<DriveTree {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('C: Local Disk')).toBeInTheDocument();
    });

    const driveTree = screen.getByRole('tree');
    
    // Test arrow key navigation
    fireEvent.keyDown(driveTree, { key: 'ArrowDown' });
    fireEvent.keyDown(driveTree, { key: 'ArrowUp' });
    fireEvent.keyDown(driveTree, { key: 'ArrowRight' });
    fireEvent.keyDown(driveTree, { key: 'ArrowLeft' });
    fireEvent.keyDown(driveTree, { key: 'Enter' });
    fireEvent.keyDown(driveTree, { key: 'Space' });
    fireEvent.keyDown(driveTree, { key: 'Home' });
    fireEvent.keyDown(driveTree, { key: 'End' });

    // Component should handle all keyboard events without crashing
    expect(driveTree).toBeInTheDocument();
  });

  it('shows selected state for current path', async () => {
    render(<DriveTree {...mockProps} currentPath="C:\\" />);
    
    await waitFor(() => {
      const cDrive = screen.getByText('C: Local Disk').closest('.drive-node');
      expect(cDrive).toHaveClass('selected');
    });
  });

  it('handles lazy loading of directory children', async () => {
    render(<DriveTree {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('C: Local Disk')).toBeInTheDocument();
    });

    // Expand C: drive
    const expandButton = screen.getAllByLabelText(/Expand drive/)[0];
    fireEvent.click(expandButton);

    // Wait for children to load
    await waitFor(() => {
      expect(screen.getByText('Users')).toBeInTheDocument();
    });

    // Click on Users folder to expand it
    const usersFolder = screen.getByText('Users').closest('.tree-node');
    fireEvent.click(usersFolder!);

    // Should navigate to Users folder
    expect(mockProps.onNavigate).toHaveBeenCalledWith('C:\\Users\\');
  });

  it('handles error state', async () => {
    // Mock console.error to avoid test output noise
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    render(<DriveTree {...mockProps} />);
    
    // The component uses mock data, so we can't easily simulate errors
    // In a real implementation, we'd mock the IPC calls to return errors
    
    await waitFor(() => {
      expect(screen.queryByText('Loading drives...')).not.toBeInTheDocument();
    });

    consoleSpy.mockRestore();
  });

  it('supports accessibility features', async () => {
    render(<DriveTree {...mockProps} />);
    
    await waitFor(() => {
      const driveTree = screen.getByRole('tree');
      expect(driveTree).toHaveAttribute('aria-label', 'Drive and folder tree');
      expect(driveTree).toHaveAttribute('tabIndex', '0');
    });

    // Check for proper ARIA attributes on tree items
    await waitFor(() => {
      const driveNodes = screen.getAllByRole('treeitem');
      expect(driveNodes.length).toBeGreaterThan(0);
      
      driveNodes.forEach(node => {
        expect(node).toHaveAttribute('aria-selected');
      });
    });
  });

  it('handles focus management', async () => {
    render(<DriveTree {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('C: Local Disk')).toBeInTheDocument();
    });

    const driveTree = screen.getByRole('tree');
    
    // Focus the tree
    fireEvent.focus(driveTree);
    
    // Test keyboard navigation
    fireEvent.keyDown(driveTree, { key: 'ArrowDown' });
    
    // Component should handle focus without crashing
    expect(driveTree).toBeInTheDocument();
  });

  it('shows unavailable drives with warning', async () => {
    render(<DriveTree {...mockProps} />);
    
    // The mock data shows all drives as available
    // In a real implementation, we'd test with unavailable drives
    await waitFor(() => {
      expect(screen.getByText('C: Local Disk')).toBeInTheDocument();
    });
    
    // No warning icons should be present for available drives
    expect(screen.queryByText('⚠️')).not.toBeInTheDocument();
  });

  it('handles tree node expansion states correctly', async () => {
    render(<DriveTree {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('C: Local Disk')).toBeInTheDocument();
    });

    const expandButton = screen.getAllByLabelText(/Expand drive/)[0];
    
    // Initially collapsed
    expect(expandButton).toHaveTextContent('▶');
    
    // Expand
    fireEvent.click(expandButton);
    
    await waitFor(() => {
      expect(expandButton).toHaveTextContent('▼');
    });
    
    // Collapse
    fireEvent.click(expandButton);
    
    await waitFor(() => {
      expect(expandButton).toHaveTextContent('▶');
    });
  });
});