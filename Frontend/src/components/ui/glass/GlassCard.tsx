/**
 * GlassCard - Liquid Glass Container Component
 * iOS 26 / WWDC 2025 Design
 */

import { motion, type HTMLMotionProps } from 'framer-motion';
import { forwardRef, type ReactNode } from 'react';
import { glassCardVariants, springGentle } from '../../../styles/animations';

export interface GlassCardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: ReactNode;
  /** Blur intensity */
  blur?: 'sm' | 'md' | 'lg' | 'xl';
  /** Enable hover animation */
  hover?: boolean;
  /** Enable glow effect on hover */
  glow?: boolean;
  /** Glow color */
  glowColor?: 'cyan' | 'purple' | 'pink';
  /** Padding size */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Border radius */
  rounded?: 'md' | 'lg' | 'xl' | '2xl';
}

const blurClasses = {
  sm: 'backdrop-blur-glass-sm',
  md: 'backdrop-blur-glass-md',
  lg: 'backdrop-blur-glass-lg',
  xl: 'backdrop-blur-glass-xl',
};

const paddingClasses = {
  none: 'p-0',
  sm: 'p-2',
  md: 'p-4',
  lg: 'p-6',
};

const roundedClasses = {
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
};

const glowColors = {
  cyan: 'hover:shadow-[0_8px_32px_rgba(6,182,212,0.2),0_0_0_1px_rgba(6,182,212,0.15)]',
  purple: 'hover:shadow-[0_8px_32px_rgba(139,92,246,0.2),0_0_0_1px_rgba(139,92,246,0.15)]',
  pink: 'hover:shadow-[0_8px_32px_rgba(236,72,153,0.2),0_0_0_1px_rgba(236,72,153,0.15)]',
};

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  (
    {
      children,
      className = '',
      blur = 'md',
      hover = true,
      glow = false,
      glowColor = 'cyan',
      padding = 'md',
      rounded = 'xl',
      ...props
    },
    ref
  ) => {
    return (
      <motion.div
        ref={ref}
        className={`
          ${blurClasses[blur]}
          ${paddingClasses[padding]}
          ${roundedClasses[rounded]}
          bg-[var(--glass-bg)]
          border border-[var(--glass-border)]
          shadow-glass
          transition-colors duration-200
          ${glow ? glowColors[glowColor] : ''}
          ${className}
        `}
        variants={hover ? glassCardVariants : undefined}
        initial="initial"
        whileHover={hover ? 'hover' : undefined}
        whileTap={hover ? 'tap' : undefined}
        transition={springGentle}
        {...props}
      >
        {/* Specular highlight - top edge */}
        <div
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--glass-specular)] to-transparent opacity-50 pointer-events-none"
          style={{ borderRadius: 'inherit' }}
        />

        {/* Content */}
        <div className="relative z-10">{children}</div>
      </motion.div>
    );
  }
);

GlassCard.displayName = 'GlassCard';
