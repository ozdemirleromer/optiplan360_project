/**
 * Data Import Wizard
 * Excel/CSV dosyalarından veri içeri aktarma
 */

import React, { useState, useCallback } from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';

export interface ImportConfig {
  fileType: 'csv' | 'excel';
  sheetName?: string; // Excel sheet
  mapping: Record<string, string>; // file_column -> entity_field
  skipHeader: boolean;
  delimiter?: string; // CSV
  onConflict: 'skip' | 'update' | 'error';
}

export interface ImportResult {
  success: number;
  failed: number;
  errors: Array<{
    row: number;
    error: string;
    data: Record<string, unknown>;
  }>;
}

/**
 * Import Service
 */
export const importService = {
  /**
   * Dosyayı parse et
   */
  parseFile: async (
    file: File,
    config: ImportConfig,
  ): Promise<Record<string, unknown>[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          if (config.fileType === 'csv') {
            const csv = e.target?.result as string;
            const rows = csv.split('\n').map((r) => r.split(config.delimiter || ','));

            const data = rows.slice(config.skipHeader ? 1 : 0).map((row) => {
              const obj: Record<string, unknown> = {};
              Object.entries(config.mapping).forEach(([_fileCol, entityField], idx) => {
                obj[entityField] = row[idx] || '';
              });
              return obj;
            });

            resolve(data);
          } else if (config.fileType === 'excel') {
            // XLSX library gerek
            const XLSX = await import('xlsx');
            const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
            const sheet = workbook.Sheets[config.sheetName || workbook.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(sheet);

            // Re-map columns
            const remapped = data.map((row: unknown) => {
              const obj: Record<string, unknown> = {};
              const r = row as Record<string, unknown>;
              Object.entries(config.mapping).forEach(([fileCol, entityField]) => {
                obj[entityField] = r[fileCol] || '';
              });
              return obj;
            });

            resolve(remapped);
          }
        } catch (error) {
          reject(error);
        }
      };

      reader.readAsText(file);
    });
  },

  /**
   * Verileri backend'e gönder
   */
  importData: async (
    entityType: string,
    data: Record<string, unknown>[],
    config: ImportConfig,
  ): Promise<ImportResult> => {
    try {
      const response = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType,
          data,
          config,
        }),
      });

      if (!response.ok) {
        throw new Error('Import failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Import error:', error);
      throw error;
    }
  },

  /**
   * İthalatı doğrula
   */
  validateData: (
    data: Record<string, unknown>[],
    schema: Record<string, unknown>,
  ): ImportResult => {
    const errors: ImportResult['errors'] = [];
    let success = 0;

    data.forEach((row, idx) => {
      const rowErrors: string[] = [];

      Object.entries(schema).forEach(([field, rules]: [string, unknown]) => {
        const r = rules as Record<string, unknown>;
        if (r.required && !row[field]) {
          rowErrors.push(`${field}: Zorunlu alan`);
        }

        if (r.type === 'number' && isNaN(Number(row[field]))) {
          rowErrors.push(`${field}: Sayı olmalı`);
        }

        if (r.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(row[field]))) {
          rowErrors.push(`${field}: Geçerli e-posta`);
        }
      });

      if (rowErrors.length > 0) {
        errors.push({
          row: idx + 1,
          error: rowErrors.join('; '),
          data: row,
        });
      } else {
        success++;
      }
    });

    return {
      success,
      failed: errors.length,
      errors,
    };
  },
};

/**
 * useImport Hook
 */
export const useImport = () => {
  const [progress, setProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);

  const importFile = useCallback(
    async (
      file: File,
      config: ImportConfig,
      entityType: string,
    ): Promise<ImportResult> => {
      setIsImporting(true);
      setProgress(0);

      try {
        // Parse file
        setProgress(30);
        const data = await importService.parseFile(file, config);

        // Import to backend
        setProgress(60);
        const result = await importService.importData(entityType, data, config);

        setProgress(100);
        return result;
      } finally {
        setIsImporting(false);
      }
    },
    [],
  );

  return { importFile, isImporting, progress };
};

/**
 * Import Preview Table
 */
interface ImportPreviewProps {
  data: Record<string, unknown>[];
  validation: ImportResult;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ImportPreview: React.FC<ImportPreviewProps> = ({
  data,
  validation,
  onConfirm,
  onCancel,
}) => {
  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex gap-4">
        <div className="flex-1 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-sm font-semibold text-green-900">
                {validation.success} başarılı
              </p>
            </div>
          </div>
        </div>

        {validation.errors.length > 0 && (
          <div className="flex-1 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <div>
                <p className="text-sm font-semibold text-red-900">
                  {validation.failed} hata
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Data preview */}
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              {data[0] &&
                Object.keys(data[0]).map((key) => (
                  <th key={key} className="px-4 py-2 text-left">
                    {key}
                  </th>
                ))}
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 5).map((row, idx) => (
              <tr key={idx} className="border-t">
                {Object.values(row).map((val, idx) => (
                  <td key={idx} className="px-4 py-2">
                    {String(val)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg transition-colors"
        >
          İptal Et
        </button>
        <button
          onClick={onConfirm}
          disabled={validation.failed > 0}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
        >
          İçeri Aktar ({validation.success} kayıt)
        </button>
      </div>
    </div>
  );
};
