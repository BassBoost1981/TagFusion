import { Button as BaseButton } from '@base-ui-components/react/button';
import { Spinner } from '@heroui/react';
import type { ReactNode } from 'react';

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  icon?: ReactNode;
  isLoading?: boolean;
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  onClick?: () => void;
}

export function Button({
  variant = 'primary',
  size = 'md',
  children,
  icon,
  isLoading,
  className = '',
  disabled,
  type = 'button',
  onClick,
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 active:scale-[0.98] hover:shadow-lg hover:brightness-110';

  const variants = {
    primary: 'gradient-primary text-white hover:opacity-95 focus-visible:ring-indigo-500 glow-primary',
    secondary: 'glass text-slate-100 hover:bg-white/10 focus-visible:ring-slate-500',
    ghost: 'text-slate-300 hover:text-white hover:bg-white/5 focus-visible:ring-slate-500',
    danger: 'bg-red-500/20 text-red-400 hover:bg-red-500/30 focus-visible:ring-red-500',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2',
  };

  return (
    <BaseButton
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${disabled || isLoading ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      disabled={disabled || isLoading}
      type={type}
      onClick={onClick}
    >
      {isLoading ? (
        <Spinner size="sm" color="current" />
      ) : icon}
      {children}
    </BaseButton>
  );
}

