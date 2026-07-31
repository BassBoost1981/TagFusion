import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TagLibraryImportConfirmModal } from './TagLibraryImportConfirmModal';
import { useModalStore } from '../../stores/modalStore';
import { useTagStore } from '../../stores/tagStore';
import { useToastStore } from '../../stores/toastStore';
import { bridge } from '../../services/bridge';

vi.mock('../../services/bridge', () => ({
  bridge: {
    importTagLibrary: vi.fn(),
    getTagLibrary: vi.fn(),
    saveTagLibrary: vi.fn(),
  },
}));

const importTagLibrary = vi.mocked(bridge.importTagLibrary);

describe('TagLibraryImportConfirmModal', () => {
  let reloadLibrary: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    reloadLibrary = vi.fn().mockResolvedValue(undefined);
    useTagStore.setState({ reloadLibrary });
    useToastStore.setState({ toasts: [] });
    useModalStore.getState().openModal('tagLibraryImportConfirm', { categoryCount: 3 });
  });

  it('warns that the existing library is replaced and imports nothing on its own', () => {
    render(<TagLibraryImportConfirmModal />);

    expect(screen.getByText(/ersetzt die komplette Tag-Bibliothek/i)).toBeInTheDocument();
    expect(screen.getByText(/3 Kategorien/)).toBeInTheDocument();
    expect(importTagLibrary).not.toHaveBeenCalled();
  });

  it('imports, reloads the tag store and reports the counts after confirmation', async () => {
    importTagLibrary.mockResolvedValue({
      cancelled: false,
      filePath: 'C:\\Backup\\lib.json',
      categoryCount: 4,
      tagCount: 17,
    });
    render(<TagLibraryImportConfirmModal />);

    fireEvent.click(screen.getByRole('button', { name: /ersetzen/i }));

    await waitFor(() => expect(reloadLibrary).toHaveBeenCalledTimes(1));
    expect(importTagLibrary).toHaveBeenCalledTimes(1);
    expect(useToastStore.getState().toasts).toEqual([
      expect.objectContaining({ type: 'success', message: expect.stringContaining('4 Kategorien, 17 Tags') }),
    ]);
    expect(useModalStore.getState().type).toBeNull();
  });

  it('treats a cancelled file dialog as a no-op without any toast', async () => {
    importTagLibrary.mockResolvedValue({ cancelled: true, filePath: null, categoryCount: 0, tagCount: 0 });
    render(<TagLibraryImportConfirmModal />);

    fireEvent.click(screen.getByRole('button', { name: /ersetzen/i }));

    await waitFor(() => expect(useModalStore.getState().type).toBeNull());
    expect(reloadLibrary).not.toHaveBeenCalled();
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('shows the backend message as an error toast and keeps the library untouched', async () => {
    importTagLibrary.mockRejectedValue(new Error('Die Datei ist keine TagFusion-Tag-Bibliothek.'));
    render(<TagLibraryImportConfirmModal />);

    fireEvent.click(screen.getByRole('button', { name: /ersetzen/i }));

    await waitFor(() =>
      expect(useToastStore.getState().toasts).toEqual([
        expect.objectContaining({ type: 'error', message: 'Die Datei ist keine TagFusion-Tag-Bibliothek.' }),
      ])
    );
    expect(reloadLibrary).not.toHaveBeenCalled();
  });

  it('does not import when the dialog is dismissed', async () => {
    render(<TagLibraryImportConfirmModal />);

    fireEvent.click(screen.getByRole('button', { name: /abbrechen/i }));

    expect(importTagLibrary).not.toHaveBeenCalled();
    expect(useModalStore.getState().type).toBeNull();
  });
});
