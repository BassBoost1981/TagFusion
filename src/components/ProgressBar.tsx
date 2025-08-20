import React from 'react';

interface ProgressBarProps {
  value: number; // 0-100
  max?: number;
  showPercentage?: boolean;
  showText?: boolean;
  text?: string;
  className?: string;
  size?: 'small' | 'medium' | 'large';
  variant?: 'default' | 'success' | 'warning' | 'error';
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  showPercentage = false,
  showText = false,
  text,
  className = '',
  size = 'medium',
  variant = 'default'
}) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  
  const sizeClasses = {
    small: 'h-2',
    medium: 'h-3',
    large: 'h-4'
  };
  
  const variantClasses = {
    default: 'bg-blue-500',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500'
  };

  return (
    <div className={`modern-progress-container ${className}`}>
      <div className={`modern-progress-bar ${sizeClasses[size]}`}>
        <div 
          className={`progress-fill ${variantClasses[variant]}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      
      {(showPercentage || showText || text) && (
        <div className="progress-text">
          {text || (showText && `${Math.round(percentage)}%`) || (showPercentage && `${Math.round(percentage)}%`)}
        </div>
      )}
    </div>
  );
};

export default ProgressBar;
