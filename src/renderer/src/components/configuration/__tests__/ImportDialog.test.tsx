import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ImportDialog } from '../ImportDialog';
import { configurationApi } from '../../../api/configurationApi';
import { ImportResult } from '../../../../main/repositories/ConfigurationRepository';

// Mock the configuration API
vi.mock('../../../api/configurationApi', () => ({
  configurationApi: {
    showOpenDialog: vi.fn(),
    validateImportFile: vi.fn(),
    importFromFile: vi.fn()
  }
}));

describe('ImportDialog', () => {
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
    render(<ImportDialog {...mockProps} />);
    
    expect(screen.getByText('Import Configuration')).toBeInTheDocument();
    expect(screen.getByText(/Import a previously exported TagFusion configuration/)).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    render(<ImportDialog {...mockProps} isOpen={false} />);
    
    expect(screen.queryByText('Import Configuration')).not.toBeInTheDocument();
  });

  it('should show file selector initially', () => {
    render(<ImportDialog {...mockProps} />);
    
    expect(screen.getByText('Select File')).toBeInTheDocument();
    expect(screen.queryByText('Import Options')).not.toBeInTheDocument();
  });

  it('should handle file selection and validation', async () => {
    const mockShowOpenDialog = vi.mocked(configurationApi.showOpenDialog);
    const mockValidateImportFile = vi.mocked(configurationApi.validateImportFile);
    
    mockShowOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/path/to/config.json']
    });
    mockValidateImportFile.mockResolvedValue({
      valid: true,
      version: '1.0.0'
    });
    
    render(<ImportDialog {...mockProps} />);
    
    const selectButton = screen.getByText('Select File');
    fireEvent.click(selectButton);
    
    await waitFor(() => {
      expect(mockShowOpenDialog).toHaveBeenCalled();
      expect(mockValidateImportFile).toHaveBeenCalledWith('/path/to/config.json');
      expect(screen.getByText('config.json')).toBeInTheDocument();
      expect(screen.getByText('✓ Valid configuration file (v1.0.0)')).toBeInTheDocument();
      expect(screen.getByText('Import Options')).toBeInTheDocument();
    });
  });

  it('should handle invalid file', async () => {
    const mockShowOpenDialog = vi.mocked(configurationApi.showOpenDialog);
    const mockValidateImportFile = vi.mocked(configurationApi.validateImportFile);
    
    mockShowOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/path/to/invalid.json']
    });
    mockValidateImportFile.mockResolvedValue({
      valid: false,
      error: 'Invalid file format'
    });
    
    render(<ImportDialog {...mockProps} />);
    
    const selectButton = screen.getByText('Select File');
    fireEvent.click(selectButton);
    
    await waitFor(() => {
      expect(screen.getByText('✗ Invalid file format')).toBeInTheDocument();
      expect(screen.queryByText('Import Options')).not.toBeInTheDocument();
    });
  });

  it('should have correct default import options', async () => {
    const mockShowOpenDialog = vi.mocked(configurationApi.showOpenDialog);
    const mockValidateImportFile = vi.mocked(configurationApi.validateImportFile);
    
    mockShowOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/path/to/config.json']
    });
    mockValidateImportFile.mockResolvedValue({
      valid: true,
      version: '1.0.0'
    });
    
    render(<ImportDialog {...mockProps} />);
    
    const selectButton = screen.getByText('Select File');
    fireEvent.click(selectButton);
    
    await waitFor(() => {
      // Check merge mode default
      const mergeRadio = screen.getByLabelText(/Merge with existing/);
      expect(mergeRadio).toBeChecked();
      
      // Check import options defaults
      expect(screen.getByLabelText(/Import Favorites/)).toBeChecked();
      expect(screen.getByLabelText(/Import Tag Hierarchy/)).toBeChecked();
      expect(screen.getByLabelText(/Import Application Settings/)).toBeChecked();
    });
  });

  it('should allow changing import options', async () => {
    const mockShowOpenDialog = vi.mocked(configurationApi.showOpenDialog);
    const mockValidateImportFile = vi.mocked(configurationApi.validateImportFile);
    
    mockShowOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/path/to/config.json']
    });
    mockValidateImportFile.mockResolvedValue({
      valid: true,
      version: '1.0.0'
    });
    
    render(<ImportDialog {...mockProps} />);
    
    const selectButton = screen.getByText('Select File');
    fireEvent.click(selectButton);
    
    await waitFor(() => {
      const overwriteRadio = screen.getByLabelText(/Overwrite existing/);
      const favoritesCheckbox = screen.getByLabelText(/Import Favorites/);
      
      fireEvent.click(overwriteRadio);
      expect(overwriteRadio).toBeChecked();
      
      fireEvent.click(favoritesCheckbox);
      expect(favoritesCheckbox).not.toBeChecked();
    });
  });

  it('should handle successful import', async () => {
    const mockShowOpenDialog = vi.mocked(configurationApi.showOpenDialog);
    const mockValidateImportFile = vi.mocked(configurationApi.validateImportFile);
    const mockImportFromFile = vi.mocked(configurationApi.importFromFile);
    
    const mockResult: ImportResult = {
      success: true,
      conflicts: [],
      imported: {
        favorites: 2,
        tagNodes: 5,
        settingsUpdated: true
      }
    };
    
    mockShowOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/path/to/config.json']
    });
    mockValidateImportFile.mockResolvedValue({
      valid: true,
      version: '1.0.0'
    });
    mockImportFromFile.mockResolvedValue(mockResult);
    
    render(<ImportDialog {...mockProps} />);
    
    // Select file
    const selectButton = screen.getByText('Select File');
    fireEvent.click(selectButton);
    
    await waitFor(() => {
      expect(screen.getByText('Import Configuration')).toBeInTheDocument();
    });
    
    // Import
    const importButton = screen.getByText('Import Configuration');
    fireEvent.click(importButton);
    
    await waitFor(() => {
      expect(mockImportFromFile).toHaveBeenCalledWith('/path/to/config.json', {
        mergeMode: 'merge',
        importFavorites: true,
        importTagHierarchy: true,
        importSettings: true
      });
      expect(mockProps.onSuccess).toHaveBeenCalledWith(mockResult);
      expect(mockProps.onClose).toHaveBeenCalled();
    });
  });

  it('should show conflicts dialog when conflicts exist', async () => {
    const mockShowOpenDialog = vi.mocked(configurationApi.showOpenDialog);
    const mockValidateImportFile = vi.mocked(configurationApi.validateImportFile);
    const mockImportFromFile = vi.mocked(configurationApi.importFromFile);
    
    const mockResult: ImportResult = {
      success: true,
      conflicts: [
        {
          type: 'favorite',
          item: '/home/user/Pictures',
          existingValue: 'My Pictures',
          newValue: 'Pictures Folder',
          resolution: 'keep'
        }
      ],
      imported: {
        favorites: 1,
        tagNodes: 0,
        settingsUpdated: false
      }
    };
    
    mockShowOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/path/to/config.json']
    });
    mockValidateImportFile.mockResolvedValue({
      valid: true,
      version: '1.0.0'
    });
    mockImportFromFile.mockResolvedValue(mockResult);
    
    render(<ImportDialog {...mockProps} />);
    
    // Select file and import
    const selectButton = screen.getByText('Select File');
    fireEvent.click(selectButton);
    
    await waitFor(() => {
      const importButton = screen.getByText('Import Configuration');
      fireEvent.click(importButton);
    });
    
    await waitFor(() => {
      expect(screen.getByText('Import Conflicts Resolved')).toBeInTheDocument();
      expect(screen.getByText('/home/user/Pictures')).toBeInTheDocument();
      expect(screen.getByText('Resolution: Kept existing')).toBeInTheDocument();
    });
  });

  it('should disable import button when no options selected', async () => {
    const mockShowOpenDialog = vi.mocked(configurationApi.showOpenDialog);
    const mockValidateImportFile = vi.mocked(configurationApi.validateImportFile);
    
    mockShowOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/path/to/config.json']
    });
    mockValidateImportFile.mockResolvedValue({
      valid: true,
      version: '1.0.0'
    });
    
    render(<ImportDialog {...mockProps} />);
    
    const selectButton = screen.getByText('Select File');
    fireEvent.click(selectButton);
    
    await waitFor(() => {
      const favoritesCheckbox = screen.getByLabelText(/Import Favorites/);
      const tagsCheckbox = screen.getByLabelText(/Import Tag Hierarchy/);
      const settingsCheckbox = screen.getByLabelText(/Import Application Settings/);
      
      // Uncheck all options
      fireEvent.click(favoritesCheckbox);
      fireEvent.click(tagsCheckbox);
      fireEvent.click(settingsCheckbox);
      
      const importButton = screen.getByText('Import Configuration');
      expect(importButton).toBeDisabled();
    });
  });

  it('should handle import error', async () => {
    const mockShowOpenDialog = vi.mocked(configurationApi.showOpenDialog);
    const mockValidateImportFile = vi.mocked(configurationApi.validateImportFile);
    const mockImportFromFile = vi.mocked(configurationApi.importFromFile);
    
    mockShowOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/path/to/config.json']
    });
    mockValidateImportFile.mockResolvedValue({
      valid: true,
      version: '1.0.0'
    });
    mockImportFromFile.mockRejectedValue(new Error('Import failed'));
    
    render(<ImportDialog {...mockProps} />);
    
    // Select file
    const selectButton = screen.getByText('Select File');
    fireEvent.click(selectButton);
    
    await waitFor(() => {
      const importButton = screen.getByText('Import Configuration');
      fireEvent.click(importButton);
    });
    
    await waitFor(() => {
      expect(mockProps.onError).toHaveBeenCalledWith('Import failed');
    });
  });
});