import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface FloatingActionButtonProps {
  icon: LucideIcon;
  onClick: () => void;
  label?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  color?: 'cyan' | 'purple' | 'pink';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

export function FloatingActionButton({
  icon: Icon,
  onClick,
  label,
  position = 'bottom-right',
  color = 'cyan',
  size = 'md',
  disabled = false,
}: FloatingActionButtonProps) {
  const positionClasses = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'top-right': 'top-6 right-6',
    'top-left': 'top-6 left-6',
  };

  const colorClasses = {
    cyan: 'from-cyan-400 to-cyan-600 shadow-glow-cyan hover:shadow-glow-cyan-lg',
    purple: 'from-purple-400 to-purple-600 shadow-glow-purple hover:shadow-glow-purple',
    pink: 'from-pink-400 to-pink-600 shadow-[0_0_30px_rgba(236,72,153,0.4)]',
  };

  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-14 h-14',
    lg: 'w-16 h-16',
  };

  const iconSizes = {
    sm: 20,
    md: 24,
    lg: 28,
  };

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      className={`
        fixed ${positionClasses[position]} ${sizeClasses[size]}
        rounded-full bg-gradient-to-br ${colorClasses[color]}
        flex items-center justify-center
        transition-all duration-300
        disabled:opacity-50 disabled:cursor-not-allowed
        z-50 group
      `}
      style={{
        transformStyle: 'preserve-3d',
        perspective: '1000px',
        willChange: 'transform',
        backfaceVisibility: 'hidden',
      }}
      whileHover={{
        scale: 1.15,
        y: -8,
        rotateZ: 5,
      }}
      whileTap={{
        scale: 0.95,
        y: 0,
      }}
      animate={{
        y: [0, -5, 0],
      }}
      transition={{
        y: {
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
        },
        scale: {
          type: 'spring',
          stiffness: 400,
          damping: 15,
        },
      }}
    >
      {/* 3D Inner Glow */}
      <div
        className="absolute inset-0 rounded-full opacity-60"
        style={{
          background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4) 0%, transparent 60%)',
          transform: 'translateZ(5px)',
        }}
      />

      {/* Icon with 3D effect */}
      <motion.div
        style={{
          transform: 'translateZ(10px)',
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
        }}
        whileHover={{ rotateZ: 15 }}
      >
        <Icon size={iconSizes[size]} className="text-white" strokeWidth={2.5} />
      </motion.div>

      {/* Ripple effect on click */}
      <motion.div
        className="absolute inset-0 rounded-full bg-white"
        initial={{ scale: 0, opacity: 0.5 }}
        whileTap={{ scale: 2, opacity: 0 }}
        transition={{ duration: 0.5 }}
      />

      {/* Tooltip Label */}
      {label && (
        <motion.div
          initial={{ opacity: 0, x: position.includes('right') ? 10 : -10 }}
          whileHover={{ opacity: 1, x: 0 }}
          className={`
            absolute ${position.includes('right') ? 'right-full mr-3' : 'left-full ml-3'}
            px-3 py-1.5 rounded-lg
            bg-slate-800/90 backdrop-blur-md
            text-white text-sm font-medium whitespace-nowrap
            pointer-events-none
          `}
          style={{
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
        >
          {label}
          {/* Arrow */}
          <div
            className={`
              absolute top-1/2 -translate-y-1/2
              ${position.includes('right') ? 'left-full' : 'right-full'}
              w-0 h-0
              border-t-4 border-t-transparent
              border-b-4 border-b-transparent
              ${position.includes('right') ? 'border-l-4 border-l-slate-900/90' : 'border-r-4 border-r-slate-900/90'}
            `}
          />
        </motion.div>
      )}
    </motion.button>
  );
}
