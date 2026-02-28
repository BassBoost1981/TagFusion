/**
 * GlassTooltip - Liquid Glass Tooltip
 * iOS 26 / WWDC 2025 Design
 *
 * Simple tooltip wrapper using native title attribute with glass styling
 */

import { motion } from 'framer-motion';
import { type ReactNode, useState, cloneElement, isValidElement } from 'react';
import { springSnappy } from '../../../styles/animations';

export interface GlassTooltipProps {
  /** Tooltip content */
  content: string;
  /** Trigger element */
  children: ReactNode;
  /** Tooltip placement */
  side?: 'top' | 'bottom' | 'left' | 'right';
  /** Delay before showing (ms) */
  delay?: number;
  /** Disabled state */
  disabled?: boolean;
}

const positionClasses = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

export function GlassTooltip({ content, children, side = 'top', delay = 300, disabled = false }: GlassTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [timeoutId, setTimeoutId] = useState<ReturnType<typeof setTimeout> | null>(null);

  if (disabled) {
    return <>{children}</>;
  }

  const handleMouseEnter = () => {
    const id = setTimeout(() => setIsVisible(true), delay);
    setTimeoutId(id);
  };

  const handleMouseLeave = () => {
    if (timeoutId) clearTimeout(timeoutId);
    setIsVisible(false);
  };

  // Clone child element and add event handlers
  const trigger = isValidElement(children)
    ? cloneElement(children as React.ReactElement<React.HTMLAttributes<HTMLElement>>, {
        onMouseEnter: handleMouseEnter,
        onMouseLeave: handleMouseLeave,
      })
    : children;

  return (
    <div className="relative inline-flex">
      {trigger}
      {isVisible && (
        <motion.div
          className={`
            absolute z-[100] px-3 py-1.5 rounded-lg whitespace-nowrap
            backdrop-blur-glass-md bg-slate-800/90
            border border-[var(--glass-border)]
            shadow-glass-sm text-sm text-slate-200
            pointer-events-none
            ${positionClasses[side]}
          `}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={springSnappy}
        >
          {content}
        </motion.div>
      )}
    </div>
  );
}
