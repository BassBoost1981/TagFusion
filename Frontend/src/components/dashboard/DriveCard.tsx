import { motion } from 'framer-motion';
import { HardDrive, Disc, Usb, Network } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { FolderItem } from '../../types';

interface DriveCardProps {
  drive: FolderItem;
  onClick: (drive: FolderItem) => void;
  delay?: number;
}

export function DriveCard({ drive, onClick, delay = 0 }: DriveCardProps) {
  const { t } = useTranslation();
  const totalGB = drive.totalSize ? drive.totalSize / (1024 ** 3) : 0;
  const freeGB = drive.freeSpace ? drive.freeSpace / (1024 ** 3) : 0;
  const usedGB = totalGB - freeGB;
  const usagePercent = totalGB > 0 ? (usedGB / totalGB) * 100 : 0;

  // Determine color based on usage
  const getBarColor = () => {
    if (usagePercent > 90) return 'bg-red-500';
    if (usagePercent > 75) return 'bg-amber-500';
    return 'bg-cyan-500';
  };

  const getIcon = () => {
    switch (drive.driveType) {
      case 'Fixed':
        return <HardDrive size={32} className="text-cyan-400" />;
      case 'CDRom':
        return <Disc size={32} className="text-cyan-400" />;
      case 'Removable':
        return <Usb size={32} className="text-cyan-400" />;
      case 'Network':
        return <Network size={32} className="text-blue-400" />;
      default:
        return <HardDrive size={32} className="text-cyan-400" />;
    }
  };

  const formatSize = (bytes: number) => {
    const gb = bytes / (1024 ** 3);
    if (gb >= 1000) {
      return `${(gb / 1024).toFixed(2)} TB`;
    }
    return `${gb.toFixed(0)} GB`;
  };

  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25, delay }}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onClick(drive)}
      className="p-4 rounded-xl transition-all duration-300 text-left group cursor-pointer w-full backdrop-blur-glass-sm relative overflow-hidden"
      style={{
        background: 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
      }}
    >
      {/* Glass Specular Highlight */}
      <div
        className="absolute inset-x-0 top-0 h-[1px]"
        style={{ background: 'var(--glass-specular)' }}
      />
      <div className="flex items-start gap-4">
        {/* Drive Icon */}
        <div className="p-2 rounded-lg bg-[var(--color-cyan-subtle)] group-hover:bg-cyan-500/20 transition-colors">
          {getIcon()}
        </div>

        {/* Drive Info */}
        <div className="flex-1 min-w-0">
          {/* Drive Name */}
          <h4 className="font-medium text-[var(--color-text-primary)] truncate mb-2 group-hover:text-cyan-300 transition-colors">
            {drive.name}
          </h4>

          {/* Status Indicator + Progress Bar */}
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-2 h-2 rounded-full ${usagePercent > 90 ? 'bg-red-500' : 'bg-green-500'}`} />
            <div className="flex-1 h-2 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${usagePercent}%` }}
                transition={{ delay: delay + 0.2, duration: 0.5 }}
                className={`h-full ${getBarColor()} rounded-full`}
              />
            </div>
          </div>

          {/* Size Info */}
          <p className="text-xs text-[var(--color-text-secondary)]">
            <span className="text-[var(--color-text-primary)]">{formatSize(drive.freeSpace || 0)}</span> {t('hero.freeOf')} {formatSize(drive.totalSize || 0)}
          </p>
        </div>
      </div>
    </motion.button>
  );
}

