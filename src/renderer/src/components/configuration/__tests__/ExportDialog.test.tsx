import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ExportDialog } from '../ExportDialog';
import { configurationApi } from '../../../api/configurationApi';

// Mock the configuration API
vi.mock('../../../api/configurationApi', () => ({
  configurationApi: {
    showSaveDialog: vi.fn(),
    exportToFile: vi.fn()
  }
}));

describe('ExportDialog', () => {
  const mockProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
    onError: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render when open', () => {
    render(<ExportDialog {...mockProps} />);
    
    expect(screen.getByText('Export Configuration')).toBeInTheDocument();
    expect(screen.getByText(/Export your TagFusion configuration/)).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    render(<ExportDialog {...mockProps} isOpen={false} />);
    
    expect(screen.queryByText('Export Configuration')).not.toBeInTheDocument();
  });

  it('should have all export options checked by default', () => {
    render(<ExportDialog {...mockProps} />);
    
    const favoritesCheckbox = screen.getByLabelText(/Include Favorites/);
    const tagsCheckbox = screen.getByLabelText(/Include Tag Hierarchy/);
    const settingsCheckbox = screen.getByLabelText(/Include Application Settings/);
    
    expect(favoritesCheckbox).toBeChecked();
    expect(tagsCheckbox).toBeChecked();
    expect(settingsCheckbox).toBeChecked();
  });

  it('should allow toggling export options', () => {
    render(<ExportDialog {...mockProps} />);
    
    const favoritesCheckbox = screen.getByLabelText(/Include Favorites/);
    
    fireEvent.click(favoritesCheckbox);
    expect(favoritesCheckbox).not.toBeChecked();
    
    fireEvent.click(favoritesCheckbox);
    expect(favoritesCheckbox).toBeChecked();
  });

  it('should disable export button when no options selected', () => {
    render(<ExportDialog {...mockProps} />);
    
    const favoritesCheckbox = screen.getByLabelText(/Include Favorites/);
    const tagsCheckbox = screen.getByLabelText(/Include Tag Hierarchy/);
    const settingsCheckbox = screen.getByLabelText(/Include Application Settings/);
    const exportButton = screen.getByText('Export Configuration');
    
    // Uncheck all options
    fireEvent.click(favoritesCheckbox);
    fireEvent.click(tagsCheckbox);
    fireEvent.click(settingsCheckbox);
    
    expect(exportButton).toBeDisabled();
  });

  it('should handle successful export', async () => {
    const mockShowSaveDialog = vi.mocked(configurationApi.showSaveDialog);
    const mockExportToFile = vi.mocked(configurationApi.exportToFile);
    
    mockShowSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: '/path/to/config.json'
    });
    mockExportToFile.mockResolvedValue();
    
    render(<ExportDialog {...mockProps} />);
    
    const exportButton = screen.getByText('Export Configuration');
    fireEvent.click(exportButton);
    
    await waitFor(() => {
      expect(mockShowSaveDialog).toHaveBeenCalled();
      expect(mockExportToFile).toHaveBeenCalledWith('/path/to/config.json');
      expect(mockProps.onSuccess).toHaveBeenCalledWith('/path/to/config.json');
      expect(mockProps.onClose).toHaveBeenCalled();
    });
  });

  it('should handle canceled save dialog', async () => {
    const mockShowSaveDialog = vi.mocked(configurationApi.showSaveDialog);
    
    mockShowSaveDialog.mockResolvedValue({
      canceled: true
    });
    
    render(<ExportDialog {...mockProps} />);
    
    const exportButton = screen.getByText('Export Configuration');
    fireEvent.click(exportButton);
    
    await waitFor(() => {
      expect(mockShowSaveDialog).toHaveBeenCalled();
      expect(mockProps.onSuccess).not.toHaveBeenCalled();
      expect(mockProps.onClose).not.toHaveBeenCalled();
    });
  });

  it('should handle export error', async () => {
    const mockShowSaveDialog = vi.mocked(configurationApi.showSaveDialog);
    const mockExportToFile = vi.mocked(configurationApi.exportToFile);
    
    mockShowSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: '/path/to/config.json'
    });
    mockExportToFile.mockRejectedValue(new Error('Export failed'));
    
    render(<ExportDialog {...mockProps} />);
    
    const exportButton = screen.getByText('Export Configuration');
    fireEvent.click(exportButton);
    
    await waitFor(() => {
      expect(mockProps.onError).toHaveBeenCalledWith('Export failed');
    });
  });

  it('should show loading state during export', async () => {
    const mockShowSaveDialog = vi.mocked(configurationApi.showSaveDialog);
    const mockExportToFile = vi.mocked(configurationApi.exportToFile);
    
    mockShowSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: '/path/to/config.json'
    });
    
    // Make exportToFile hang to test loading state
    mockExportToFile.mockImplementation(() => new Promise(() => {}));
    
    render(<ExportDialog {...mockProps} />);
    
    const exportButton = screen.getByText('Export Configuration');
    fireEvent.click(exportButton);
    
    await waitFor(() => {
      expect(screen.getByText('Exporting...')).toBeInTheDocument();
      expect(exportButton).toBeDisabled();
    });
  });

  it('should close dialog when close button clicked', () => {
    render(<ExportDialog {...mockProps} />);
    
    const closeButton = screen.getByText('×');
    fireEvent.click(closeButton);
    
    expect(mockProps.onClose).toHaveBeenCalled();
  });

  it('should close dialog when cancel button clicked', () => {
    render(<ExportDialog {...mockProps} />);
    
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);
    
    expect(mockProps.onClose).toHaveBeenCalled();
  });
});