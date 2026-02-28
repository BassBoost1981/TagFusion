import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useToastStore, type Toast, type ToastType } from '../../stores/toastStore';

const iconMap: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="w-5 h-5" />,
  error: <XCircle className="w-5 h-5" />,
  info: <Info className="w-5 h-5" />,
  warning: <AlertTriangle className="w-5 h-5" />,
};

const colorMap: Record<ToastType, { bg: string; border: string; icon: string; glow: string }> = {
  success: {
    bg: 'from-emerald-500/20 to-emerald-500/5',
    border: 'border-emerald-500/30',
    icon: 'text-emerald-400',
    glow: 'shadow-emerald-500/20',
  },
  error: {
    bg: 'from-red-500/20 to-red-500/5',
    border: 'border-red-500/30',
    icon: 'text-red-400',
    glow: 'shadow-red-500/20',
  },
  info: {
    bg: 'from-cyan-500/20 to-cyan-500/5',
    border: 'border-cyan-500/30',
    icon: 'text-cyan-400',
    glow: 'shadow-cyan-500/20',
  },
  warning: {
    bg: 'from-amber-500/20 to-amber-500/5',
    border: 'border-amber-500/30',
    icon: 'text-amber-400',
    glow: 'shadow-amber-500/20',
  },
};

function ToastItem({ toast }: { toast: Toast }) {
  const { removeToast } = useToastStore();
  const colors = colorMap[toast.type];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={`
        relative flex items-center gap-3 px-4 py-3 rounded-xl
        backdrop-blur-xl bg-gradient-to-r ${colors.bg}
        border ${colors.border}
        shadow-lg ${colors.glow}
        min-w-[280px] max-w-[400px]
      `}
    >
      {/* Icon */}
      <div className={colors.icon}>{iconMap[toast.type]}</div>

      {/* Message */}
      <p className="flex-1 text-sm text-slate-100 font-medium">{toast.message}</p>

      {/* Close button */}
      <motion.button
        onClick={() => removeToast(toast.id)}
        className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-colors"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        <X className="w-4 h-4" />
      </motion.button>

      {/* Progress bar */}
      {toast.duration && toast.duration > 0 && (
        <motion.div
          className={`absolute bottom-0 left-0 h-0.5 rounded-b-xl ${colors.icon.replace('text-', 'bg-')}`}
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: toast.duration / 1000, ease: 'linear' }}
        />
      )}

      {/* Specular highlight */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-t-xl pointer-events-none" />
    </motion.div>
  );
}

export function ToastContainer() {
  const { toasts } = useToastStore();

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </AnimatePresence>
    </div>
  );
}
