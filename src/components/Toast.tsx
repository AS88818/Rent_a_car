import { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { subscribe, dismissToast, ToastItem } from '../lib/toast';

const bgColors: Record<string, string> = {
  success: 'bg-green-50',
  error: 'bg-red-50',
  warning: 'bg-yellow-50',
  info: 'bg-cream-100',
};

const borderColors: Record<string, string> = {
  success: 'border-green-300',
  error: 'border-red-300',
  warning: 'border-yellow-300',
  info: 'border-gray-300',
};

const textColors: Record<string, string> = {
  success: 'text-green-900',
  error: 'text-red-900',
  warning: 'text-yellow-900',
  info: 'text-neutral-900',
};

const icons: Record<string, typeof CheckCircle> = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertCircle,
  info: Info,
};

export function Toast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const unsubscribe = subscribe((newToasts) => {
      setToasts(newToasts);
    });
    return unsubscribe;
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2" role="status" aria-live="polite">
      {toasts.map(toast => {
        const Icon = icons[toast.type];
        return (
          <div
            key={toast.id}
            className="animate-in fade-in slide-in-from-bottom-4"
          >
            <div
              className={`${bgColors[toast.type]} ${borderColors[toast.type]} ${textColors[toast.type]} border-2 px-5 py-4 rounded-xl shadow-hover flex items-center gap-3 max-w-md`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-semibold flex-1">{toast.message}</p>
              <button
                onClick={() => dismissToast(toast.id)}
                className="text-inherit hover:opacity-70 transition-all duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
