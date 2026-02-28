/**
 * GlassInput - Liquid Glass Input Field
 * iOS 26 / WWDC 2025 Design
 */

import { motion } from 'framer-motion';
import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { springSnappy } from '../../../styles/animations';

export interface GlassInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Input size */
  size?: 'sm' | 'md' | 'lg';
  /** Left icon/element */
  leftIcon?: ReactNode;
  /** Right icon/element */
  rightIcon?: ReactNode;
  /** Error state */
  error?: boolean;
  /** Full width */
  fullWidth?: boolean;
}

const sizeClasses = {
  sm: 'h-8 text-sm px-3',
  md: 'h-10 text-sm px-4',
  lg: 'h-12 text-base px-5',
};

const iconPadding = {
  sm: { left: 'pl-8', right: 'pr-8' },
  md: { left: 'pl-10', right: 'pr-10' },
  lg: { left: 'pl-12', right: 'pr-12' },
};

const iconPosition = {
  sm: 'w-8',
  md: 'w-10',
  lg: 'w-12',
};

export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(
  ({ className = '', size = 'md', leftIcon, rightIcon, error = false, fullWidth = false, disabled, ...props }, ref) => {
    return (
      <motion.div
        className={`relative ${fullWidth ? 'w-full' : 'inline-flex'}`}
        initial={{ scale: 1 }}
        whileFocus={{ scale: 1.01 }}
        transition={springSnappy}
      >
        {/* Left Icon */}
        {leftIcon && (
          <div
            className={`
              absolute left-0 top-0 bottom-0 ${iconPosition[size]}
              flex items-center justify-center
              text-slate-400 pointer-events-none
            `}
          >
            {leftIcon}
          </div>
        )}

        {/* Input */}
        <input
          ref={ref}
          className={`
            w-full
            ${sizeClasses[size]}
            ${leftIcon ? iconPadding[size].left : ''}
            ${rightIcon ? iconPadding[size].right : ''}
            rounded-lg
            backdrop-blur-glass-sm
            bg-[var(--glass-bg)]
            border
            ${
              error
                ? 'border-red-500/50 focus-visible:border-red-500/70 focus-visible:ring-red-500/20'
                : 'border-[var(--glass-border)] focus-visible:border-cyan-500/50 focus-visible:ring-cyan-500/20'
            }
            text-slate-100
            placeholder:text-slate-500
            outline-none
            focus-visible:ring-2
            transition-all duration-150
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            ${className}
          `}
          disabled={disabled}
          {...props}
        />

        {/* Right Icon */}
        {rightIcon && (
          <div
            className={`
              absolute right-0 top-0 bottom-0 ${iconPosition[size]}
              flex items-center justify-center
              text-slate-400
            `}
          >
            {rightIcon}
          </div>
        )}

        {/* Focus glow effect */}
        <div
          className={`
            absolute inset-0 rounded-lg pointer-events-none
            opacity-0 focus-within:opacity-100
            transition-opacity duration-200
            ${error ? 'shadow-[0_0_0_2px_rgba(239,68,68,0.15)]' : 'shadow-[0_0_0_2px_rgba(6,182,212,0.15)]'}
          `}
        />
      </motion.div>
    );
  }
);

GlassInput.displayName = 'GlassInput';
