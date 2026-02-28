import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  variant?: 'default' | 'elevated' | 'interactive';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
}

export function Card({ children, variant = 'default', padding = 'md', className = '', onClick }: CardProps) {
  const baseStyles = 'rounded-xl';

  const variantStyles = {
    default: 'glass',
    elevated: 'glass shadow-xl shadow-black/20',
    interactive: 'glass glass-hover cursor-pointer',
  };

  const paddings = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  };

  if (variant === 'interactive') {
    return (
      <motion.div
        whileHover={{ scale: 1.01, y: -2 }}
        whileTap={{ scale: 0.99 }}
        className={`${baseStyles} ${variantStyles[variant]} ${paddings[padding]} ${className}`}
        onClick={onClick}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div className={`${baseStyles} ${variantStyles[variant]} ${paddings[padding]} ${className}`} onClick={onClick}>
      {children}
    </div>
  );
}
