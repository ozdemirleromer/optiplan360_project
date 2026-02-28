/**
 * Audit Trail & Compliance Logging
 * Tüm işlemleri kaydet ve denetim izi oluştur
 */

import React, { useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userEmail: string;
  action: string;
  entityType: string; // 'order', 'user', 'payment', etc.
  entityId: string;
  changes?: {
    fieldName: string;
    oldValue: unknown;
    newValue: unknown;
  }[];
  ipAddress?: string;
  userAgent?: string;
  status: 'success' | 'failed';
  error?: string;
  metadata?: Record<string, unknown>;
}

interface AuditState {
  logs: AuditLog[];
  addLog: (log: Omit<AuditLog, 'id' | 'timestamp'>) => void;
  getLogs: (filters?: {
    userId?: string;
    entityType?: string;
    entityId?: string;
    dateRange?: [Date, Date];
  }) => AuditLog[];
  exportLogs: (format: 'csv' | 'json') => void;
}

export const useAuditStore = create<AuditState>()(
  persist(
    (set, get) => ({
      logs: [],

      addLog: (log) => {
        const id = `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        set((state) => ({
          logs: [
            {
              ...log,
              id,
              timestamp: new Date().toISOString(),
            },
            ...state.logs,
          ].slice(0, 10000), // Last 10k logs
        }));

        // Backend'e de gönder (async, non-blocking)
        auditService.sendLog({
          ...log,
          id,
          timestamp: new Date().toISOString(),
        }).catch(console.error);
      },

      getLogs: (filters) => {
        let logs = [...get().logs];

        if (filters?.userId) {
          logs = logs.filter((l) => l.userId === filters.userId);
        }

        if (filters?.entityType) {
          logs = logs.filter((l) => l.entityType === filters.entityType);
        }

        if (filters?.entityId) {
          logs = logs.filter((l) => l.entityId === filters.entityId);
        }

        if (filters?.dateRange) {
          logs = logs.filter((l) => {
            const date = new Date(l.timestamp);
            return (
              date >= filters.dateRange![0] &&
              date <= filters.dateRange![1]
            );
          });
        }

        return logs;
      },

      exportLogs: (fmt) => {
        const logs = get().logs;

        if (fmt === 'json') {
          const dataStr = JSON.stringify(logs, null, 2);
          const blob = new Blob([dataStr], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `audit-logs-${Date.now()}.json`;
          a.click();
          URL.revokeObjectURL(url);
        } else if (fmt === 'csv') {
          // CSV export
          const csv = [
            ['Timestamp', 'User', 'Action', 'Entity', 'Status'].join(','),
            ...logs.map((l) =>
              [l.timestamp, l.userEmail, l.action, `${l.entityType}:${l.entityId}`, l.status].join(','),
            ),
          ].join('\n');

          const blob = new Blob([csv], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `audit-logs-${Date.now()}.csv`;
          a.click();
          URL.revokeObjectURL(url);
        }
      },
    }),
    {
      name: 'audit-storage',
    },
  ),
);

/**
 * Audit Service
 */
const auditService = {
  /**
   * Log'u backend'e gönder
   */
  sendLog: async (log: AuditLog) => {
    try {
      await fetch('/api/audit/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(log),
      });
    } catch (error) {
      console.error('Failed to send audit log:', error);
    }
  },

  /**
   * Tezahür log'unu oluştur
   */
  logAction: (
    action: string,
    entityType: string,
    entityId: string,
    changes?: AuditLog['changes'],
  ) => {
    const log: Omit<AuditLog, 'id' | 'timestamp'> = {
      userId: 'current-user-id', // From auth store
      userEmail: 'user@company.com',
      action,
      entityType,
      entityId,
      changes,
      status: 'success',
      ipAddress: undefined, // Browser can't get this
      userAgent: navigator.userAgent,
    };

    useAuditStore.getState().addLog(log);
  },
};

/**
 * useAudit Hook
 */
export const useAudit = () => {
  const { getLogs, exportLogs } = useAuditStore();

  return {
    log: (action: string, entityType: string, entityId: string, changes?: AuditLog['changes']) => {
      auditService.logAction(action, entityType, entityId, changes);
    },
    getLogs,
    exportLogs,
  };
};

/**
 * Audit Log Viewer Component
 */
interface AuditLogTableProps {
  entityId?: string;
  limit?: number;
}

export const AuditLogTable: React.FC<AuditLogTableProps> = ({ entityId, limit = 20 }) => {
  const { logs } = useAuditStore();

  const filteredLogs = useMemo(() => {
    const filtered = entityId
      ? logs.filter((l) => l.entityId === entityId)
      : logs;

    return filtered.slice(0, limit);
  }, [logs, entityId, limit]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-4 py-2 text-left">Zaman</th>
            <th className="px-4 py-2 text-left">Kullanıcı</th>
            <th className="px-4 py-2 text-left">İşlem</th>
            <th className="px-4 py-2 text-left">Durum</th>
          </tr>
        </thead>
        <tbody>
          {filteredLogs.map((log) => (
            <tr key={log.id} className="border-t hover:bg-gray-50">
              <td className="px-4 py-2">
                {new Date(log.timestamp).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </td>
              <td className="px-4 py-2">{log.userEmail}</td>
              <td className="px-4 py-2">{log.action}</td>
              <td className="px-4 py-2">
                <span
                  className={`px-2 py-1 rounded text-xs font-semibold ${
                    log.status === 'success'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {log.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
