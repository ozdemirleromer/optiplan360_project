import React, { useState, useCallback } from 'react';
import { CheckCircle, AlertCircle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

// Simple toast hook
export const useToast = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Date.now().toString();
    const newToast: Toast = { id, message, type };
    
    setToasts(prev => [...prev, newToast]);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const ToastContainer = () => (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border min-w-[300px] animate-in slide-in-from-right ${
            toast.type === 'success' ? 'bg-emerald-900/90 border-emerald-500/50 text-emerald-100' :
            toast.type === 'error' ? 'bg-red-900/90 border-red-500/50 text-red-100' :
            'bg-amber-900/90 border-amber-500/50 text-amber-100'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle size={20} className="text-emerald-400" /> :
           toast.type === 'error' ? <AlertCircle size={20} className="text-red-400" /> :
           <AlertCircle size={20} className="text-amber-400" />}
          <span className="flex-1 text-sm">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="p-1 hover:bg-white/10 rounded transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );

  return { showToast, ToastContainer };
};
