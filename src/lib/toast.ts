type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

let listeners: ((toasts: ToastItem[]) => void)[] = [];
let activeToasts: ToastItem[] = [];

const MAX_TOASTS = 5;

function notify() {
  listeners.forEach(listener => listener([...activeToasts]));
}

export function subscribe(callback: (toasts: ToastItem[]) => void) {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter(l => l !== callback);
  };
}

export function showToast(message: string, type: ToastType = 'info', duration = 3000) {
  const id = Math.random().toString(36).substr(2, 9);
  const toast: ToastItem = { id, message, type, duration };

  activeToasts = [...activeToasts, toast].slice(-MAX_TOASTS);
  notify();

  if (duration > 0) {
    setTimeout(() => {
      dismissToast(id);
    }, duration);
  }
}

export function dismissToast(id: string) {
  activeToasts = activeToasts.filter(t => t.id !== id);
  notify();
}

export function hideToast() {
  activeToasts = [];
  notify();
}
