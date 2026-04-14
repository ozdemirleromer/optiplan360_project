import { WorkflowRecord } from '../../../services/optiplanWorkflowService';

interface MobileOCRCardProps {
  record: WorkflowRecord;
  onRetry: (uuid: string) => void;
  onSwipeLeft?: (record: WorkflowRecord) => void;
  onSwipeRight?: (record: WorkflowRecord) => void;
  isRetrying: boolean;
}

export const MobileOCRCard: React.FC<MobileOCRCardProps> = ({
  record,
  onRetry,
  onSwipeLeft,
  onSwipeRight,
  isRetrying
}) => {
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(0);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && onSwipeLeft) {
      onSwipeLeft(record);
    }
    if (isRightSwipe && onSwipeRight) {
      onSwipeRight(record);
    }
  };

  return (
    <div
      style={{
        background: 'white',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        border: '1px solid #e5e7eb',
        touchAction: 'pan-y'
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '12px'
      }}>
        <div style={{ flex: 1, marginRight: '12px' }}>
          <div style={{
            fontSize: '16px',
            fontWeight: 600,
            color: '#1f2937',
            marginBottom: '4px',
            wordBreak: 'break-word'
          }}>
            {record.fileName || 'Bilinmeyen Dosya'}
          </div>
          <div style={{
            fontSize: '12px',
            color: '#6b7280',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span>{getSourceIcon(record.sourceFolder)}</span>
            <span>{getSourcelabel(record.sourceFolder)}</span>
            <span>•</span>
            <span>{formatDate(record.createdAt)}</span>
          </div>
        </div>
        
        <div style={{
          padding: '6px 12px',
          borderRadius: '20px',
          fontSize: '12px',
          fontWeight: 600,
          background: getStatusColor(record.status),
          color: 'white',
          whiteSpace: 'nowrap'
        }}>
          {getStatusLabel(record.status)}
        </div>
      </div>

      {/* Content */}
      {record.errorText && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '12px'
        }}>
          <div style={{
            fontSize: '12px',
            color: '#dc2626',
            fontWeight: 500,
            marginBottom: '4px'
          }}>
            ⚠️ Hata Mesajı
          </div>
          <div style={{
            fontSize: '11px',
            color: '#991b1b',
            lineHeight: '1.4'
          }}>
            {record.errorText}
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{
        display: 'flex',
        gap: '8px',
        justifyContent: 'flex-end'
      }}>
        {record.status === 'HATA' && (
          <button
            onClick={() => onRetry(record.uuid)}
            disabled={isRetrying}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: isRetrying ? '#9ca3af' : '#3b82f6',
              color: 'white',
              fontSize: '14px',
              fontWeight: 500,
              cursor: isRetrying ? 'not-allowed' : 'pointer',
              minHeight: '44px',
              minWidth: '44px'
            }}
          >
            {isRetrying ? '⏳' : '🔄 Tekrar Dene'}
          </button>
        )}
        
        <button
          onClick={() => {
            // View details
          }}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: '1px solid #d1d5db',
            background: 'white',
            color: '#374151',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
            minHeight: '44px',
            minWidth: '44px'
          }}
        >
          📄 Detaylar
        </button>
      </div>

      {/* Swipe Hints */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: '8px',
        fontSize: '10px',
        color: '#9ca3af'
      }}>
        {onSwipeRight && <span>↩️ Geri</span>}
        <span></span>
        {onSwipeLeft && <span>↪️ İleri</span>}
      </div>
    </div>
  );
};

function getSourceIcon(source: string): string {
  const icons: Record<string, string> = {
    'manuel_raw': '📁',
    'whatsapp_raw': '💬',
    'scanner_raw': '📷',
    'email_raw': '📧'
  };
  return icons[source] || '📄';
}

function getSourcelabel(source: string): string {
  const labels: Record<string, string> = {
    'manuel_raw': 'Manuel',
    'whatsapp_raw': 'WhatsApp',
    'scanner_raw': 'Tarayıcı',
    'email_raw': 'E-posta'
  };
  return labels[source] || source;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Az önce';
  if (diffMins < 60) return `${diffMins} dakika önce`;
  if (diffHours < 24) return `${diffHours} saat önce`;
  if (diffDays < 7) return `${diffDays} gün önce`;
  
  return date.toLocaleDateString('tr-TR');
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
    'HATA': 'Hata',
    'TAMAMLANDI': 'Tamamlandı'
  };
  return labels[status] || status;
}
