import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface GlassPanelProps {
  children: ReactNode;
  className?: string;
  depth?: 'near' | 'mid' | 'far';
  glow?: boolean;
  glowColor?: 'cyan' | 'purple' | 'pink';
  hover3d?: boolean;
}

export function GlassPanel({
  children,
  className = '',
  depth = 'mid',
  glow = false,
  glowColor = 'cyan',
  hover3d = false,
}: GlassPanelProps) {
  const depthShadows = {
    near: 'shadow-depth-near',
    mid: 'shadow-depth-mid',
    far: 'shadow-depth-far',
  };

  const glowClasses = {
    cyan: 'hover:shadow-glow-cyan',
    purple: 'hover:shadow-glow-purple',
    pink: 'hover:shadow-[0_0_40px_rgba(236,72,153,0.5)]',
  };

  return (
    <motion.div
      className={`
        rounded-xl p-4 backdrop-blur-md
        bg-gradient-to-br from-slate-900/60 to-slate-800/70
        border border-white/10
        ${depthShadows[depth]}
        ${glow ? glowClasses[glowColor] : ''}
        ${className}
        gpu-accelerated
      `}
      style={{
        transformStyle: 'preserve-3d',
        boxShadow: `
          0 ${depth === 'near' ? '8' : depth === 'mid' ? '4' : '2'}px ${depth === 'near' ? '32' : depth === 'mid' ? '16' : '8'}px rgba(0,0,0,${depth === 'near' ? '0.3' : depth === 'mid' ? '0.2' : '0.1'}),
          inset 0 1px 0 rgba(255,255,255,0.1)
        `,
      }}
      whileHover={
        hover3d
          ? {
              scale: 1.02,
              y: -4,
              rotateX: 2,
              rotateY: -2,
            }
          : undefined
      }
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 20,
      }}
    >
      {/* 3D Inner Glow Layer */}
      {glow && (
        <div
          className="absolute inset-0 rounded-xl opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          style={{
            background: `radial-gradient(circle at 50% 0%, ${
              glowColor === 'cyan'
                ? 'rgba(6,182,212,0.15)'
                : glowColor === 'purple'
                  ? 'rgba(139,92,246,0.15)'
                  : 'rgba(236,72,153,0.15)'
            } 0%, transparent 70%)`,
            transform: 'translateZ(-5px)',
          }}
        />
      )}

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}
