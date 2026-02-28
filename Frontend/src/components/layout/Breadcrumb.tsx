import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, HardDrive } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';

export function Breadcrumb() {
  const { currentFolder, navigateToFolder } = useAppStore();

  const segments = useMemo(() => {
    if (!currentFolder) return [];

    const normalized = currentFolder.replace(/\\/g, '/');
    const parts = normalized.split('/').filter(Boolean);

    return parts.map((part, index) => {
      // Build path up to this segment
      const pathParts = parts.slice(0, index + 1);
      let path = pathParts.join('\\');
      // Add trailing backslash for drive root
      if (pathParts.length === 1 && path.endsWith(':')) {
        path += '\\';
      }
      return { name: part, path };
    });
  }, [currentFolder]);

  if (segments.length === 0) return null;

  return (
    <div className="flex items-center gap-1 text-sm overflow-hidden">
      {segments.map((segment, index) => (
        <div key={segment.path} className="flex items-center gap-1 min-w-0">
          {index > 0 && <ChevronRight size={14} className="text-slate-600 flex-shrink-0" />}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigateToFolder(segment.path)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md truncate transition-colors ${
              index === segments.length - 1
                ? 'text-cyan-400 bg-cyan-500/10 font-medium'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
            title={segment.path}
          >
            {index === 0 && <HardDrive size={14} className="flex-shrink-0" />}
            <span className="truncate">{segment.name}</span>
          </motion.button>
        </div>
      ))}
    </div>
  );
}
