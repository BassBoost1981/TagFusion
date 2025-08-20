import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

interface ToastProps {
  title: string;
  message?: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  onClose?: () => void;
}

const Toast: React.FC<ToastProps> = ({
  title,
  message,
  type = 'info',
  duration = 5000,
  onClose
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onClose?.(), 300); // Wait for animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const handleClick = () => {
    setIsVisible(false);
    setTimeout(() => onClose?.(), 300);
  };

  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };

  return (
    <div 
      className={`modern-toast ${type} ${isVisible ? 'visible' : 'hidden'}`}
      onClick={handleClick}
      style={{
        transform: isVisible ? 'translateX(0)' : 'translateX(100%)',
        opacity: isVisible ? 1 : 0,
        transition: 'all 0.3s ease-out'
      }}
    >
      <div className="toast-content">
        <div className="toast-header">
          <span className="toast-icon">{icons[type]}</span>
          <span className="toast-title">{title}</span>
        </div>
        {message && (
          <div className="toast-message">{message}</div>
        )}
      </div>
    </div>
  );
};

// Toast Manager for showing toasts from anywhere
class ToastManager {
  private container: HTMLElement | null = null;
  private toasts: Map<string, any> = new Map();

  private ensureContainer() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'toast-container';
      this.container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        pointer-events: none;
      `;
      document.body.appendChild(this.container);
    }
  }

  show(props: ToastProps) {
    this.ensureContainer();
    
    const toastId = Date.now().toString();
    const toastElement = document.createElement('div');
    toastElement.style.pointerEvents = 'auto';
    toastElement.style.marginBottom = '8px';
    
    this.container!.appendChild(toastElement);
    
    const root = createRoot(toastElement);
    const toastProps = {
      ...props,
      onClose: () => {
        root.unmount();
        if (this.container!.contains(toastElement)) {
          this.container!.removeChild(toastElement);
        }
        this.toasts.delete(toastId);
      }
    };
    
    root.render(<Toast {...toastProps} />);
    this.toasts.set(toastId, root);
    
    return toastId;
  }

  success(title: string, message?: string, duration?: number) {
    return this.show({ title, message, type: 'success', duration });
  }

  error(title: string, message?: string, duration?: number) {
    return this.show({ title, message, type: 'error', duration });
  }

  warning(title: string, message?: string, duration?: number) {
    return this.show({ title, message, type: 'warning', duration });
  }

  info(title: string, message?: string, duration?: number) {
    return this.show({ title, message, type: 'info', duration });
  }

  clear() {
    this.toasts.forEach(root => root.unmount());
    this.toasts.clear();
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}

// Global toast instance
export const toast = new ToastManager();

export default Toast;
