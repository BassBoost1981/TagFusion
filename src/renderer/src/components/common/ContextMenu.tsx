import React, { useEffect, useRef, useState } from 'react';
import { ContextMenuConfig, ContextMenuItem, ContextMenuAction } from '../../../../types/global';
import './ContextMenu.css';

interface ContextMenuProps {
  config: ContextMenuConfig | null;
  onAction: (action: ContextMenuAction) => void;
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ config, onAction, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [submenuOpen, setSubmenuOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!config) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [config, onClose]);

  useEffect(() => {
    if (config && menuRef.current) {
      const menu = menuRef.current;
      const rect = menu.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Adjust position if menu would go off-screen
      let { x, y } = config.position;
      
      if (x + rect.width > viewportWidth) {
        x = viewportWidth - rect.width - 10;
      }
      
      if (y + rect.height > viewportHeight) {
        y = viewportHeight - rect.height - 10;
      }

      menu.style.left = `${Math.max(0, x)}px`;
      menu.style.top = `${Math.max(0, y)}px`;
    }
  }, [config]);

  if (!config) return null;

  const handleItemClick = (item: ContextMenuItem) => {
    if (item.disabled || item.separator) return;

    if (item.submenu) {
      setSubmenuOpen(submenuOpen === item.id ? null : item.id);
      return;
    }

    const action: ContextMenuAction = {
      type: item.action,
      payload: item.value,
      target: config.target,
      selectedItems: config.selectedItems
    };

    onAction(action);
    onClose();
  };

  const renderMenuItem = (item: ContextMenuItem, index: number) => {
    if (item.separator) {
      return <div key={`separator-${index}`} className="context-menu-separator" />;
    }

    const hasSubmenu = item.submenu && item.submenu.length > 0;
    const isSubmenuOpen = submenuOpen === item.id;

    return (
      <div key={item.id} className="context-menu-item-container">
        <div
          className={`context-menu-item ${item.disabled ? 'disabled' : ''} ${hasSubmenu ? 'has-submenu' : ''}`}
          onClick={() => handleItemClick(item)}
          onMouseEnter={() => hasSubmenu && setSubmenuOpen(item.id)}
        >
          {item.icon && <span className="context-menu-icon">{item.icon}</span>}
          <span className="context-menu-label">{item.label}</span>
          {item.shortcut && <span className="context-menu-shortcut">{item.shortcut}</span>}
          {hasSubmenu && <span className="context-menu-arrow">▶</span>}
        </div>
        
        {hasSubmenu && isSubmenuOpen && (
          <div className="context-submenu">
            {item.submenu!.map((subItem, subIndex) => renderMenuItem(subItem, subIndex))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{
        position: 'fixed',
        left: config.position.x,
        top: config.position.y,
        zIndex: 9999
      }}
    >
      {config.items.map((item, index) => renderMenuItem(item, index))}
    </div>
  );
};