import React, { useEffect } from 'react';
import { CheckCircle, AlertTriangle, X, AlertCircle } from 'lucide-react';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'warning';
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const getToastConfig = () => {
    switch (type) {
      case 'success':
        return {
          bgColor: 'bg-emerald-900',
          borderColor: 'border-emerald-700',
          textColor: 'text-emerald-100',
          icon: <CheckCircle className="w-5 h-5 text-emerald-300" />
        };
      
      case 'error':
        return {
          bgColor: 'bg-red-900',
          borderColor: 'border-red-700',
          textColor: 'text-red-100',
          icon: <AlertCircle className="w-5 h-5 text-red-300" />
        };
      
      case 'warning':
        return {
          bgColor: 'bg-amber-900',
          borderColor: 'border-amber-700',
          textColor: 'text-amber-100',
          icon: <AlertTriangle className="w-5 h-5 text-amber-300" />
        };
      
      default:
        return {
          bgColor: 'bg-slate-800',
          borderColor: 'border-slate-600',
          textColor: 'text-slate-200',
          icon: null
        };
    }
  };

  const config = getToastConfig();

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-in">
      <div className={`${config.bgColor} ${config.borderColor} border rounded-lg shadow-lg p-4 flex items-center space-x-3 min-w-[300px] max-w-md`}>
        {/* Icon */}
        {config.icon}
        
        {/* Message */}
        <p className={`flex-1 text-sm font-medium ${config.textColor}`}>
          {message}
        </p>
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className={`p-1 rounded ${config.textColor} hover:bg-black hover:bg-opacity-20 transition-colors`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
