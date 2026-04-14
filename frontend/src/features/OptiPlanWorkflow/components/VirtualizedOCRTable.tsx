import { FixedSizeList as List } from 'react-window';
import { WorkflowRecord } from '../../../services/optiplanWorkflowService';

interface VirtualizedOCRTableProps {
  records: WorkflowRecord[];
  onRetry: (uuid: string) => void;
  retryingUuids: Set<string>;
}

const RowRenderer = ({ index, style, data }: { 
  index: number; 
  style: React.CSSProperties; 
  data: VirtualizedOCRTableProps 
}) => {
  const record = data.records[index];
  const isRetrying = data.retryingUuids.has(record.uuid);

  return (
    <div style={{
      ...style,
      borderBottom: '1px solid #e5e7eb',
      padding: '12px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      background: isRetrying ? '#fef3c7' : 'white'
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: '14px' }}>
          {record.fileName || 'Bilinmeyen Dosya'}
        </div>
        <div style={{ fontSize: '12px', color: '#6b7280' }}>
          {record.sourceFolder} • {formatDate(record.createdAt)}
        </div>
      </div>
      
      <div style={{
        padding: '4px 12px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: 600,
        background: getStatusColor(record.status),
        color: 'white'
      }}>
        {getStatusLabel(record.status)}
      </div>
      
      {record.status === 'HATA' && (
        <button
          onClick={() => data.onRetry(record.uuid)}
          disabled={isRetrying}
          style={{
            padding: '6px 12px',
            borderRadius: '6px',
            border: 'none',
            background: isRetrying ? '#9ca3af' : '#3b82f6',
            color: 'white',
            fontSize: '12px',
            cursor: isRetrying ? 'not-allowed' : 'pointer'
          }}
        >
          {isRetrying ? 'Yeniden deneniyor...' : 'Tekrar Dene'}
        </button>
      )}
    </div>
  );
};

export const VirtualizedOCRTable: React.FC<VirtualizedOCRTableProps> = (props) => {
  return (
    <div style={{ height: '600px', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
      <List
        height={600}
        itemCount={props.records.length}
        itemSize={80}
        itemData={props}
      >
        {RowRenderer}
      </List>
    </div>
  );
};

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    'PHASE_1_OCR_HAVUZU': '#2563eb',
    'PHASE_2_OCR_KONTROL': '#d97706',
    'PHASE_3_SIPARIS_DUZENLEME': '#7c3aed',
    'PHASE_4_EXPORT': '#059669',
    'HATA': '#dc2626',
    'TAMAMLANDI': '#475569'
  };
  return colors[status] || '#6b7280';
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    'PHASE_1_OCR_HAVUZU': 'OCR Havuzu',
    'PHASE_2_OCR_KONTROL': 'OCR Kontrol',
    'PHASE_3_SIPARIS_DUZENLEME': 'Sipariş Kontrol',
    'PHASE_4_EXPORT': 'OptiPlanning',
    'HATA': 'Yazım Hatası',
    'TAMAMLANDI': 'Tamamlandı'
  };
  return labels[status] || status;
}
