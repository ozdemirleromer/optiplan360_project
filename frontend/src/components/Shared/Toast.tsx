/**
 * Toast Notification Container Component
 * Sayfanın sağ üst köşesinde render edilir
 */

import React, { useEffect } from 'react';
import { useNotificationStore, Notification } from '../../stores/notificationStore';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

const iconMap = {
  success: <CheckCircle className="w-5 h-5 text-green-500" />,
  error: <AlertCircle className="w-5 h-5 text-red-500" />,
  warning: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
  info: <Info className="w-5 h-5 text-blue-500" />,
};

const bgMap = {
  success: 'bg-green-50 border-green-200',
  error: 'bg-red-50 border-red-200',
  warning: 'bg-yellow-50 border-yellow-200',
  info: 'bg-blue-50 border-blue-200',
};

const textMap = {
  success: 'text-green-800',
  error: 'text-red-800',
  warning: 'text-yellow-800',
  info: 'text-blue-800',
};

export const ToastContainer: React.FC = () => {
  const { notifications, removeNotification } = useNotificationStore();

  return (
    <div className="fixed top-6 right-6 z-50 w-96 max-w-[calc(100vw-2rem)] space-y-3">
      {notifications.map((notification) => (
        <Toast
          key={notification.id}
          notification={notification}
          onClose={() => removeNotification(notification.id)}
        />
      ))}
    </div>
  );
};

interface ToastProps {
  notification: Notification;
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ notification, onClose }) => {
  useEffect(() => {
    if (notification.duration && notification.duration > 0) {
      // Saati zaten store içinde set ettik, bu sadece UI tracking için
    }
  }, [notification]);

  return (
    <div
      className={`
        border rounded-lg p-4 shadow-lg flex items-start gap-3
        transform transition-all duration-300 animate-in fade-in slide-in-from-right-4
        ${bgMap[notification.type]}
      `}
      role="alert"
    >
      <div className="flex-shrink-0 mt-0.5">
        {iconMap[notification.type]}
      </div>

      <div className="flex-1 min-w-0">
        <p className={`font-medium text-sm ${textMap[notification.type]}`}>
          {notification.message}
        </p>
        {notification.description && (
          <p className={`text-xs mt-1 opacity-75 ${textMap[notification.type]}`}>
            {notification.description}
          </p>
        )}
        {notification.action && (
          <button
            onClick={() => {
              notification.action.onClick();
              onClose();
            }}
            className={`text-xs font-semibold mt-2 underline hover:no-underline ${textMap[notification.type]}`}
          >
            {notification.action.label}
          </button>
        )}
      </div>

      <button
        onClick={onClose}
        className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Bildirimi kapat"
        style={{ minWidth: 44, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
