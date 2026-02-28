/**
 * GlassTag - Liquid Glass Tag Pill
 * iOS 26 / WWDC 2025 Design
 */

import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { type ReactNode } from 'react';
import { springSnappy } from '../../../styles/animations';

export interface GlassTagProps {
  /** Tag name/label */
  children: ReactNode;
  /** Tag count (optional) */
  count?: number;
  /** Active/selected state */
  active?: boolean;
  /** Color variant */
  variant?: 'default' | 'cyan' | 'purple' | 'pink' | 'green' | 'amber';
  /** Size */
  size?: 'sm' | 'md' | 'lg';
  /** Click handler */
  onClick?: () => void;
  /** Show remove button */
  removable?: boolean;
  /** Remove handler */
  onRemove?: () => void;
  /** Icon to show before text */
  icon?: ReactNode;
  /** Animation delay for staggered lists */
  delay?: number;
}

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs gap-1',
  md: 'px-2.5 py-1 text-xs gap-1.5',
  lg: 'px-3 py-1.5 text-sm gap-2',
};

const variantStyles = {
  default: {
    bg: 'rgba(255, 255, 255, 0.10)',
    bgActive: 'rgba(255, 255, 255, 0.20)',
    border: 'rgba(255, 255, 255, 0.15)',
    borderActive: 'rgba(255, 255, 255, 0.30)',
    text: 'text-slate-200',
    textActive: 'text-white',
  },
  cyan: {
    bg: 'rgba(6, 182, 212, 0.15)',
    bgActive: 'rgba(6, 182, 212, 0.35)',
    border: 'rgba(6, 182, 212, 0.25)',
    borderActive: 'rgba(6, 182, 212, 0.50)',
    text: 'text-cyan-300',
    textActive: 'text-cyan-200',
  },
  purple: {
    bg: 'rgba(139, 92, 246, 0.15)',
    bgActive: 'rgba(139, 92, 246, 0.35)',
    border: 'rgba(139, 92, 246, 0.25)',
    borderActive: 'rgba(139, 92, 246, 0.50)',
    text: 'text-purple-300',
    textActive: 'text-purple-200',
  },
  pink: {
    bg: 'rgba(236, 72, 153, 0.15)',
    bgActive: 'rgba(236, 72, 153, 0.35)',
    border: 'rgba(236, 72, 153, 0.25)',
    borderActive: 'rgba(236, 72, 153, 0.50)',
    text: 'text-pink-300',
    textActive: 'text-pink-200',
  },
  green: {
    bg: 'rgba(34, 197, 94, 0.15)',
    bgActive: 'rgba(34, 197, 94, 0.35)',
    border: 'rgba(34, 197, 94, 0.25)',
    borderActive: 'rgba(34, 197, 94, 0.50)',
    text: 'text-green-300',
    textActive: 'text-green-200',
  },
  amber: {
    bg: 'rgba(251, 191, 36, 0.15)',
    bgActive: 'rgba(251, 191, 36, 0.35)',
    border: 'rgba(251, 191, 36, 0.25)',
    borderActive: 'rgba(251, 191, 36, 0.50)',
    text: 'text-amber-300',
    textActive: 'text-amber-200',
  },
};

export function GlassTag({
  children,
  count,
  active = false,
  variant = 'cyan',
  size = 'md',
  onClick,
  removable = false,
  onRemove,
  icon,
  delay = 0,
}: GlassTagProps) {
  const style = variantStyles[variant];

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.9, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      whileTap={{ scale: 0.95 }}
      transition={{
        delay: delay * 0.03,
        ...springSnappy,
      }}
      onClick={onClick}
      className={`
        inline-flex items-center rounded-full
        backdrop-blur-glass-xs
        ${sizeClasses[size]}
        ${active ? style.textActive : style.text}
        ${onClick ? 'cursor-pointer hover:brightness-110' : ''}
        focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50
        select-none
        transition-[filter] duration-150
      `}
      style={{
        background: active ? style.bgActive : style.bg,
        border: `1px solid ${active ? style.borderActive : style.border}`,
        boxShadow: active
          ? `0 4px 12px ${style.bg}, inset 0 1px 0 rgba(255,255,255,0.15)`
          : `0 2px 8px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.08)`,
      }}
    >
      {/* Icon */}
      {icon && <span className="flex-shrink-0">{icon}</span>}

      {/* Label */}
      <span className="truncate">{children}</span>

      {/* Count Badge */}
      {count !== undefined && <span className="text-[10px] opacity-70 font-medium">{count}</span>}

      {/* Remove Button */}
      {removable && onRemove && (
        <motion.button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="p-0.5 -mr-1 rounded-full hover:bg-red-500/30 transition-colors"
          whileHover={{ scale: 1.2, rotate: 90 }}
          whileTap={{ scale: 0.9 }}
        >
          <X size={size === 'sm' ? 10 : size === 'md' ? 12 : 14} className="text-red-400" />
        </motion.button>
      )}
    </motion.span>
  );
}
