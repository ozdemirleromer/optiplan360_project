import React, { useState, useCallback, useRef, useEffect } from 'react';
import { OCRRow, OCRField, CellState, CRITICAL_FIELDS } from '../types';
import { useOCRData } from '../contexts/OCRDataContext';
import { useKeyboardNavigation } from '../contexts/KeyboardNavigationContext';

interface OCRGridProps {
  rows: OCRRow[];
  showToast: (message: string, type: 'success' | 'error' | 'warning') => void;
}

export const OCRGrid: React.FC<OCRGridProps> = ({ rows, showToast }) => {
  const { actions } = useOCRData();
  const { state: keyboardState, actions: keyboardActions } = useKeyboardNavigation();
  const [editingCell, setEditingCell] = useState<{ rowId: string; fieldId: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const gridRef = useRef<HTMLDivElement>(null);

  const getCellState = (field: OCRField, isSelected: boolean): CellState => {
    if (isSelected) return 'selected';
    if (field.confidence < 80 && !field.isApproved) return 'low-confidence';
    if (field.isApproved) return 'approved';
    if (field.isOverridden) return 'overridden';
    if (!field.isCritical) return 'read-only';
    return 'normal';
  };

  const getCellClassName = (state: CellState): string => {
    const baseClasses = 'border border-slate-600 px-2 py-1 text-sm transition-colors';
    
    switch (state) {
      case 'selected':
        return `${baseClasses} bg-blue-900 border-blue-500 text-blue-100`;
      case 'low-confidence':
        return `${baseClasses} bg-amber-900 border-amber-600 text-amber-100`;
      case 'approved':
        return `${baseClasses} bg-emerald-900 border-emerald-600 text-emerald-100`;
      case 'overridden':
        return `${baseClasses} bg-purple-900 border-purple-600 text-purple-100`;
      case 'read-only':
        return `${baseClasses} bg-slate-800 text-slate-500`;
      default:
        return `${baseClasses} bg-slate-800 text-slate-200 hover:bg-slate-700`;
    }
  };

  const handleCellClick = useCallback((rowId: string, fieldId: string) => {
    keyboardActions.selectCell(rowId, fieldId);
    actions.selectField({ rowId, fieldId });
    actions.selectRow(rowId);
  }, [keyboardActions, actions]);

  const handleCellDoubleClick = useCallback((rowId: string, fieldId: string, value: string) => {
    const field = rows.find(r => r.id === rowId)?.fields[fieldId];
    if (field?.isCritical) {
      setEditingCell({ rowId, fieldId });
      setEditValue(value);
    }
  }, [rows]);

  const handleCellEdit = useCallback((value: string) => {
    setEditValue(value);
  }, []);

  const handleCellEditComplete = useCallback(() => {
    if (editingCell) {
      actions.updateField(editingCell.rowId, editingCell.fieldId, editValue);
      setEditingCell(null);
      setEditValue('');
      showToast('Hücre güncellendi', 'success');
    }
  }, [editingCell, editValue, actions, showToast]);

  const handleCellEditCancel = useCallback(() => {
    setEditingCell(null);
    setEditValue('');
  }, []);

  const handleExplicitApprove = useCallback(() => {
    if (keyboardState.selectedCell) {
      actions.approveField(keyboardState.selectedCell.rowId, keyboardState.selectedCell.fieldId);
      showToast('Hücre onaylandı', 'success');
    }
  }, [keyboardState.selectedCell, actions, showToast]);

  // Handle F2 explicit approval
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2' && keyboardState.selectedCell) {
        e.preventDefault();
        handleExplicitApprove();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [keyboardState.selectedCell, handleExplicitApprove]);

  const renderCell = (row: OCRRow, field: OCRField) => {
    const isSelected = keyboardState.selectedCell?.rowId === row.id && 
                      keyboardState.selectedCell?.fieldId === field.id;
    const isEditing = editingCell?.rowId === row.id && editingCell?.fieldId === field.id;
    const cellState = getCellState(field, isSelected);
    const cellClassName = getCellClassName(cellState);

    if (isEditing && field.isCritical) {
      return (
        <td key={field.id} className={cellClassName}>
          <input
            type="text"
            value={editValue}
            onChange={(e) => handleCellEdit(e.target.value)}
            onBlur={handleCellEditComplete}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCellEditComplete();
              } else if (e.key === 'Escape') {
                handleCellEditCancel();
              }
            }}
            className="w-full bg-transparent border-none outline-none text-inherit"
            autoFocus
          />
        </td>
      );
    }

    return (
      <td
        key={field.id}
        className={cellClassName}
        onClick={() => handleCellClick(row.id, field.id)}
        onDoubleClick={() => handleCellDoubleClick(row.id, field.id, field.value)}
        style={{ cursor: field.isCritical ? 'pointer' : 'default' }}
      >
        <div className="flex items-center justify-between">
          <span className={field.isCritical ? 'font-medium' : ''}>
            {field.value}
          </span>
          {field.isCritical && (
            <div className="flex items-center space-x-1 ml-2">
              {/* Confidence indicator */}
              <div className={`w-2 h-2 rounded-full ${
                field.confidence >= 80 ? 'bg-emerald-500' : 'bg-amber-500'
              }`} title={`Confidence: ${field.confidence}%`}></div>
              
              {/* Approval indicator */}
              {field.isApproved && (
                <div className="w-2 h-2 rounded-full bg-blue-500" title="Approved"></div>
              )}
              
              {/* Override indicator */}
              {field.isOverridden && (
                <div className="w-2 h-2 rounded-full bg-purple-500" title="Overridden"></div>
              )}
            </div>
          )}
        </div>
      </td>
    );
  };

  if (!rows || rows.length === 0) {
    return (
      <div className="h-full bg-slate-800 border-l border-slate-700 flex items-center justify-center">
        <p className="text-slate-400">OCR verisi bulunamadı</p>
      </div>
    );
  }

  // Get all unique field names from first row to determine columns
  const isCriticalFieldName = (fieldName: string): fieldName is typeof CRITICAL_FIELDS[number] =>
    (CRITICAL_FIELDS as readonly string[]).includes(fieldName);
  const allFields = rows[0]?.fields ? Object.values(rows[0].fields) : [];
  const criticalFields = allFields.filter((f) => isCriticalFieldName(f.name));
  const optionalFields = allFields.filter((f) => !isCriticalFieldName(f.name));

  // Ensure we have the critical fields in the correct order
  const orderedCriticalFields = CRITICAL_FIELDS.map(fieldName => 
    criticalFields.find(f => f.name === fieldName) || {
      id: `${fieldName}-default`,
      name: fieldName,
      value: '',
      confidence: 0,
      isCritical: true,
      isApproved: false,
      isOverridden: false,
      rowNumber: 1
    }
  );

  return (
    <div className="h-full bg-slate-800 border-l border-slate-700 flex flex-col">
      {/* Grid Header */}
      <div className="bg-slate-700 border-b border-slate-600 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-200">OCR Veri Grid</h2>
      </div>

      {/* Grid Container */}
      <div className="flex-1 overflow-auto">
        <div ref={gridRef} className="min-w-full">
          <table className="w-full border-collapse">
            <thead className="bg-slate-700 sticky top-0 z-10">
              <tr>
                <th className="border border-slate-600 px-2 py-1 text-left text-xs font-medium text-slate-300 bg-slate-700">
                  Satır No
                </th>
                
                {/* Critical Fields Header */}
                {orderedCriticalFields.map(field => (
                  <th 
                    key={field.id}
                    className="border border-slate-600 px-2 py-1 text-left text-xs font-medium text-slate-200 bg-slate-600"
                  >
                    {field.name}
                  </th>
                ))}
                
                {/* Optional Fields Header */}
                {optionalFields.map(field => (
                  <th 
                    key={field.id}
                    className="border border-slate-600 px-2 py-1 text-left text-xs font-medium text-slate-400 bg-slate-700"
                  >
                    {field.name}
                  </th>
                ))}
                
                <th className="border border-slate-600 px-2 py-1 text-left text-xs font-medium text-slate-300 bg-slate-700">
                  Confidence
                </th>
                
                <th className="border border-slate-600 px-2 py-1 text-left text-xs font-medium text-slate-300 bg-slate-700">
                  Onay
                </th>
              </tr>
            </thead>
            
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-700">
                  {/* Row Number */}
                  <td className="border border-slate-600 px-2 py-1 text-sm text-slate-400 bg-slate-750">
                    {row.rowNumber}
                  </td>
                  
                  {/* Critical Fields */}
                  {orderedCriticalFields.map(field => 
                    renderCell(row, field)
                  )}
                  
                  {/* Optional Fields */}
                  {optionalFields.map(field => 
                    renderCell(row, field)
                  )}
                  
                  {/* Confidence Column */}
                  <td className="border border-slate-600 px-2 py-1 text-sm text-slate-300">
                    <div className="flex items-center space-x-1">
                      <span>{Math.round(orderedCriticalFields[0]?.confidence || 0)}%</span>
                    </div>
                  </td>
                  
                  {/* Approval Status Column */}
                  <td className="border border-slate-600 px-2 py-1 text-sm">
                    <div className="flex items-center justify-center">
                      {orderedCriticalFields.some(f => row.fields[f.name]?.isApproved) ? (
                        <span className="text-emerald-400 text-xs">Onaylı</span>
                      ) : (
                        <span className="text-amber-400 text-xs">Bekliyor</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
