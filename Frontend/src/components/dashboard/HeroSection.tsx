import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { HardDrive } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DriveCard } from './DriveCard';
import { useDrives, useLoadDrives, useLoadFolders, useLoadImages } from '../../stores/appStore';
import type { FolderItem } from '../../types';

export function HeroSection() {
  const { t } = useTranslation();
  const drives = useDrives();
  const loadDrives = useLoadDrives();
  const loadFolders = useLoadFolders();
  const loadImages = useLoadImages();

  useEffect(() => {
    loadDrives();
  }, [loadDrives]);

  const handleDriveClick = async (drive: FolderItem) => {
    await loadFolders(drive.path);
    await loadImages(drive.path);
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 relative">
      <div className="relative z-10 max-w-6xl mx-auto space-y-12">
        {/* Hero Header */}
        <div className="text-center space-y-6 py-12">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="w-24 h-24 mx-auto mb-8 relative"
          >
            <img src="/logo.png" alt="TagFusion Logo" className="w-full h-full object-contain" />
          </motion.div>

          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-5xl font-bold bg-gradient-to-r from-[var(--color-text-primary)] via-cyan-500 to-cyan-600 bg-clip-text text-transparent pb-2"
          >
            {t('hero.title')}
          </motion.h1>

          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-xl text-[var(--color-text-secondary)] max-w-2xl mx-auto pt-2"
          >
            {t('hero.subtitle')}
          </motion.p>
        </div>

        {/* Drives Section */}
        {drives.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <div className="flex items-center gap-3 mb-4">
              <HardDrive size={20} className="text-cyan-400" />
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{t('hero.drives')}</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {drives.map((drive, index) => (
                <DriveCard key={drive.path} drive={drive} onClick={handleDriveClick} delay={0.6 + index * 0.1} />
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
