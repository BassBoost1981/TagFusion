import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md';
  removable?: boolean;
  onRemove?: () => void;
}

export function Badge({ children, variant = 'default', size = 'md', removable, onRemove }: BadgeProps) {
  const variants = {
    default: 'bg-slate-700/50 text-slate-300',
    primary: 'bg-indigo-500/20 text-indigo-300',
    success: 'bg-emerald-500/20 text-emerald-300',
    warning: 'bg-amber-500/20 text-amber-300',
    danger: 'bg-red-500/20 text-red-300',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
  };

  return (
    <motion.span
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      className={`
        inline-flex items-center gap-1 rounded-full font-medium
        ${variants[variant]} ${sizes[size]}
      `}
    >
      {children}
      {removable && (
        <button onClick={onRemove} className="ml-0.5 hover:bg-white/10 rounded-full p-0.5 transition-colors">
          <X size={size === 'sm' ? 12 : 14} />
        </button>
      )}
    </motion.span>
  );
}
