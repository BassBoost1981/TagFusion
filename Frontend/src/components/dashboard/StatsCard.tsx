import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: string;
  trendUp?: boolean;
  delay?: number;
}

export function StatsCard({ title, value, icon, trend, trendUp, delay = 0 }: StatsCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, y: -2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25, delay }}
      className="p-4 rounded-xl relative overflow-hidden group backdrop-blur-glass-sm"
      style={{
        background: 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
      }}
    >
      {/* Glass Specular Highlight */}
      <div
        className="absolute inset-x-0 top-0 h-[1px]"
        style={{ background: 'var(--glass-specular)' }}
      />

      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-500">
        {icon}
      </div>

      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-[var(--color-cyan-subtle)] text-cyan-400">
            {icon}
          </div>
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">{title}</h3>
        </div>

        <div className="flex items-end gap-3">
          <span className="text-2xl font-bold text-[var(--color-text-primary)]">{value}</span>
          {trend && (
            <span className={`text-xs font-medium mb-1 ${trendUp ? 'text-emerald-400' : 'text-red-400'}`}>
              {trend}
            </span>
          )}
        </div>
      </div>

      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    </motion.div>
  );
}