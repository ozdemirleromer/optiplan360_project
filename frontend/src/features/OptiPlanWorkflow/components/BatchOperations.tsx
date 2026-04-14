import { useState } from 'react';
import { WorkflowRecord } from '../../../services/optiplanWorkflowService';

interface BatchOperationsProps {
  selectedRecords: Set<string>;
  records: WorkflowRecord[];
  onRetry: (uuids: string[]) => Promise<void>;
  onDelete: (uuids: string[]) => Promise<void>;
  onExport: (uuids: string[], format: 'excel' | 'csv' | 'pdf') => Promise<void>;
  onSelectionChange: (selected: Set<string>) => void;
}

export const BatchOperations: React.FC<BatchOperationsProps> = ({
  selectedRecords,
  records,
  onRetry,
  onDelete,
  onExport,
  onSelectionChange
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const handleSelectAll = () => {
    if (selectedRecords.size === records.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(records.map(r => r.uuid)));
    }
  };

  const handleRetrySelected = async () => {
    if (selectedRecords.size === 0) return;
    
    setIsProcessing(true);
    try {
      await onRetry(Array.from(selectedRecords));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedRecords.size === 0) return;
    
    const confirmed = window.confirm(
      `${selectedRecords.size} kaydı silmek istediğinizden emin misiniz?`
    );
    
    if (!confirmed) return;
    
    setIsProcessing(true);
    try {
      await onDelete(Array.from(selectedRecords));
      onSelectionChange(new Set());
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportSelected = async (format: 'excel' | 'csv' | 'pdf') => {
    if (selectedRecords.size === 0) return;
    
    setIsProcessing(true);
    try {
      await onExport(Array.from(selectedRecords), format);
      setShowExportMenu(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const canRetry = Array.from(selectedRecords).some(uuid => {
    const record = records.find(r => r.uuid === uuid);
    return record?.status === 'HATA';
  });

  const selectedErrorCount = Array.from(selectedRecords).filter(uuid => {
    const record = records.find(r => r.uuid === uuid);
    return record?.status === 'HATA';
  }).length;

  return (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      border: '1px solid #e5e7eb',
      padding: '16px',
      marginBottom: '16px'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <input
            type="checkbox"
            checked={selectedRecords.size === records.length && records.length > 0}
            onChange={handleSelectAll}
            style={{
              width: '18px',
              height: '18px',
              cursor: 'pointer'
            }}
          />
          
          <div>
            <div style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#1f2937'
            }}>
              {selectedRecords.size} kayıt seçildi
            </div>
            {selectedErrorCount > 0 && (
              <div style={{
                fontSize: '12px',
                color: '#dc2626'
              }}>
                {selectedErrorCount} hatalı
              </div>
            )}
          </div>
        </div>

        {selectedRecords.size > 0 && (
          <button
            onClick={() => onSelectionChange(new Set())}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #e5e7eb',
              background: 'white',
              color: '#374151',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            Temizle
          </button>
        )}
      </div>

      {/* Actions */}
      {selectedRecords.size > 0 && (
        <div style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap'
        }}>
          {canRetry && (
            <button
              onClick={handleRetrySelected}
              disabled={isProcessing}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                background: isProcessing ? '#9ca3af' : '#3b82f6',
                color: 'white',
                fontSize: '12px',
                fontWeight: 500,
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {isProcessing ? '⏳' : '🔄'}
              {selectedErrorCount} Hatalıyı Tekrar Dene
            </button>
          )}

          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={isProcessing}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: '1px solid #e5e7eb',
                background: 'white',
                color: '#374151',
                fontSize: '12px',
                fontWeight: 500,
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              📤 Dışa Aktar
              <span style={{ fontSize: '10px' }}>▼</span>
            </button>

            {showExportMenu && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '4px',
                background: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                zIndex: 1000,
                minWidth: '120px'
              }}>
                {(['excel', 'csv', 'pdf'] as const).map(format => (
                  <button
                    key={format}
                    onClick={() => handleExportSelected(format)}
                    style={{
                      padding: '8px 12px',
                      border: 'none',
                      background: 'white',
                      color: '#374151',
                      fontSize: '12px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = '#f3f4f6';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'white';
                    }}
                  >
                    {getExportIcon(format)}
                    {format.toUpperCase()}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleDeleteSelected}
            disabled={isProcessing}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid #dc2626',
              background: 'white',
              color: '#dc2626',
              fontSize: '12px',
              fontWeight: 500,
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            🗑️ Sil
          </button>
        </div>
      )}

      {/* Processing Overlay */}
      {isProcessing && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(255,255,255,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '12px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12px',
            color: '#374151'
          }}>
            <div style={{
              width: '16px',
              height: '16px',
              border: '2px solid #e5e7eb',
              borderTop: '2px solid #3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            İşleniyor...
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

function getExportIcon(format: string): string {
  const icons: Record<string, string> = {
    'excel': '📊',
    'csv': '📋',
    'pdf': '📄'
  };
  return icons[format] || '📄';
}
