import { create } from 'zustand';
import { TOAST_DURATION_DEFAULT, TOAST_DURATION_ERROR, TOAST_DURATION_WARNING } from '../constants/ui';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
  addToast: (type: ToastType, message: string, duration?: number) => void;
  removeToast: (id: string) => void;
  // Convenience methods
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (type, message, duration = TOAST_DURATION_DEFAULT) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    set((state) => ({
      toasts: [...state.toasts, { id, type, message, duration }],
    }));

    // Auto-remove after duration
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, duration);
    }
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  // Convenience methods
  success: (message) => {
    const { addToast } = useToastStore.getState();
    addToast('success', message);
  },

  error: (message) => {
    const { addToast } = useToastStore.getState();
    addToast('error', message, TOAST_DURATION_ERROR);
  },

  info: (message) => {
    const { addToast } = useToastStore.getState();
    addToast('info', message);
  },

  warning: (message) => {
    const { addToast } = useToastStore.getState();
    addToast('warning', message, TOAST_DURATION_WARNING);
  },
}));
