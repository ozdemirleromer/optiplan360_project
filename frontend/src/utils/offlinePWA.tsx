/**
 * Offline PWA Support
 * Service Worker + IndexedDB offline capability
 */

import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, AlertCircle } from 'lucide-react';

/**
 * Service Worker Registration
 */
export const registerServiceWorker = async () => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('[PWA] Service Worker registered:', registration);
      return registration;
    } catch (error) {
      console.error('[PWA] Service Worker registration failed:', error);
    }
  }
};

/**
 * IndexedDB untuk offline veri depolaması
 */
class OfflineDB {
  private dbName = 'optiplan360-offline';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;

  async init() {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create stores
        if (!db.objectStoreNames.contains('orders')) {
          db.createObjectStore('orders', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('sync-queue')) {
          db.createObjectStore('sync-queue', {
            keyPath: 'id',
            autoIncrement: true,
          });
        }
      };
    });
  }

  async save(storeName: string, data: unknown) {
    if (!this.db) await this.init();

    return new Promise<void>((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.put(data);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async read(storeName: string, key: IDBValidKey) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async readAll<T = unknown>(storeName: string) {
    if (!this.db) await this.init();

    return new Promise<T[]>((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  }

  async delete(storeName: string, key: IDBValidKey) {
    if (!this.db) await this.init();

    return new Promise<void>((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.delete(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async clear(storeName: string) {
    if (!this.db) await this.init();

    return new Promise<void>((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
}

export const offlineDB = new OfflineDB();

/**
 * Sync Queue Management
 */
export interface SyncItem {
  id?: number;
  action: 'POST' | 'PUT' | 'DELETE';
  endpoint: string;
  data?: unknown;
  timestamp: string;
  retries: number;
  maxRetries: number;
}

export const syncQueue = {
  /**
   * Queue'ya işlem ekle
   */
  add: async (item: Omit<SyncItem, 'id' | 'timestamp' | 'retries'>) => {
    await offlineDB.save('sync-queue', {
      ...item,
      timestamp: new Date().toISOString(),
      retries: 0,
      maxRetries: 3,
    });
  },

  /**
   * Queue'yu senkronize et
   */
  sync: async () => {
    const items = await offlineDB.readAll<SyncItem>('sync-queue');

    for (const item of items) {
      if (item.retries >= item.maxRetries) {
        console.warn('[Sync] Max retries reached:', item);
        continue;
      }

      try {
        const response = await fetch(item.endpoint, {
          method: item.action,
          headers: { 'Content-Type': 'application/json' },
          body: item.data ? JSON.stringify(item.data) : undefined,
        });

        if (response.ok) {
          await offlineDB.delete('sync-queue', item.id!);
        } else {
          // Artır retry sayısı
          item.retries++;
          await offlineDB.save('sync-queue', item);
        }
      } catch (error) {
        console.error('[Sync] Error:', error);
        item.retries++;
        await offlineDB.save('sync-queue', item);
      }
    }
  },

  /**
   * Queue durumu kontrol et
   */
  getStatus: async () => {
    const items = await offlineDB.readAll<SyncItem>('sync-queue');
    return {
      pending: items.length,
      failed: items.filter((i) => i.retries >= i.maxRetries).length,
    };
  },
};

/**
 * useOffline Hook
 */
export const useOffline = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState({ pending: 0, failed: 0 });

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      // Sinkronize et
      await syncQueue.sync();
      const status = await syncQueue.getStatus();
      setSyncStatus(status);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, syncStatus };
};

/**
 * Offline Indicator Component
 */
interface OfflineIndicatorProps {
  className?: string;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ className = '' }) => {
  const { isOnline, syncStatus } = useOffline();

  if (isOnline && syncStatus.pending === 0) {
    return null; // All good
  }

  return (
    <div
      className={`
        flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
        ${isOnline
          ? 'bg-yellow-50 text-yellow-800 border border-yellow-200'
          : 'bg-red-50 text-red-800 border border-red-200'}
        ${className}
      `}
    >
      {isOnline ? (
        <>
          <Wifi className="w-4 h-4" />
          <span>{syncStatus.pending} bekleme</span>
        </>
      ) : (
        <>
          <WifiOff className="w-4 h-4" />
          <span>Çevrimdışı mod</span>
        </>
      )}

      {syncStatus.failed > 0 && (
        <span title={`${syncStatus.failed} hata`}><AlertCircle className="w-4 h-4 ml-2" /></span>
      )}
    </div>
  );
};

/**
 * Service Worker initialization
 */
export const initPWA = async () => {
  // Register service worker
  await registerServiceWorker();

  // Initialize offline DB
  await offlineDB.init();

  // Check and sync on startup
  if (navigator.onLine) {
    await syncQueue.sync();
  }

  console.log('[PWA] Initialized');
};
