import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Upload } from 'lucide-react';
import { GlassModal, GlassButton } from '../ui/glass';
import { useModalStore, type TagLibraryImportConfirmData } from '../../stores/modalStore';
import { useTagStore } from '../../stores/tagStore';
import { useToastStore } from '../../stores/toastStore';
import { bridge } from '../../services/bridge';

/**
 * Confirmation before importing a tag library — the import replaces the whole library,
 * so it must never run without an explicit yes.
 * Rückfrage vor dem Import einer Tag-Bibliothek — der Import ersetzt die komplette
 * Bibliothek und darf daher nie ohne ausdrückliche Zustimmung laufen.
 */
export function TagLibraryImportConfirmModal() {
  const { t } = useTranslation();
  const { type, data, closeModal } = useModalStore();
  const [isImporting, setIsImporting] = useState(false);

  const isOpen = type === 'tagLibraryImportConfirm';
  const confirmData = data as TagLibraryImportConfirmData | null;

  const handleConfirm = async () => {
    setIsImporting(true);

    try {
      const result = await bridge.importTagLibrary();

      // A cancelled file dialog is a regular outcome — no toast, nothing changed.
      // Ein abgebrochener Datei-Dialog ist ein regulärer Ausgang — kein Toast, nichts geändert.
      if (!result.cancelled) {
        await useTagStore.getState().reloadLibrary();
        useToastStore.getState().success(
          t('tagManager.importSuccess', {
            categories: result.categoryCount,
            tags: result.tagCount,
          })
        );
      }
    } catch (error) {
      useToastStore.getState().error(error instanceof Error ? error.message : t('tagManager.importFailed'));
    } finally {
      setIsImporting(false);
      closeModal();
    }
  };

  return (
    <GlassModal isOpen={isOpen} onClose={closeModal} title={t('tagManager.importConfirmTitle')} size="sm">
      <div className="space-y-4" data-testid="tag-library-import-confirm">
        {/* Warning icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center">
            <AlertTriangle size={32} className="text-amber-400" />
          </div>
        </div>

        {/* Message */}
        <div className="text-center">
          <p className="text-slate-200">
            {t('tagManager.importConfirmMessage', { categories: confirmData?.categoryCount ?? 0 })}
          </p>
          <p className="text-sm text-slate-400 mt-2">{t('tagManager.importConfirmHint')}</p>
        </div>

        {/* Actions */}
        <div className="flex justify-center gap-3">
          <GlassButton variant="ghost" onClick={closeModal} disabled={isImporting}>
            {t('common.cancel')}
          </GlassButton>
          <GlassButton variant="accent" onClick={handleConfirm} disabled={isImporting}>
            <Upload size={16} />
            {isImporting ? t('tagManager.importRunning') : t('tagManager.importConfirmAction')}
          </GlassButton>
        </div>
      </div>
    </GlassModal>
  );
}
