import React, { useState } from 'react';
import './KeyboardShortcutsHelp.css';

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsHelp: React.FC<KeyboardShortcutsHelpProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('navigation');

  if (!isOpen) return null;

  // Static shortcut mappings
  const shortcuts = {
    navigation: {
      'Alt+Home': 'Zur Startansicht',
      'Alt+←': 'Zurück',
      'Alt+→': 'Vorwärts',
      'Alt+↑': 'Ordner nach oben',
      'F5': 'Aktualisieren',
    },
    selection: {
      'Ctrl+A': 'Alles auswählen',
      'Ctrl+Click': 'Mehrfachauswahl',
      'Shift+Click': 'Bereichsauswahl',
      'Esc': 'Auswahl aufheben',
    },
    fileOperations: {
      'Ctrl+C': 'Kopieren',
      'Ctrl+X': 'Ausschneiden',
      'Ctrl+V': 'Einfügen',
      'F2': 'Umbenennen',
      'Delete': 'Löschen',
    },
    view: {
      'F11': 'Vollbild-Viewer',
      'Ctrl+1': 'Raster-Ansicht',
      'Ctrl+2': 'Listen-Ansicht',
      'Ctrl++': 'Vergrößern',
      'Ctrl+-': 'Verkleinern',
      'Ctrl+0': 'Zoom zurücksetzen',
    },
    search: {
      'Ctrl+F': 'Suche fokussieren',
      'F3': 'Weitersuchen',
      'Shift+F3': 'Rückwärts suchen',
    },
    favorites: {
      'F': 'Zu Favoriten hinzufügen',
      'Ctrl+D': 'Zu Favoriten hinzufügen',
      'Ctrl+1-9': 'Favorit öffnen',
    },
    application: {
      'Ctrl+,': 'Einstellungen',
      'F1': 'Hilfe',
      'Ctrl+Q': 'Beenden',
    },
  };

  const categories = Object.keys(shortcuts);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const formatShortcut = (shortcut: string): string => {
    return shortcut
      .replace('Ctrl', 'Strg')
      .replace('Alt', 'Alt')
      .replace('Shift', 'Umschalt');
  };

  const getCategoryDisplayName = (category: string): string => {
    const displayNames: Record<string, string> = {
      navigation: 'Navigation',
      selection: 'Auswahl',
      fileOperations: 'Dateioperationen',
      view: 'Ansicht',
      search: 'Suche',
      favorites: 'Favoriten',
      application: 'Anwendung',
    };
    return displayNames[category] || category;
  };

  return (
    <div className="keyboard-shortcuts-overlay" onClick={handleOverlayClick}>
      <div className="keyboard-shortcuts-dialog">
        <div className="keyboard-shortcuts-header">
          <h2>Tastenkürzel</h2>
          <button className="close-button" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="keyboard-shortcuts-content">
          <div className="shortcuts-categories">
            {categories.map(category => (
              <button
                key={category}
                className={`category-button ${activeCategory === category ? 'active' : ''}`}
                onClick={() => setActiveCategory(category)}
              >
                {getCategoryDisplayName(category)}
              </button>
            ))}
          </div>

          <div className="shortcuts-list">
            <h3>{getCategoryDisplayName(activeCategory)}</h3>
            <div className="shortcuts-grid">
              {Object.entries(shortcuts[activeCategory as keyof typeof shortcuts] || {}).map(([shortcut, description]) => (
                <div key={shortcut} className="shortcut-item">
                  <div className="shortcut-keys">
                    {formatShortcut(shortcut).split('+').map((key, index, array) => (
                      <React.Fragment key={index}>
                        <kbd className="key">{key}</kbd>
                        {index < array.length - 1 && <span className="plus">+</span>}
                      </React.Fragment>
                    ))}
                  </div>
                  <div className="shortcut-description">{description}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="keyboard-shortcuts-footer">
          <p className="shortcuts-note">
            Hinweis: Einige Tastenkürzel funktionieren möglicherweise nicht, wenn ein Eingabefeld fokussiert ist.
          </p>
        </div>
      </div>
    </div>
  );
};