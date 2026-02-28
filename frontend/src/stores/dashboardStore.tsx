/**
 * Advanced Dashboard - Draggable Widget System
 * Sürüklenebilir widget'lar ve özelleştirilebilir dashboard
 */

import React from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { GripHorizontal, X, Settings } from 'lucide-react';

export interface Widget {
  id: string;
  title: string;
  type: 'chart' | 'gauge' | 'kpi' | 'table' | 'stat' | 'custom';
  width: number; // 1-4 grid units
  height: number; // 1-3 grid units
  x?: number;
  y?: number;
  enabled: boolean;
  settings?: Record<string, unknown>;
}

interface DashboardLayoutState {
  widgets: Widget[];
  gridSize: number;
  addWidget: (widget: Widget) => void;
  removeWidget: (id: string) => void;
  updateWidget: (id: string, updates: Partial<Widget>) => void;
  reorderWidgets: (widgets: Widget[]) => void;
  resetLayout: () => void;
}

const DEFAULT_WIDGETS: Widget[] = [
  {
    id: 'chart-7days',
    title: 'Son 7 Gün',
    type: 'chart',
    width: 2,
    height: 2,
    enabled: true,
  },
  {
    id: 'gauge-capacity',
    title: 'Kapasite Kullanımı',
    type: 'gauge',
    width: 1,
    height: 1,
    enabled: true,
  },
  {
    id: 'kpi-cards',
    title: 'KPI\'lar',
    type: 'kpi',
    width: 2,
    height: 1,
    enabled: true,
  },
  {
    id: 'ai-insights',
    title: 'AI Öneriler',
    type: 'custom',
    width: 1,
    height: 2,
    enabled: true,
  },
  {
    id: 'station-status',
    title: 'İstasyonlar',
    type: 'table',
    width: 2,
    height: 1,
    enabled: true,
  },
  {
    id: 'pending-orders',
    title: 'Bekleyen Siparişler',
    type: 'stat',
    width: 1,
    height: 2,
    enabled: true,
  },
];

export const useDashboardStore = create<DashboardLayoutState>()(
  persist(
    (set) => ({
      widgets: DEFAULT_WIDGETS,
      gridSize: 12,

      addWidget: (widget) => {
        set((state) => ({
          widgets: [...state.widgets, widget],
        }));
      },

      removeWidget: (id) => {
        set((state) => ({
          widgets: state.widgets.filter((w) => w.id !== id),
        }));
      },

      updateWidget: (id, updates) => {
        set((state) => ({
          widgets: state.widgets.map((w) =>
            w.id === id ? { ...w, ...updates } : w,
          ),
        }));
      },

      reorderWidgets: (widgets) => {
        set({ widgets });
      },

      resetLayout: () => {
        set({ widgets: DEFAULT_WIDGETS });
      },
    }),
    {
      name: 'dashboard-layout-storage',
    },
  ),
);

/**
 * Dashboard Widget Container Component
 */
interface WidgetContainerProps {
  widget: Widget;
  children: React.ReactNode;
  onRemove?: (id: string) => void;
  isDragging?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
}

export const WidgetContainer: React.FC<WidgetContainerProps> = ({
  widget,
  children,
  onRemove,
  isDragging,
  onDragStart,
}) => {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={`
        bg-white rounded-lg shadow-md p-4 border border-gray-200
        transition-all duration-200
        ${isDragging ? 'opacity-50 shadow-lg' : ''}
        hover:shadow-lg
      `}
      style={{
        gridColumn: `span ${widget.width}`,
        gridRow: `span ${widget.height}`,
        cursor: 'grab',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <GripHorizontal className="w-4 h-4 text-gray-400 cursor-grab active:cursor-grabbing" />
          <h3 className="font-semibold text-gray-900">{widget.title}</h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
            title="Ayarlar"
          >
            <Settings className="w-4 h-4" />
          </button>

          {onRemove && (
            <button
              onClick={() => onRemove(widget.id)}
              className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"
              title="Kaldır"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="overflow-auto" style={{ maxHeight: 'calc(100% - 40px)' }}>
        {children}
      </div>
    </div>
  );
};

/**
 * Draggable Dashboard Grid
 */
interface DashboardGridProps {
  children: React.ReactNode;
  columns?: number;
}

export const DashboardGrid: React.FC<DashboardGridProps> = ({
  children,
  columns = 4,
}) => {
  return (
    <div
      className="gap-4 p-4"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gridAutoRows: 'minmax(200px, auto)',
        minHeight: 'calc(100vh - 200px)',
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }}
    >
      {children}
    </div>
  );
};
