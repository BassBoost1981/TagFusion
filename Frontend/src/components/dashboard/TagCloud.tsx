import { motion } from 'framer-motion';
import { Tag as TagIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Tag } from '../../types';

interface TagCloudProps {
  tags: Tag[];
  onTagClick?: (tag: string) => void;
}

export function TagCloud({ tags, onTagClick }: TagCloudProps) {
  const { t } = useTranslation();
  // Sort by usage count
  const sortedTags = [...tags].sort((a, b) => b.usageCount - a.usageCount).slice(0, 20);

  // Calculate font sizes based on usage
  const maxUsage = Math.max(...sortedTags.map(t => t.usageCount), 1);
  const minUsage = Math.min(...sortedTags.map(t => t.usageCount), 0);

  const getFontSize = (count: number) => {
    if (maxUsage === minUsage) return 1;
    const normalized = (count - minUsage) / (maxUsage - minUsage);
    return 0.8 + (normalized * 1.2); // 0.8rem to 2rem
  };

  const getOpacity = (count: number) => {
    if (maxUsage === minUsage) return 1;
    const normalized = (count - minUsage) / (maxUsage - minUsage);
    return 0.5 + (normalized * 0.5); // 0.5 to 1.0
  };

  return (
    <div
      className="p-6 rounded-xl backdrop-blur-glass-sm relative overflow-hidden"
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
      <div className="flex items-center gap-2 mb-4 text-cyan-400">
        <TagIcon size={18} />
        <h3 className="font-medium">{t('hero.popularTags')}</h3>
      </div>

      <div className="flex flex-wrap gap-3 justify-center items-center min-h-[200px]">
        {sortedTags.length > 0 ? (
          sortedTags.map((tag, index) => (
            <motion.button
              key={tag.name}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25, delay: index * 0.02 }}
              whileHover={{ scale: 1.1 }}
              onClick={() => onTagClick?.(tag.name)}
              className="transition-colors duration-200 text-[var(--color-text-secondary)] hover:text-cyan-400"
              style={{
                fontSize: `${getFontSize(tag.usageCount)}rem`,
                opacity: getOpacity(tag.usageCount),
              }}
            >
              {tag.name}
            </motion.button>
          ))
        ) : (
          <p className="text-[var(--color-text-muted)] text-sm">{t('hero.noTagsFound')}</p>
        )}
      </div>
    </div>
  );
}