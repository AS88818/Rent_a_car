type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

let listeners: ((toast: Toast | null) => void)[] = [];
let currentToast: Toast | null = null;

export function subscribe(callback: (toast: Toast | null) => void) {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter(l => l !== callback);
  };
}

export function showToast(message: string, type: ToastType = 'info', duration = 3000) {
  const id = Math.random().toString(36).substr(2, 9);
  currentToast = { id, message, type, duration };

  listeners.forEach(listener => listener(currentToast));

  if (duration > 0) {
    setTimeout(() => {
      currentToast = null;
      listeners.forEach(listener => listener(null));
    }, duration);
  }
}

export function hideToast() {
  currentToast = null;
  listeners.forEach(listener => listener(null));
}
