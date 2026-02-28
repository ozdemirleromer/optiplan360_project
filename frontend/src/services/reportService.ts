/**
 * BI Reporting & Business Intelligence
 * Advanced raporlama ve pivot tablolar
 */

import { create } from 'zustand';

export type ReportType = 'pivot' | 'trend' | 'heatmap' | 'custom';
export type AggregationFunc = 'sum' | 'count' | 'avg' | 'min' | 'max';

export interface ReportConfig {
  id: string;
  name: string;
  type: ReportType;
  rows: string[]; // Field names for rows
  columns: string[]; // Field names for columns
  values: { field: string; func: AggregationFunc }[]; // Values to aggregate
  filters?: Array<{
    field: string;
    operator: 'eq' | 'gt' | 'lt' | 'contains' | 'between';
    value: unknown;
  }>;
  sortBy?: string;
  order?: 'asc' | 'desc';
}

export interface ReportData {
  config: ReportConfig;
  data: Record<string, unknown>[];
  summary?: Record<string, number>;
  timestamp: string;
}

interface ReportState {
  reports: ReportConfig[];
  activeReport: ReportConfig | null;
  savedReports: ReportConfig[];
  
  addReport: (report: ReportConfig) => void;
  updateReport: (id: string, updates: Partial<ReportConfig>) => void;
  deleteReport: (id: string) => void;
  saveReport: (report: ReportConfig) => void;
  loadReport: (id: string) => void;
}

export const useReportStore = create<ReportState>((set) => ({
  reports: [],
  activeReport: null,
  savedReports: [],

  addReport: (report) => {
    set((state) => ({
      reports: [...state.reports, report],
      activeReport: report,
    }));
  },

  updateReport: (id, updates) => {
    set((state) => ({
      reports: state.reports.map((r) =>
        r.id === id ? { ...r, ...updates } : r,
      ),
    }));
  },

  deleteReport: (id) => {
    set((state) => ({
      reports: state.reports.filter((r) => r.id !== id),
    }));
  },

  saveReport: (report) => {
    set((state) => ({
      savedReports: [...state.savedReports, report],
    }));
  },

  loadReport: (id) => {
    set((state) => {
      const report = state.savedReports.find((r) => r.id === id);
      return { activeReport: report || null };
    });
  },
}));

/**
 * Report Generation Service
 */
export const reportService = {
  generateReport: async (config: ReportConfig): Promise<ReportData> => {
    try {
      const response = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error('Report generation failed');
      }

      const data = await response.json();
      return {
        config,
        data: data.data,
        summary: data.summary,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Report error:', error);
      throw error;
    }
  },

  /**
   * Raporu PDF olarak indir
   */
  downloadAsPDF: async (report: ReportData) => {
    try {
      const response = await fetch('/api/reports/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
      });

      if (!response.ok) throw new Error('PDF generation failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${Date.now()}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('PDF download error:', error);
      throw error;
    }
  },

  /**
   * Raporu Excel olarak indir
   */
  downloadAsExcel: async (report: ReportData) => {
    try {
      const response = await fetch('/api/reports/excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
      });

      if (!response.ok) throw new Error('Excel generation failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${Date.now()}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Excel download error:', error);
      throw error;
    }
  },
};

/**
 * Predefined Reports
 */
export const PREDEFINED_REPORTS: ReportConfig[] = [
  {
    id: 'ceo-summary',
    name: 'CEO Özeti',
    type: 'custom',
    rows: ['month'],
    columns: [],
    values: [
      { field: 'order_count', func: 'count' },
      { field: 'total_revenue', func: 'sum' },
    ],
  },
  {
    id: 'customer-ltv',
    name: 'Müşteri Yaşam Boyu Değeri',
    type: 'pivot',
    rows: ['customer_name'],
    columns: ['order_status'],
    values: [
      { field: 'total_amount', func: 'sum' },
      { field: 'order_count', func: 'count' },
    ],
  },
  {
    id: 'production-efficiency',
    name: 'Üretim Verimliliği',
    type: 'trend',
    rows: ['station_id', 'date'],
    columns: [],
    values: [
      { field: 'processing_time', func: 'avg' },
      { field: 'quality_score', func: 'avg' },
    ],
  },
];

/**
 * useReports Hook
 */
import { useCallback } from 'react';

export const useReports = () => {
  const {
    reports,
    activeReport,
    addReport,
    updateReport,
    deleteReport,
    saveReport,
    loadReport,
  } = useReportStore();

  const runReport = useCallback(async (config: ReportConfig) => {
    return await reportService.generateReport(config);
  }, []);

  return {
    reports,
    activeReport,
    addReport,
    updateReport,
    deleteReport,
    saveReport,
    loadReport,
    runReport,
  };
};
