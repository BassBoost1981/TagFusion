/**
 * GlassButton - Liquid Glass Button Component
 * iOS 26 / WWDC 2025 Design with Press Illumination
 */

import { motion, type HTMLMotionProps } from 'framer-motion';
import { forwardRef, type ReactNode } from 'react';
import { springSnappy } from '../../../styles/animations';

export interface GlassButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children: ReactNode;
  /** Button variant */
  variant?: 'default' | 'accent' | 'danger' | 'ghost';
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
  /** Full width */
  fullWidth?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Icon only (square) */
  iconOnly?: boolean;
}

const sizeClasses = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2.5',
};

const iconOnlySizes = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
};

const variantClasses = {
  default: `
    bg-[var(--glass-bg)]
    hover:bg-[var(--glass-bg-hover)]
    active:bg-[var(--glass-bg-active)]
    border-[var(--glass-border)]
    hover:border-[var(--glass-border-hover)]
    text-slate-100
  `,
  accent: `
    bg-cyan-500/20
    hover:bg-cyan-500/30
    active:bg-cyan-500/40
    border-cyan-500/30
    hover:border-cyan-500/50
    text-cyan-300
  `,
  danger: `
    bg-red-500/20
    hover:bg-red-500/30
    active:bg-red-500/40
    border-red-500/30
    hover:border-red-500/50
    text-red-300
  `,
  ghost: `
    bg-transparent
    hover:bg-[var(--glass-bg)]
    active:bg-[var(--glass-bg-hover)]
    border-transparent
    hover:border-[var(--glass-border)]
    text-slate-300
    hover:text-slate-100
  `,
};

export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
  (
    {
      children,
      className = '',
      variant = 'default',
      size = 'md',
      fullWidth = false,
      disabled = false,
      iconOnly = false,
      ...props
    },
    ref
  ) => {
    return (
      <motion.button
        ref={ref}
        className={`
          relative inline-flex items-center justify-center
          ${iconOnly ? iconOnlySizes[size] : sizeClasses[size]}
          ${fullWidth ? 'w-full' : ''}
          rounded-lg
          backdrop-blur-glass-sm
          border
          font-medium
          transition-all duration-150
          ${variantClasses[variant]}
          ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer'}
          focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900
          hover:brightness-110 hover:shadow-lg
          ${className}
        `}
        initial={{ scale: 1 }}
        whileTap={!disabled ? { scale: 0.97 } : undefined}
        transition={springSnappy}
        disabled={disabled}
        {...props}
      >
        {/* Press illumination overlay */}
        <motion.div
          className="absolute inset-0 rounded-lg bg-white/0 pointer-events-none"
          whileTap={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
          transition={{ duration: 0.1 }}
        />

        {/* Specular highlight */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none rounded-t-lg" />

        {/* Content */}
        <span className="relative z-10 flex items-center gap-inherit">{children}</span>
      </motion.button>
    );
  }
);

GlassButton.displayName = 'GlassButton';
