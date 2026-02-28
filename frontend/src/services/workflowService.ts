/**
 * Workflow Automation
 * Trigger-based action workflows (Zapier tarzı)
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type TriggerType =
  | 'SCHEDULE'
  | 'ORDER_STATUS_CHANGE'
  | 'INVENTORY_LOW'
  | 'STATION_OFFLINE'
  | 'MANUAL'
  | 'WEBHOOK';

export type ActionType =
  | 'SEND_EMAIL'
  | 'SEND_WHATSAPP'
  | 'SEND_TELEGRAM'
  | 'CREATE_REPORT'
  | 'UPDATE_DATABASE'
  | 'CALL_WEBHOOK'
  | 'NOTIFY_USER';

export interface WorkflowTrigger {
  type: TriggerType;
  config: Record<string, unknown>;
}

export interface WorkflowAction {
  type: ActionType;
  config: Record<string, unknown>;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  trigger: WorkflowTrigger;
  conditions?: Array<{
    field: string;
    operator: 'eq' | 'gt' | 'lt' | 'contains';
    value: string | number | boolean;
  }>;
  actions: WorkflowAction[];
  createdAt: string;
  updatedAt: string;
}

interface WorkflowState {
  workflows: Workflow[];
  executionHistory: Array<{
    workflowId: string;
    status: 'success' | 'failed';
    timestamp: string;
    error?: string;
  }>;
  
  addWorkflow: (workflow: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateWorkflow: (id: string, updates: Partial<Workflow>) => void;
  deleteWorkflow: (id: string) => void;
  toggleWorkflow: (id: string) => void;
  addExecution: (execution: { workflowId: string; status: 'success' | 'failed'; error?: string }) => void;
}

export const useWorkflowStore = create<WorkflowState>()(
  persist(
    (set) => ({
      workflows: [],
      executionHistory: [],

      addWorkflow: (workflow) => {
        const id = `wf-${Date.now()}`;
        set((state) => ({
          workflows: [
            ...state.workflows,
            {
              ...workflow,
              id,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        }));
      },

      updateWorkflow: (id, updates) => {
        set((state) => ({
          workflows: state.workflows.map((w) =>
            w.id === id
              ? { ...w, ...updates, updatedAt: new Date().toISOString() }
              : w,
          ),
        }));
      },

      deleteWorkflow: (id) => {
        set((state) => ({
          workflows: state.workflows.filter((w) => w.id !== id),
        }));
      },

      toggleWorkflow: (id) => {
        set((state) => ({
          workflows: state.workflows.map((w) =>
            w.id === id ? { ...w, enabled: !w.enabled } : w,
          ),
        }));
      },

      addExecution: (execution) => {
        set((state) => ({
          executionHistory: [
            { ...execution, timestamp: new Date().toISOString() },
            ...state.executionHistory,
          ].slice(0, 100), // Son 100 execution'ı sakla
        }));
      },
    }),
    {
      name: 'workflow-storage',
    },
  ),
);

/**
 * Workflow Execution Service
 */
export const workflowService = {
  /**
   * Workflow'u yürüt
   */
  executeWorkflow: async (workflow: Workflow, triggerData?: Record<string, unknown>): Promise<boolean> => {
    try {
      const response = await fetch('/api/workflows/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowId: workflow.id,
          triggerData,
        }),
      });

      if (!response.ok) {
        throw new Error('Workflow execution failed');
      }

      return (await response.json()).success;
    } catch (error) {
      console.error('Workflow error:', error);
      throw error;
    }
  },

  /**
   * Tüm aktif workflow'ları tesst et
   */
  testWorkflow: async (workflow: Workflow, sampleData?: Record<string, unknown>): Promise<unknown> => {
    try {
      const response = await fetch('/api/workflows/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow,
          sampleData,
        }),
      });

      if (!response.ok) {
        throw new Error('Workflow test failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Test error:', error);
      throw error;
    }
  },
};

/**
 * Predefined Workflow Templates
 */
export const WORKFLOW_TEMPLATES: Workflow[] = [
  {
    id: 'template-late-order-alert',
    name: 'Gecikmiş Sipariş Uyarısı',
    description: 'Gecikmiş siparişler için otomatik bildirim gönder',
    enabled: false,
    trigger: {
      type: 'SCHEDULE',
      config: { cronExpression: '0 9 * * *' }, // Her gün 09:00
    },
    conditions: [
      {
        field: 'status',
        operator: 'eq',
        value: 'IN_PRODUCTION',
      },
    ],
    actions: [
      {
        type: 'SEND_EMAIL',
        config: {
          template: 'order_delay_alert',
          recipients: 'manager@company.com',
        },
      },
      {
        type: 'SEND_WHATSAPP',
        config: {
          template: 'order_delay_sms',
        },
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  {
    id: 'template-low-stock',
    name: 'Düşük Stok Notifikasyonu',
    description: 'Stok seviyesi düşerse tedarikçiye bildir',
    enabled: false,
    trigger: {
      type: 'INVENTORY_LOW',
      config: { threshold: 10 },
    },
    actions: [
      {
        type: 'SEND_EMAIL',
        config: {
          template: 'low_stock_alert',
          recipients: 'supplier@company.com',
        },
      },
      {
        type: 'CREATE_REPORT',
        config: {
          type: 'inventory_status',
        },
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  {
    id: 'template-daily-summary',
    name: 'Günlük Özet Raporu',
    description: 'Hergün saat 18:00\'de özet rapor gönder',
    enabled: false,
    trigger: {
      type: 'SCHEDULE',
      config: { cronExpression: '0 18 * * *' },
    },
    actions: [
      {
        type: 'CREATE_REPORT',
        config: {
          type: 'daily_summary',
          recipients: ['manager@company.com'],
        },
      },
      {
        type: 'SEND_EMAIL',
        config: {
          template: 'daily_summary',
        },
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

/**
 * useWorkflows Hook
 */
import { useCallback } from 'react';

export const useWorkflows = () => {
  const {
    workflows,
    executionHistory,
    addWorkflow,
    updateWorkflow,
    deleteWorkflow,
    toggleWorkflow,
    addExecution,
  } = useWorkflowStore();

  const executeWorkflow = useCallback(
    async (workflow: Workflow, triggerData?: Record<string, unknown>) => {
      try {
        const success = await workflowService.executeWorkflow(workflow, triggerData);
        addExecution({
          workflowId: workflow.id,
          status: success ? 'success' : 'failed',
        });
        return success;
      } catch (error) {
        addExecution({
          workflowId: workflow.id,
          status: 'failed',
          error: String(error),
        });
        throw error;
      }
    },
    [addExecution],
  );

  const testWorkflow = useCallback(
    async (workflow: Workflow) => {
      return await workflowService.testWorkflow(workflow);
    },
    [],
  );

  return {
    workflows,
    executionHistory,
    addWorkflow,
    updateWorkflow,
    deleteWorkflow,
    toggleWorkflow,
    executeWorkflow,
    testWorkflow,
  };
};
