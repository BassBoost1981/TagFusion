import { useState, useEffect, useRef } from 'react';
import { GlassModal, GlassInput, GlassButton } from './glass';
import { useModalStore, type RenameData } from '../../stores/modalStore';
import { bridge } from '../../services/bridge';
import { Folder, Image } from 'lucide-react';

export function RenameModal() {
  const { type, data, closeModal } = useModalStore();
  const [newName, setNewName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isOpen = type === 'rename';
  const renameData = data as RenameData | null;

  useEffect(() => {
    if (isOpen && renameData) {
      // Extract name without extension for files
      const name = renameData.name;
      const dotIndex = name.lastIndexOf('.');
      if (!renameData.isFolder && dotIndex > 0) {
        setNewName(name.substring(0, dotIndex));
      } else {
        setNewName(name);
      }
      setError(null);

      // Focus input after modal opens
      setTimeout(() => {
        inputRef.current?.select();
      }, 100);
    }
  }, [isOpen, renameData]);

  const handleRename = async () => {
    if (!renameData || !newName.trim()) return;

    // Re-add extension for files
    let finalName = newName.trim();
    if (!renameData.isFolder) {
      const ext = renameData.name.substring(renameData.name.lastIndexOf('.'));
      if (ext && ext !== renameData.name) {
        finalName = `${finalName}${ext}`;
      }
    }

    if (finalName === renameData.name) {
      closeModal();
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await bridge.rename(renameData.path, finalName);
      closeModal();
      // Refresh the view
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Umbenennen fehlgeschlagen');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      handleRename();
    }
  };

  return (
    <GlassModal
      isOpen={isOpen}
      onClose={closeModal}
      title="Umbenennen"
      size="sm"
    >
      <div className="space-y-4">
        {/* Current file/folder info */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50">
          {renameData?.isFolder ? (
            <Folder size={24} className="text-cyan-400" />
          ) : (
            <Image size={24} className="text-cyan-400" />
          )}
          <span className="text-sm text-slate-400 truncate">{renameData?.name}</span>
        </div>

        {/* Input */}
        <GlassInput
          ref={inputRef}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Neuer Name"
          autoFocus
        />

        {/* Error message */}
        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <GlassButton variant="ghost" onClick={closeModal} disabled={isLoading}>
            Abbrechen
          </GlassButton>
          <GlassButton
            variant="accent"
            onClick={handleRename}
            disabled={isLoading || !newName.trim()}
          >
            {isLoading ? 'Umbenennen...' : 'Umbenennen'}
          </GlassButton>
        </div>
      </div>
    </GlassModal>
  );
}
