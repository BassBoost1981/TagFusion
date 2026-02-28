import { motion } from 'framer-motion';
import { FolderOpen, Tags, SearchX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { GlassButton } from './glass';

export type EmptyStateType = 'no-results' | 'empty-folder' | 'no-tags';

interface EmptyStateProps {
  type: EmptyStateType;
  onAction?: () => void;
}

export function EmptyState({ type, onAction }: EmptyStateProps) {
  const { t } = useTranslation();

  const configs: Record<
    EmptyStateType,
    {
      icon: React.ReactNode;
      iconClass: string;
      title: string;
      subtitle: string;
      actionLabel?: string;
    }
  > = {
    'no-results': {
      icon: <SearchX className="w-16 h-16" />,
      iconClass: 'text-cyan-400/50',
      title: t('emptyState.noResults'),
      subtitle: t('emptyState.noResultsHint'),
      actionLabel: t('emptyState.resetFilters'),
    },
    'empty-folder': {
      icon: <FolderOpen className="w-16 h-16" />,
      iconClass: 'text-cyan-400/40',
      title: t('emptyState.folderEmpty'),
      subtitle: t('emptyState.noImages'),
      actionLabel: undefined,
    },
    'no-tags': {
      icon: <Tags className="w-16 h-16" />,
      iconClass: 'text-cyan-400/40',
      title: t('emptyState.noTags'),
      subtitle: t('emptyState.noTagsHint'),
      actionLabel: t('emptyState.openTagManager'),
    },
  };

  const config = configs[type];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex flex-col items-center justify-center h-full p-8"
    >
      {/* Animated Glow Background */}
      <div className="relative">
        {/* Pulsing glow effect */}
        <motion.div
          className="absolute inset-0 bg-cyan-500/20 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          style={{ width: '150%', height: '150%', left: '-25%', top: '-25%' }}
        />

        {/* Secondary glow ring */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(6,182,212,0.15) 0%, transparent 70%)',
            width: '200%',
            height: '200%',
            left: '-50%',
            top: '-50%',
          }}
          animate={{
            scale: [0.8, 1.1, 0.8],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 0.5,
          }}
        />

        {/* Icon container with glass effect */}
        <motion.div
          className={`relative p-8 rounded-2xl backdrop-blur-sm border border-cyan-500/10 ${config.iconClass}`}
          style={{
            background: 'linear-gradient(135deg, rgba(6,182,212,0.08) 0%, rgba(6,182,212,0.02) 100%)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
          whileHover={{ scale: 1.05 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          {config.icon}
        </motion.div>
      </div>

      {/* Text content */}
      <motion.h3
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.3 }}
        className="mt-8 text-xl font-medium text-slate-200"
      >
        {config.title}
      </motion.h3>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.3 }}
        className="mt-2 text-sm text-slate-400 text-center max-w-xs"
      >
        {config.subtitle}
      </motion.p>

      {/* Action Button */}
      {config.actionLabel && onAction && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.3 }}
          className="mt-6"
        >
          <GlassButton onClick={onAction} variant="accent" size="sm">
            {config.actionLabel}
          </GlassButton>
        </motion.div>
      )}
    </motion.div>
  );
}
