/**
 * WebSocket Notification Service
 * Real-time notifications for order status, station alerts, etc.
 */

export const NOTIFICATION_TYPES = {
  ORDER_CREATED: 'ORDER_CREATED',
  ORDER_STATUS_CHANGED: 'ORDER_STATUS_CHANGED',
  STATION_OFFLINE: 'STATION_OFFLINE',
  STATION_ONLINE: 'STATION_ONLINE',
  CAPACITY_WARNING: 'CAPACITY_WARNING',
  SYNC_ERROR: 'SYNC_ERROR',
  PAYMENT_RECEIVED: 'PAYMENT_RECEIVED',
  INVENTORY_LOW: 'INVENTORY_LOW',
} as const;

export interface WebSocketNotification {
  type: keyof typeof NOTIFICATION_TYPES;
  title: string;
  message: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  data?: Record<string, unknown>;
  timestamp: string;
  id: string;
}

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  private listeners: Map<string, Set<(notif: WebSocketNotification) => void>> = new Map();
  private isConnected = false;

  /**
   * Bağlantı başlatıcı
   */
  connect(url: string = `wss://${window.location.host}/ws/notifications`) {
    return new Promise<void>((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          console.log('[WebSocket] Connected');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.emit('connected');
          resolve();
        };

        this.ws.onmessage = (event: MessageEvent) => {
          try {
            const notification = JSON.parse(event.data) as WebSocketNotification;
            this.handleNotification(notification);
          } catch (error) {
            console.error('[WebSocket] Failed to parse message:', error);
          }
        };

        this.ws.onerror = (event: Event) => {
          console.error('[WebSocket] Error:', event);
          this.emit('error', event);
          reject(new Error('WebSocket connection failed'));
        };

        this.ws.onclose = () => {
          console.log('[WebSocket] Disconnected');
          this.isConnected = false;
          this.emit('disconnected');
          this.attemptReconnect();
        };
      } catch (error) {
        console.error('[WebSocket] Connection setup failed:', error);
        reject(error);
      }
    });
  }

  /**
   * Reconnect with exponential backoff
   */
  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocket] Max reconnection attempts reached');
      this.emit('reconnect-failed');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect().catch((error) => {
        console.error('[WebSocket] Reconnection failed:', error);
      });
    }, delay);
  }

  /**
   * Notification işle
   */
  private handleNotification(notification: WebSocketNotification) {
    // Tüm listeners'a bildir
    this.emit('notification', notification);

    // Type-specific listeners
    const typeListeners = this.listeners.get(notification.type);
    if (typeListeners) {
      typeListeners.forEach((callback) => callback(notification));
    }
  }

  /**
   * Listener kaydı
   */
  on(
    event: string,
    callback: (notification?: WebSocketNotification | Event) => void,
  ) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    const set = this.listeners.get(event)!;
    set.add(callback as (notif: WebSocketNotification) => void);

    // Unsubscribe fonksiyonu
    return () => {
      set.delete(callback as (notif: WebSocketNotification) => void);
    };
  }

  /**
   * Event emit
   */
  private emit(event: string, data?: WebSocketNotification | Event) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach((callback) => callback(data as WebSocketNotification));
    }
  }

  /**
   * Mesaj gönder
   */
  send(message: Record<string, unknown>) {
    if (!this.isConnected || !this.ws) {
      console.warn('[WebSocket] Not connected');
      return;
    }

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Bağlantıyı kapat
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Bağlantı durumu
   */
  connected(): boolean {
    return this.isConnected;
  }
}

// Singleton instance
export const webSocketService = new WebSocketService();

/**
 * useWebSocketNotifications Hook
 */
import React from 'react';

export const useWebSocketNotifications = () => {
  const [isConnected, setIsConnected] = React.useState(
    webSocketService.connected(),
  );
  const [lastNotification, setLastNotification] = React.useState<WebSocketNotification | null>(
    null,
  );

  React.useEffect(() => {
    const unsubConnected = webSocketService.on('connected', () => {
      setIsConnected(true);
    });

    const unsubDisconnected = webSocketService.on('disconnected', () => {
      setIsConnected(false);
    });

    const unsubNotification = webSocketService.on('notification', (notif) => {
      setLastNotification(notif as WebSocketNotification);
    });

    return () => {
      unsubConnected();
      unsubDisconnected();
      unsubNotification();
    };
  }, []);

  const subscribe = React.useCallback(
    (type: keyof typeof NOTIFICATION_TYPES, callback: (notif: WebSocketNotification) => void) => {
      return webSocketService.on(type, callback as (notification?: WebSocketNotification | Event) => void);
    },
    [],
  );

  return {
    isConnected,
    lastNotification,
    subscribe,
  };
};
