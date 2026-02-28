/**
 * GlassIconButton - Liquid Glass Icon-Only Button
 * iOS 26 / WWDC 2025 Design
 */

import { motion, type HTMLMotionProps } from 'framer-motion';
import { forwardRef, type ReactNode } from 'react';
import { springSnappy } from '../../../styles/animations';

export interface GlassIconButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children: ReactNode;
  /** Button size */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** Button variant */
  variant?: 'default' | 'accent' | 'danger' | 'ghost';
  /** Disabled state */
  disabled?: boolean;
  /** Tooltip text */
  title?: string;
  /** Active/selected state */
  active?: boolean;
}

const sizeClasses = {
  xs: 'h-6 w-6 text-xs',
  sm: 'h-8 w-8 text-sm',
  md: 'h-9 w-9 text-base',
  lg: 'h-11 w-11 text-lg',
};

const variantClasses = {
  default: `
    bg-[var(--glass-bg)]
    hover:bg-[var(--glass-bg-hover)]
    active:bg-[var(--glass-bg-active)]
    border-[var(--glass-border)]
    hover:border-[var(--glass-border-hover)]
    text-slate-300
    hover:text-slate-100
  `,
  accent: `
    bg-cyan-500/15
    hover:bg-cyan-500/25
    active:bg-cyan-500/35
    border-cyan-500/25
    hover:border-cyan-500/40
    text-cyan-400
    hover:text-cyan-300
  `,
  danger: `
    bg-red-500/15
    hover:bg-red-500/25
    active:bg-red-500/35
    border-red-500/25
    hover:border-red-500/40
    text-red-400
    hover:text-red-300
  `,
  ghost: `
    bg-transparent
    hover:bg-[var(--glass-bg)]
    active:bg-[var(--glass-bg-hover)]
    border-transparent
    hover:border-[var(--glass-border)]
    text-slate-400
    hover:text-slate-200
  `,
};

const activeClasses = {
  default: 'bg-[var(--glass-bg-active)] border-[var(--glass-border-hover)] text-slate-100',
  accent: 'bg-cyan-500/30 border-cyan-500/50 text-cyan-300',
  danger: 'bg-red-500/30 border-red-500/50 text-red-300',
  ghost: 'bg-[var(--glass-bg-hover)] border-[var(--glass-border)] text-slate-100',
};

export const GlassIconButton = forwardRef<HTMLButtonElement, GlassIconButtonProps>(
  (
    { children, className = '', size = 'md', variant = 'default', disabled = false, active = false, title, ...props },
    ref
  ) => {
    return (
      <motion.button
        ref={ref}
        className={`
          relative inline-flex items-center justify-center
          ${sizeClasses[size]}
          rounded-lg
          backdrop-blur-glass-xs
          border
          transition-all duration-150
          ${active ? activeClasses[variant] : variantClasses[variant]}
          ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer'}
          focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900
          hover:brightness-110 hover:shadow-md
          ${className}
        `}
        initial={{ scale: 1 }}
        whileTap={!disabled ? { scale: 0.95 } : undefined}
        transition={springSnappy}
        disabled={disabled}
        title={title}
        {...props}
      >
        {/* Press illumination */}
        <motion.div
          className="absolute inset-0 rounded-lg bg-white/0 pointer-events-none"
          whileTap={{ backgroundColor: 'rgba(255, 255, 255, 0.15)' }}
          transition={{ duration: 0.08 }}
        />

        {/* Icon */}
        <span className="relative z-10 flex items-center justify-center">{children}</span>
      </motion.button>
    );
  }
);

GlassIconButton.displayName = 'GlassIconButton';
