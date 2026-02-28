import { motion } from 'framer-motion';

interface SkeletonProps {
  className?: string;
  animate?: boolean;
}

/**
 * Base Skeleton component with shimmer animation
 */
export function Skeleton({ className = '', animate = true }: SkeletonProps) {
  return (
    <div
      className={`
        relative overflow-hidden rounded-lg
        bg-gradient-to-r from-slate-800/50 via-slate-700/50 to-slate-800/50
        ${className}
      `}
    >
      {animate && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"
          animate={{ x: ['-100%', '100%'] }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      )}
    </div>
  );
}

/**
 * Skeleton for ImageCard
 */
export function ImageCardSkeleton({ size = 200 }: { size?: number }) {
  return (
    <div
      className="rounded-xl overflow-hidden bg-gradient-to-br from-slate-900/80 to-slate-900/60 border border-cyan-500/10"
      style={{ height: size }}
    >
      {/* Thumbnail area */}
      <Skeleton className="h-[70%] rounded-none" />

      {/* Footer */}
      <div className="p-3 space-y-2">
        {/* Filename */}
        <Skeleton className="h-3 w-3/4" />

        {/* Rating stars */}
        <div className="flex gap-1">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-3 w-3 rounded-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for FolderCard
 */
export function FolderCardSkeleton({ size = 200 }: { size?: number }) {
  return (
    <div
      className="rounded-xl overflow-hidden bg-gradient-to-br from-slate-900/80 to-slate-900/60 border border-cyan-500/10"
      style={{ height: size }}
    >
      {/* Icon area */}
      <div className="h-[70%] flex items-center justify-center">
        <Skeleton className="w-14 h-14 rounded-xl" />
      </div>

      {/* Footer */}
      <div className="p-3 space-y-1">
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-2 w-1/3" />
      </div>
    </div>
  );
}

/**
 * Grid of skeleton cards for loading state
 */
export function ImageGridSkeleton({ count = 12, itemSize = 200 }: { count?: number; itemSize?: number }) {
  return (
    <div
      className="grid gap-5"
      style={{
        gridTemplateColumns: `repeat(auto-fill, minmax(${itemSize}px, 1fr))`,
      }}
    >
      {[...Array(count)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: i * 0.05, duration: 0.3 }}
        >
          {i % 4 === 0 ? <FolderCardSkeleton size={itemSize} /> : <ImageCardSkeleton size={itemSize} />}
        </motion.div>
      ))}
    </div>
  );
}
