/**
 * GlassDropdown - Liquid Glass Select/Dropdown
 * iOS 26 / WWDC 2025 Design
 */

import { Menu } from '@base-ui-components/react/menu';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { type ReactNode } from 'react';
import { fadeInScale } from '../../../styles/animations';

export interface GlassDropdownOption {
  value: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface GlassDropdownProps {
  /** Current value */
  value: string;
  /** Options list */
  options: GlassDropdownOption[];
  /** Change handler */
  onChange: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Size */
  size?: 'sm' | 'md' | 'lg';
  /** Full width */
  fullWidth?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Left icon */
  icon?: ReactNode;
}

const sizeClasses = {
  sm: 'h-8 text-sm px-3',
  md: 'h-10 text-sm px-4',
  lg: 'h-12 text-base px-5',
};

export function GlassDropdown({
  value,
  options,
  onChange,
  placeholder = 'Select...',
  size = 'md',
  fullWidth = false,
  disabled = false,
  icon,
}: GlassDropdownProps) {
  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <Menu.Root>
      <Menu.Trigger
        className={`
          inline-flex items-center justify-between gap-2
          ${sizeClasses[size]}
          ${fullWidth ? 'w-full' : 'min-w-[140px]'}
          rounded-lg
          backdrop-blur-glass-sm
          bg-[var(--glass-bg)]
          hover:bg-[var(--glass-bg-hover)]
          border border-[var(--glass-border)]
          hover:border-[var(--glass-border-hover)]
          text-slate-100
          transition-colors duration-150
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        disabled={disabled}
      >
        <span className="flex items-center gap-2 truncate">
          {icon && <span className="text-slate-400">{icon}</span>}
          {selectedOption?.icon}
          <span className={!selectedOption ? 'text-slate-500' : ''}>
            {selectedOption?.label || placeholder}
          </span>
        </span>
        <ChevronDown size={16} className="text-slate-400 flex-shrink-0" />
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Positioner sideOffset={4}>
          <AnimatePresence>
            <Menu.Popup
              className="z-50 min-w-[140px] p-1 rounded-xl backdrop-blur-glass-lg bg-[var(--glass-bg)] border border-[var(--glass-border)] shadow-glass-lg overflow-hidden"
            >
              <motion.div
                variants={fadeInScale}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                {options.map((option) => (
                  <Menu.Item
                    key={option.value}
                    onClick={() => !option.disabled && onChange(option.value)}
                    className={`
                      flex items-center gap-2 px-3 py-2 rounded-lg
                      text-sm cursor-pointer
                      transition-colors duration-100
                      ${option.disabled 
                        ? 'opacity-50 cursor-not-allowed text-slate-500' 
                        : option.value === value
                          ? 'bg-cyan-500/20 text-cyan-300'
                          : 'text-slate-200 hover:bg-[var(--glass-bg-hover)]'
                      }
                    `}
                  >
                    {option.icon}
                    {option.label}
                  </Menu.Item>
                ))}
              </motion.div>
            </Menu.Popup>
          </AnimatePresence>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

