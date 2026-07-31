import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Keyboard } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Press `?` (anywhere outside an input) to open this overlay.
 * Centralized hotkey reference so users don't have to discover them by trial.
 * Mit `?` ausserhalb von Eingabefeldern aufrufbar.
 */
export function KeyboardShortcutsOverlay() {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ignore when typing in inputs/textareas/contenteditable
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;

      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setIsOpen((v) => !v);
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  // Hotkey reference (kept in sync with useKeyboardShortcuts.ts and Lightbox.tsx)
  const groups: { title: string; items: { keys: string[]; label: string }[] }[] = [
    {
      title: t('shortcuts.groupNavigation') ?? 'Navigation im Raster',
      items: [
        { keys: ['←', '→'], label: t('shortcuts.gridNavStep') ?? 'Vorheriges/nächstes Element' },
        { keys: ['↑', '↓'], label: t('shortcuts.gridNavRow') ?? 'Eine Zeile nach oben/unten' },
        { keys: ['Pos1', 'Ende'], label: t('shortcuts.gridNavEdges') ?? 'Erstes/letztes Element' },
        {
          keys: ['Enter', 'Space'],
          label: t('shortcuts.gridOpen') ?? 'Öffnen (Bild in Lightbox, Ordner betreten)',
        },
        { keys: ['Ctrl', 'F'], label: t('shortcuts.focusSearch') ?? 'Suchfeld fokussieren' },
      ],
    },
    {
      title: t('shortcuts.groupSelection') ?? 'Auswahl',
      items: [
        { keys: ['Ctrl', 'A'], label: t('shortcuts.selectAll') ?? 'Alle auswählen' },
        { keys: ['Shift', '←→↑↓'], label: t('shortcuts.extendSelection') ?? 'Auswahl erweitern' },
        { keys: ['Esc'], label: t('shortcuts.clearSelection') ?? 'Auswahl aufheben' },
      ],
    },
    {
      title: t('shortcuts.groupRating') ?? 'Bewertung',
      items: [
        { keys: ['1 – 5'], label: t('shortcuts.setRating') ?? 'Bewertung für die Auswahl setzen' },
        { keys: ['0'], label: t('shortcuts.clearRating') ?? 'Bewertung der Auswahl löschen' },
      ],
    },
    {
      title: t('shortcuts.groupClipboard') ?? 'Zwischenablage',
      items: [
        { keys: ['Ctrl', 'C'], label: t('shortcuts.copy') ?? 'Kopieren' },
        { keys: ['Ctrl', 'X'], label: t('shortcuts.cut') ?? 'Ausschneiden' },
        { keys: ['Ctrl', 'V'], label: t('shortcuts.paste') ?? 'Einfügen' },
      ],
    },
    {
      title: t('shortcuts.groupFiles') ?? 'Dateien',
      items: [
        { keys: ['F2'], label: t('shortcuts.rename') ?? 'Umbenennen' },
        { keys: ['Del'], label: t('shortcuts.delete') ?? 'Löschen' },
        { keys: ['Alt', 'Enter'], label: t('shortcuts.properties') ?? 'Eigenschaften' },
      ],
    },
    {
      title: t('shortcuts.groupZoom') ?? 'Zoom',
      items: [
        { keys: ['Ctrl', '+'], label: t('shortcuts.zoomIn') ?? 'Vergrößern' },
        { keys: ['Ctrl', '-'], label: t('shortcuts.zoomOut') ?? 'Verkleinern' },
        { keys: ['Ctrl', '0'], label: t('shortcuts.zoomReset') ?? 'Zoom zurücksetzen' },
      ],
    },
    {
      title: t('shortcuts.groupLightbox') ?? 'Lightbox',
      items: [
        { keys: ['←', '→'], label: t('shortcuts.lightboxNav') ?? 'Vorheriges/nächstes Bild' },
        { keys: ['+', '-'], label: t('shortcuts.lightboxZoom') ?? 'Zoom in/out' },
        { keys: ['0'], label: t('shortcuts.lightboxReset') ?? 'Zoom zurücksetzen' },
        { keys: ['I'], label: t('shortcuts.lightboxInfo') ?? 'Info-Panel umschalten' },
        { keys: ['Esc'], label: t('shortcuts.lightboxClose') ?? 'Lightbox schließen' },
      ],
    },
    {
      title: t('shortcuts.groupHelp') ?? 'Hilfe',
      items: [{ keys: ['?'], label: t('shortcuts.helpOverlay') ?? 'Diese Übersicht öffnen/schließen' }],
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[100] flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-label={t('shortcuts.title') ?? 'Tastaturkürzel'}
          onClick={() => setIsOpen(false)}
        >
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)' }} />
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', damping: 22, stiffness: 320 }}
            className="relative max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto glass-section p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Keyboard size={18} className="text-cyan-400" />
                <h2 className="text-lg font-semibold text-cyan-400">{t('shortcuts.title') ?? 'Tastaturkürzel'}</h2>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                aria-label={t('common.close') ?? 'Schließen'}
                className="p-1 rounded-lg hover:bg-white/10 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              {groups.map((group) => (
                <section key={group.title}>
                  <h3 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2">{group.title}</h3>
                  <ul className="space-y-1.5">
                    {group.items.map((item) => (
                      <li key={item.label} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-[var(--color-text-primary)]">{item.label}</span>
                        <span className="flex items-center gap-1 flex-shrink-0">
                          {item.keys.map((k, i) => (
                            <kbd
                              key={i}
                              className="px-1.5 py-0.5 text-xs font-mono rounded border border-white/10 bg-white/5 text-cyan-300"
                            >
                              {k}
                            </kbd>
                          ))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>

            <p className="mt-5 text-xs text-[var(--color-text-muted)] text-center">
              {t('shortcuts.dismissHint') ?? 'Drücke ? oder Esc zum Schließen.'}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
