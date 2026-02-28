import { useState } from 'react';
import { GlassModal, GlassButton } from './glass';
import { useModalStore, type DeleteConfirmData } from '../../stores/modalStore';
import { useToastStore } from '../../stores/toastStore';
import { bridge } from '../../services/bridge';
import { Trash2, AlertTriangle } from 'lucide-react';

export function DeleteConfirmModal() {
  const { type, data, closeModal } = useModalStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOpen = type === 'deleteConfirm';
  const deleteData = data as DeleteConfirmData | null;

  const handleDelete = async () => {
    if (!deleteData?.paths.length) return;

    setIsLoading(true);
    setError(null);

    try {
      await bridge.deleteFiles(deleteData.paths);
      useToastStore.getState().success(count === 1 ? 'Element wurde gelöscht' : `${count} Elemente wurden gelöscht`);
      closeModal();
      // Refresh the view
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Löschen fehlgeschlagen');
      useToastStore.getState().error('Löschen fehlgeschlagen');
    } finally {
      setIsLoading(false);
    }
  };

  const count = deleteData?.paths.length || 0;

  return (
    <GlassModal isOpen={isOpen} onClose={closeModal} title="Löschen bestätigen" size="sm">
      <div className="space-y-4">
        {/* Warning icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
            <AlertTriangle size={32} className="text-red-400" />
          </div>
        </div>

        {/* Message */}
        <div className="text-center">
          <p className="text-slate-200">
            {count === 1
              ? 'Möchtest du dieses Element wirklich löschen?'
              : `Möchtest du diese ${count} Elemente wirklich löschen?`}
          </p>
          <p className="text-sm text-slate-400 mt-2">Die Elemente werden in den Papierkorb verschoben.</p>
        </div>

        {/* File list (if multiple) */}
        {count > 1 && count <= 5 && deleteData && (
          <div className="max-h-32 overflow-y-auto rounded-lg bg-slate-800/50 p-2">
            {deleteData.paths.map((path, i) => (
              <div key={i} className="text-xs text-slate-400 truncate py-1">
                {path.split(/[/\\]/).pop()}
              </div>
            ))}
          </div>
        )}

        {/* Error message */}
        {error && <p className="text-sm text-red-400 text-center">{error}</p>}

        {/* Actions */}
        <div className="flex justify-center gap-3">
          <GlassButton variant="ghost" onClick={closeModal} disabled={isLoading}>
            Abbrechen
          </GlassButton>
          <GlassButton
            variant="danger"
            onClick={handleDelete}
            disabled={isLoading}
            className="bg-red-500/20 hover:bg-red-500/30 text-red-400"
          >
            <Trash2 size={16} />
            {isLoading ? 'Löschen...' : 'Löschen'}
          </GlassButton>
        </div>
      </div>
    </GlassModal>
  );
}
