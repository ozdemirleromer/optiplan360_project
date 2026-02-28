/**
 * Notification Store (Zustand)
 * Toast bildirimleri merkezi yönetimi
 * @example
 *   useNotificationStore.getState().addNotification({
 *     type: 'success',
 *     message: 'Sipariş kaydedildi!',
 *     duration: 3000
 *   })
 */

import { create } from 'zustand';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  duration?: number; // ms, 0 = infinite
}

interface NotificationState {
  notifications: Notification[];
  addNotification: (notif: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],

  addNotification: (notif) => {
    const id = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    set((state) => ({
      notifications: [...state.notifications, { ...notif, id }],
    }));

    // Auto-remove after duration
    if (notif.duration) {
      setTimeout(() => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        }));
      }, notif.duration);
    }
  },

  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },

  clearAll: () => {
    set({ notifications: [] });
  },
}));

// Convenience helpers
export const notificationHelpers = {
  success: (message: string, description?: string) =>
    useNotificationStore.getState().addNotification({
      type: 'success',
      message,
      description,
      duration: 3000,
    }),

  error: (message: string, description?: string) =>
    useNotificationStore.getState().addNotification({
      type: 'error',
      message,
      description,
      duration: 5000,
    }),

  warning: (message: string, description?: string) =>
    useNotificationStore.getState().addNotification({
      type: 'warning',
      message,
      description,
      duration: 4000,
    }),

  info: (message: string, description?: string) =>
    useNotificationStore.getState().addNotification({
      type: 'info',
      message,
      description,
      duration: 3000,
    }),

  loading: (message: string) =>
    useNotificationStore.getState().addNotification({
      type: 'info',
      message,
      duration: 0, // Infinite until manual removal
    }),
};
