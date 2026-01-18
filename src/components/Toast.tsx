import { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { subscribe } from '../lib/toast';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

export function Toast() {
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    const unsubscribe = subscribe((newToast) => {
      setToast(newToast as Toast | null);
    });

    return unsubscribe;
  }, []);

  if (!toast) return null;

  const bgColor = {
    success: 'bg-green-50',
    error: 'bg-red-50',
    warning: 'bg-yellow-50',
    info: 'bg-cream-100',
  }[toast.type];

  const borderColor = {
    success: 'border-green-300',
    error: 'border-red-300',
    warning: 'border-yellow-300',
    info: 'border-gray-300',
  }[toast.type];

  const textColor = {
    success: 'text-green-900',
    error: 'text-red-900',
    warning: 'text-yellow-900',
    info: 'text-neutral-900',
  }[toast.type];

  const Icon = {
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertCircle,
    info: Info,
  }[toast.type];

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-4">
      <div
        className={`${bgColor} ${borderColor} ${textColor} border-2 px-5 py-4 rounded-xl shadow-hover flex items-center gap-3 max-w-md`}
      >
        <Icon className="w-5 h-5 flex-shrink-0" />
        <p className="text-sm font-semibold flex-1">{toast.message}</p>
        <button
          onClick={() => setToast(null)}
          className="text-inherit hover:opacity-70 transition-all duration-200"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
