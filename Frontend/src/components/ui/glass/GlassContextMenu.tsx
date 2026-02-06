import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useContextMenuStore } from '../../../stores/contextMenuStore';

declare global {
  interface Window {
    __contextMenuCleanup?: () => void;
  }
}

export function GlassContextMenu() {
  const { isOpen, x, y, sections, hide } = useContextMenuStore();
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Check if light mode is active
  const isLightMode = document.documentElement.classList.contains('light-mode');

  console.log('[GlassContextMenu] render - isOpen:', isOpen, 'x:', x, 'y:', y, 'sections:', sections.length);

  // Flatten items for keyboard navigation
  const allItems = sections.flatMap(s => s.items.filter(i => !i.disabled));

  // Set initial position from store values
  useEffect(() => {
    if (isOpen) {
      setPosition({ x, y });
    }
  }, [isOpen, x, y]);

  // Calculate position to keep menu in viewport (after first render)
  useEffect(() => {
    if (!isOpen || !menuRef.current) return;

    const menu = menuRef.current;
    const rect = menu.getBoundingClientRect();
    const padding = 8;

    let newX = x;
    let newY = y;

    // Adjust horizontal position
    if (x + rect.width > window.innerWidth - padding) {
      newX = window.innerWidth - rect.width - padding;
    }
    if (newX < padding) newX = padding;

    // Adjust vertical position
    if (y + rect.height > window.innerHeight - padding) {
      newY = window.innerHeight - rect.height - padding;
    }
    if (newY < padding) newY = padding;

    if (newX !== position.x || newY !== position.y) {
      setPosition({ x: newX, y: newY });
    }
  }, [isOpen, x, y, position.x, position.y]);

  // Close on click outside - with slight delay to prevent immediate close
  useEffect(() => {
    if (!isOpen) return;

    // Small delay to prevent the context menu from closing immediately
    // due to the same mousedown event that triggered it
    const timeoutId = setTimeout(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
          hide();
        }
      };

      document.addEventListener('mousedown', handleClickOutside);

      // Store cleanup function
      window.__contextMenuCleanup = () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, 10);

    const handleScroll = () => hide();
    const handleResize = () => hide();

    document.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timeoutId);
      if (window.__contextMenuCleanup) {
        window.__contextMenuCleanup();
        delete window.__contextMenuCleanup;
      }
      document.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen, hide]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        hide();
        break;
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => (prev + 1) % allItems.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => (prev - 1 + allItems.length) % allItems.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < allItems.length) {
          allItems[focusedIndex].onClick();
          hide();
        }
        break;
    }
  }, [isOpen, hide, allItems, focusedIndex]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Reset focus when menu opens
  useEffect(() => {
    if (isOpen) {
      setFocusedIndex(-1);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  let itemIndex = 0;

  // Theme-aware styles
  const menuStyles = isLightMode
    ? {
      background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.75) 0%, rgba(248, 250, 252, 0.70) 100%)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(8, 145, 178, 0.3)',
      boxShadow: '0 20px 60px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(255, 255, 255, 0.5) inset',
    }
    : {
      background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.60) 0%, rgba(15, 23, 42, 0.50) 100%)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(6, 182, 212, 0.25)',
      boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05) inset',
    };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, scale: 0.95, y: -5 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -5 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="fixed z-[9999] min-w-[200px] py-2 rounded-xl overflow-hidden"
          style={{
            left: position.x,
            top: position.y,
            ...menuStyles
          }}
        >
          {/* Specular highlight */}
          <div
            className="absolute inset-x-0 top-0 h-[1px]"
            style={{
              background: isLightMode
                ? 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.8) 50%, transparent 100%)'
                : 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)'
            }}
          />

          {sections.map((section, sectionIndex) => (
            <div key={sectionIndex}>
              {sectionIndex > 0 && (
                <div className="my-1.5 mx-3 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
              )}
              {section.items.map((item) => {
                const currentItemIndex = itemIndex++;
                const isFocused = currentItemIndex === focusedIndex;

                return (
                  <motion.button
                    key={item.id}
                    onClick={() => {
                      if (!item.disabled) {
                        item.onClick();
                        hide();
                      }
                    }}
                    disabled={item.disabled}
                    className={`
                      w-full px-3 py-2 flex items-center gap-3 text-left text-sm transition-colors
                      ${item.disabled
                        ? 'opacity-40 cursor-not-allowed'
                        : isLightMode
                          ? 'cursor-pointer hover:bg-cyan-500/10'
                          : 'cursor-pointer hover:bg-white/10'
                      }
                      ${item.danger
                        ? 'text-red-500 hover:text-red-600'
                        : isLightMode
                          ? 'text-slate-700'
                          : 'text-slate-200'
                      }
                      ${isFocused ? 'bg-cyan-500/20' : ''}
                    `}
                    whileHover={!item.disabled ? { x: 2 } : undefined}
                  >
                    {item.icon && (
                      <span className={`w-4 h-4 flex items-center justify-center ${item.danger ? 'text-red-500' : 'text-cyan-500'}`}>
                        {item.icon}
                      </span>
                    )}
                    <span className="flex-1">{item.label}</span>
                    {item.shortcut && (
                      <span className={`text-xs font-mono ${isLightMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        {item.shortcut}
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

