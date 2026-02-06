import { Input as BaseInput } from '@base-ui-components/react/input';
import type { ReactNode, InputHTMLAttributes } from 'react';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  icon?: ReactNode;
  error?: string;
  className?: string;
}

export function Input({
  icon,
  error,
  className = '',
  ...props
}: InputProps) {
  return (
    <div className="relative">
      {icon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
          {icon}
        </div>
      )}
      <BaseInput
        className={`
          w-full px-4 py-2 rounded-lg
          bg-white/5 border border-white/10
          text-slate-100 placeholder-slate-500
          focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
          transition-colors duration-200
          ${icon ? 'pl-10' : ''}
          ${error ? 'border-red-500' : ''}
          ${className}
        `}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-red-400">{error}</p>
      )}
    </div>
  );
}

