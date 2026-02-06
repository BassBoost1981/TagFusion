import { Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettingsStore } from '@/stores/settingsStore';
import { GlassIconButton } from '@/components/ui/glass';

export function ThemeToggle() {
  const { theme, toggleTheme } = useSettingsStore();
  const isDark = theme === 'dark';

  return (
    <GlassIconButton
      onClick={toggleTheme}
      title={isDark ? 'Light Mode' : 'Dark Mode'}
      variant="ghost"
      size="sm"
      className="relative w-8 h-8"
    >
      <AnimatePresence mode="wait">
        {isDark ? (
          <motion.div
            key="moon"
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 90, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Moon size={18} className="text-cyan-400" />
          </motion.div>
        ) : (
          <motion.div
            key="sun"
            initial={{ rotate: 90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: -90, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Sun size={18} className="text-amber-500" />
          </motion.div>
        )}
      </AnimatePresence>
    </GlassIconButton>
  );
}
