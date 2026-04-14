import { useState, useEffect } from 'react';
import { WorkflowSourceFolder } from '../../../services/optiplanWorkflowService';

interface FilterState {
  status: string[];
  source: WorkflowSourceFolder[];
  dateRange: { start: string; end: string };
  hasErrors: boolean;
  searchText: string;
}

interface AdvancedFilterPanelProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  onReset: () => void;
}

const STATUS_OPTIONS = [
  { value: 'PHASE_1_OCR_HAVUZU', label: 'OCR Havuzu', color: '#2563eb' },
  { value: 'PHASE_2_OCR_KONTROL', label: 'OCR Kontrol', color: '#d97706' },
  { value: 'PHASE_3_SIPARIS_DUZENLEME', label: 'Sipariş Kontrol', color: '#7c3aed' },
  { value: 'PHASE_4_EXPORT', label: 'OptiPlanning', color: '#059669' },
  { value: 'HATA', label: 'Hata', color: '#dc2626' },
  { value: 'TAMAMLANDI', label: 'Tamamlandı', color: '#475569' }
];

const SOURCE_OPTIONS: Array<{ value: WorkflowSourceFolder; label: string; icon: string }> = [
  { value: 'manuel_raw', label: 'Manuel', icon: '📁' },
  { value: 'whatsapp_raw', label: 'WhatsApp', icon: '💬' },
  { value: 'scanner_raw', label: 'Tarayıcı', icon: '📷' },
  { value: 'email_raw', label: 'E-posta', icon: '📧' }
];

export const AdvancedFilterPanel: React.FC<AdvancedFilterPanelProps> = ({
  filters,
  onFiltersChange,
  onReset
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [tempFilters, setTempFilters] = useState(filters);

  useEffect(() => {
    setTempFilters(filters);
  }, [filters]);

  const handleStatusToggle = (status: string) => {
    const newStatus = tempFilters.status.includes(status)
      ? tempFilters.status.filter(s => s !== status)
      : [...tempFilters.status, status];
    
    setTempFilters({ ...tempFilters, status: newStatus });
  };

  const handleSourceToggle = (source: WorkflowSourceFolder) => {
    const newSource = tempFilters.source.includes(source)
      ? tempFilters.source.filter(s => s !== source)
      : [...tempFilters.source, source];
    
    setTempFilters({ ...tempFilters, source: newSource });
  };

  const handleApply = () => {
    onFiltersChange(tempFilters);
    setIsExpanded(false);
  };

  const handleReset = () => {
    const emptyFilters: FilterState = {
      status: [],
      source: [],
      dateRange: { start: '', end: '' },
      hasErrors: false,
      searchText: ''
    };
    setTempFilters(emptyFilters);
    onReset();
    setIsExpanded(false);
  };

  const hasActiveFilters = 
    filters.status.length > 0 ||
    filters.source.length > 0 ||
    filters.dateRange.start ||
    filters.dateRange.end ||
    filters.hasErrors ||
    filters.searchText;

  return (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      border: '1px solid #e5e7eb',
      marginBottom: '16px',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div
        style={{
          padding: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          background: isExpanded ? '#f9fafb' : 'white'
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '18px' }}>🔍</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: '14px', color: '#1f2937' }}>
              Gelişmiş Filtreler
            </div>
            {hasActiveFilters && (
              <div style={{ fontSize: '12px', color: '#3b82f6' }}>
                {[
                  filters.status.length && `${filters.status.length} status`,
                  filters.source.length && `${filters.source.length} kaynak`,
                  filters.hasErrors && 'hatalı',
                  filters.searchText && 'arama'
                ].filter(Boolean).join(', ')} aktif
              </div>
            )}
          </div>
        </div>
        
        <div style={{
          fontSize: '12px',
          color: '#6b7280',
          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s'
        }}>
          ▼
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div style={{
          padding: '16px',
          borderTop: '1px solid #e5e7eb',
          background: '#f9fafb'
        }}>
          {/* Status Filter */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 600,
              color: '#374151',
              marginBottom: '8px'
            }}>
              Durum
            </label>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px'
            }}>
              {STATUS_OPTIONS.map(option => (
                <button
                  key={option.value}
                  onClick={() => handleStatusToggle(option.value)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '16px',
                    border: `2px solid ${tempFilters.status.includes(option.value) ? option.color : '#e5e7eb'}`,
                    background: tempFilters.status.includes(option.value) ? option.color : 'white',
                    color: tempFilters.status.includes(option.value) ? 'white' : '#374151',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Source Filter */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 600,
              color: '#374151',
              marginBottom: '8px'
            }}>
              Kaynak
            </label>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px'
            }}>
              {SOURCE_OPTIONS.map(option => (
                <button
                  key={option.value}
                  onClick={() => handleSourceToggle(option.value)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '16px',
                    border: `2px solid ${tempFilters.source.includes(option.value) ? '#3b82f6' : '#e5e7eb'}`,
                    background: tempFilters.source.includes(option.value) ? '#3b82f6' : 'white',
                    color: tempFilters.source.includes(option.value) ? 'white' : '#374151',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span>{option.icon}</span>
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 600,
              color: '#374151',
              marginBottom: '8px'
            }}>
              Tarih Aralığı
            </label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px'
            }}>
              <input
                type="date"
                value={tempFilters.dateRange.start}
                onChange={(e) => setTempFilters({
                  ...tempFilters,
                  dateRange: { ...tempFilters.dateRange, start: e.target.value }
                })}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '12px'
                }}
                placeholder="Başlangıç"
              />
              <input
                type="date"
                value={tempFilters.dateRange.end}
                onChange={(e) => setTempFilters({
                  ...tempFilters,
                  dateRange: { ...tempFilters.dateRange, end: e.target.value }
                })}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '12px'
                }}
                placeholder="Bitiş"
              />
            </div>
          </div>

          {/* Error Toggle */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer'
            }}>
              <input
                type="checkbox"
                checked={tempFilters.hasErrors}
                onChange={(e) => setTempFilters({
                  ...tempFilters,
                  hasErrors: e.target.checked
                })}
                style={{
                  width: '16px',
                  height: '16px',
                  cursor: 'pointer'
                }}
              />
              <span style={{
                fontSize: '12px',
                fontWeight: 500,
                color: '#374151'
              }}>
                Sadece hatalı kayıtları göster
              </span>
            </label>
          </div>

          {/* Actions */}
          <div style={{
            display: 'flex',
            gap: '8px',
            justifyContent: 'flex-end'
          }}>
            <button
              onClick={handleReset}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: '1px solid #e5e7eb',
                background: 'white',
                color: '#374151',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              Sıfırla
            </button>
            <button
              onClick={handleApply}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                background: '#3b82f6',
                color: 'white',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              Uygula
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
