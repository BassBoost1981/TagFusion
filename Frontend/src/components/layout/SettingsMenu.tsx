import { useState } from 'react';
import { Menu } from '@base-ui-components/react/menu';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Languages, Sun, Moon, Zap, Check } from 'lucide-react';
import { GlassIconButton } from '@/components/ui/glass';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTranslation } from 'react-i18next';

export function SettingsMenu() {
  const { t } = useTranslation();
  const { language, setLanguage, theme, setTheme, performanceMode, togglePerformanceMode } = useSettingsStore();

  const [isOpen, setIsOpen] = useState(false);

  return (
    <Menu.Root open={isOpen} onOpenChange={setIsOpen}>
      <Menu.Trigger className="relative">
        <motion.div animate={{ rotate: isOpen ? 30 : 0 }} transition={{ duration: 0.2 }}>
          <GlassIconButton variant="ghost" size="sm" title={t('settings.title')}>
            <Settings size={18} className="text-[var(--color-text-primary)]" />
          </GlassIconButton>
        </motion.div>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={8}>
          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
              >
                <Menu.Popup className="w-64 py-2 rounded-xl backdrop-blur-glass-lg bg-[var(--glass-bg)] border border-[var(--glass-border)] shadow-glass-lg z-50 outline-none">
                  {/* Header */}
                  <div className="px-4 py-2 border-b border-[var(--glass-border)]">
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{t('settings.title')}</h3>
                  </div>

                  {/* Language Section */}
                  <div className="px-4 py-3">
                    <div className="flex items-center gap-2 mb-2 text-[var(--color-text-secondary)]">
                      <Languages size={14} />
                      <span className="text-xs uppercase tracking-wide">{t('settings.language')}</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setLanguage('de')}
                        className={`flex-1 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          language === 'de'
                            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                            : 'text-[var(--color-text-primary)] hover:bg-[var(--glass-bg-hover)]'
                        }`}
                      >
                        <span className="flex items-center gap-2 justify-center">
                          {language === 'de' && <Check size={14} />}
                          DE
                        </span>
                      </button>
                      <button
                        onClick={() => setLanguage('en')}
                        className={`flex-1 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          language === 'en'
                            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                            : 'text-[var(--color-text-primary)] hover:bg-[var(--glass-bg-hover)]'
                        }`}
                      >
                        <span className="flex items-center gap-2 justify-center">
                          {language === 'en' && <Check size={14} />}
                          EN
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Theme Section */}
                  <div className="px-4 py-3 border-t border-[var(--glass-border)]">
                    <div className="flex items-center gap-2 mb-2 text-[var(--color-text-secondary)]">
                      {theme === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
                      <span className="text-xs uppercase tracking-wide">{t('settings.theme')}</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setTheme('light')}
                        className={`flex-1 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          theme === 'light'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'text-[var(--color-text-primary)] hover:bg-[var(--glass-bg-hover)]'
                        }`}
                      >
                        <span className="flex items-center gap-2 justify-center">
                          {theme === 'light' && <Check size={14} />}
                          {t('settings.themeLight')}
                        </span>
                      </button>
                      <button
                        onClick={() => setTheme('dark')}
                        className={`flex-1 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          theme === 'dark'
                            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                            : 'text-[var(--color-text-primary)] hover:bg-[var(--glass-bg-hover)]'
                        }`}
                      >
                        <span className="flex items-center gap-2 justify-center">
                          {theme === 'dark' && <Check size={14} />}
                          {t('settings.themeDark')}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Performance Mode Section */}
                  <div className="px-4 py-3 border-t border-[var(--glass-border)]">
                    <button
                      onClick={togglePerformanceMode}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[var(--glass-bg-hover)] transition-colors"
                    >
                      <div className="flex items-center gap-2 text-[var(--color-text-primary)]">
                        <Zap
                          size={16}
                          className={performanceMode ? 'text-amber-400' : 'text-[var(--color-text-secondary)]'}
                        />
                        <div className="text-left">
                          <div className="text-sm">{t('settings.performanceMode')}</div>
                          <div className="text-xs text-[var(--color-text-muted)]">
                            {t('settings.performanceModeDesc')}
                          </div>
                        </div>
                      </div>
                      <div
                        className={`w-10 h-5 rounded-full transition-colors ${
                          performanceMode ? 'bg-amber-500' : 'bg-[var(--color-text-muted)]'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white mt-0.5 transition-transform ${
                            performanceMode ? 'translate-x-5' : 'translate-x-0.5'
                          }`}
                        />
                      </div>
                    </button>
                  </div>
                </Menu.Popup>
              </motion.div>
            )}
          </AnimatePresence>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
