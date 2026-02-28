/**
 * API Portal Component
 * REST API dokümantasyonu ve test arayüzü
 */

import { useState } from 'react';
import {
  Copy, ChevronDown, ChevronRight, Check,
  Lock, Clock
} from 'lucide-react';
import { COLORS, RADIUS, TYPOGRAPHY } from '../Shared/constants';
import { TopBar } from '../Layout/TopBar';

interface APIEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  description: string;
  auth: boolean;
  params?: { name: string; type: string; required: boolean; description: string }[];
  responseExample?: string;
  category: string;
}

const METHOD_COLORS: Record<string, string> = {
  GET: '#22c55e',
  POST: '#3b82f6',
  PUT: '#f59e0b',
  DELETE: '#ef4444',
  PATCH: '#8b5cf6',
};

const API_ENDPOINTS: APIEndpoint[] = [
  // Orders
  {
    method: 'GET', path: '/api/v1/orders', description: 'Tüm siparişleri listele', auth: true, category: 'Siparişler',
    params: [
      { name: 'status', type: 'string', required: false, description: 'Durum filtresi (NEW, IN_PRODUCTION, READY, DELIVERED)' },
      { name: 'page', type: 'number', required: false, description: 'Sayfa numarası' },
      { name: 'limit', type: 'number', required: false, description: 'Sayfa başına kayıt (varsayılan: 20)' },
      { name: 'search', type: 'string', required: false, description: 'Arama terimi' },
    ],
    responseExample: '{\n  "items": [...],\n  "total": 245,\n  "page": 1,\n  "limit": 20\n}',
  },
  {
    method: 'POST', path: '/api/v1/orders', description: 'Yeni sipariş oluştur', auth: true, category: 'Siparişler',
    params: [
      { name: 'customer_id', type: 'string', required: true, description: 'Müşteri ID' },
      { name: 'items', type: 'array', required: true, description: 'Sipariş kalemleri' },
      { name: 'priority', type: 'string', required: false, description: 'Öncelik (LOW, NORMAL, HIGH, URGENT)' },
    ],
  },
  { method: 'GET', path: '/api/v1/orders/{id}', description: 'Sipariş detayı', auth: true, category: 'Siparişler' },
  { method: 'PUT', path: '/api/v1/orders/{id}', description: 'Siparişi güncelle', auth: true, category: 'Siparişler' },
  { method: 'DELETE', path: '/api/v1/orders/{id}', description: 'Siparişi sil', auth: true, category: 'Siparişler' },
  { method: 'PATCH', path: '/api/v1/orders/{id}/status', description: 'Sipariş durumunu değiştir', auth: true, category: 'Siparişler' },

  // Stations
  { method: 'GET', path: '/api/v1/stations', description: 'Tüm istasyonları listele', auth: true, category: 'İstasyonlar' },
  { method: 'POST', path: '/api/v1/stations/{id}/test', description: 'İstasyon bağlantısını test et', auth: true, category: 'İstasyonlar' },
  { method: 'GET', path: '/api/v1/stations/{id}/detail', description: 'İstasyon detayları', auth: true, category: 'İstasyonlar' },

  // CRM
  { method: 'GET', path: '/api/v1/crm/accounts', description: 'Müşteri hesaplarını listele', auth: true, category: 'CRM' },
  { method: 'POST', path: '/api/v1/crm/accounts', description: 'Yeni müşteri oluştur', auth: true, category: 'CRM' },
  { method: 'GET', path: '/api/v1/crm/opportunities', description: 'Fırsatları listele', auth: true, category: 'CRM' },

  // Stock
  { method: 'GET', path: '/api/v1/stock/stock-cards', description: 'Stok kartlarını listele', auth: true, category: 'Stok' },
  {
    method: 'GET', path: '/api/v1/stock/stock-cards/search', description: 'Stok ara', auth: true, category: 'Stok',
    params: [{ name: 'q', type: 'string', required: true, description: 'Arama terimi' }],
  },

  // Auth
  {
    method: 'POST', path: '/api/v1/auth/login', description: 'Kullanıcı girişi', auth: false, category: 'Kimlik Doğrulama',
    params: [
      { name: 'email', type: 'string', required: true, description: 'E-posta adresi' },
      { name: 'password', type: 'string', required: true, description: 'Şifre' },
    ],
    responseExample: '{\n  "access_token": "eyJ...",\n  "refresh_token": "eyJ...",\n  "token_type": "bearer"\n}',
  },
  { method: 'POST', path: '/api/v1/auth/refresh', description: 'Token yenile', auth: true, category: 'Kimlik Doğrulama' },
  { method: 'POST', path: '/api/v1/auth/logout', description: 'Oturumu kapat', auth: true, category: 'Kimlik Doğrulama' },

  // Admin
  { method: 'GET', path: '/api/v1/admin/logs', description: 'Sistem loglarını listele', auth: true, category: 'Yönetim' },
  { method: 'GET', path: '/api/v1/admin/users', description: 'Kullanıcıları listele', auth: true, category: 'Yönetim' },
  { method: 'GET', path: '/api/v1/admin/audit', description: 'Denetim kayıtları', auth: true, category: 'Yönetim' },

  // Export
  { method: 'GET', path: '/api/v1/export/orders/csv', description: 'Siparişleri CSV olarak dışa aktar', auth: true, category: 'Dışa Aktarma' },
  { method: 'GET', path: '/api/v1/export/orders/excel', description: 'Siparişleri Excel olarak dışa aktar', auth: true, category: 'Dışa Aktarma' },

  // Webhooks
  { method: 'GET', path: '/api/v1/webhooks', description: 'Webhook\'ları listele', auth: true, category: 'Webhooks' },
  {
    method: 'POST', path: '/api/v1/webhooks', description: 'Yeni webhook oluştur', auth: true, category: 'Webhooks',
    params: [
      { name: 'url', type: 'string', required: true, description: 'Webhook URL' },
      { name: 'events', type: 'array', required: true, description: 'Tetikleyici olaylar' },
      { name: 'secret', type: 'string', required: false, description: 'HMAC imzalama anahtarı' },
    ],
  },
];

export const ApiPortal = () => {
  const [expandedEndpoint, setExpandedEndpoint] = useState<string | null>(null);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('Tümü');

  const categories = ['Tümü', ...Array.from(new Set(API_ENDPOINTS.map(e => e.category)))];
  const filtered = selectedCategory === 'Tümü' ? API_ENDPOINTS : API_ENDPOINTS.filter(e => e.category === selectedCategory);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPath(text);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  const toggleEndpoint = (key: string) => {
    setExpandedEndpoint(prev => prev === key ? null : key);
  };

  return (
    <div className="electric-page">
      <TopBar
        title="API Portal"
        subtitle="REST API dokumantasyonu ve test arayuzu"
        breadcrumbs={["Yonetim", "API Portal"]}
      />
      <div className="app-page-container">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: COLORS.text, fontFamily: TYPOGRAPHY.fontFamily.heading }}>
              🔌 API Portal
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: COLORS.muted }}>
              REST API dokümantasyonu ve test arayüzü
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{
              padding: '6px 12px', borderRadius: RADIUS.md,
              background: `${COLORS.success.DEFAULT}15`, color: COLORS.success.DEFAULT,
              fontSize: 12, fontWeight: 600,
            }}>
              v1.0 Aktif
            </div>
            <div style={{
              padding: '6px 12px', borderRadius: RADIUS.md,
              background: `${COLORS.info.DEFAULT}15`, color: COLORS.info.DEFAULT,
              fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <Clock size={12} />
              1000 req/saat
            </div>
          </div>
        </div>

        {/* Auth Info */}
        <div style={{
          padding: 16, borderRadius: RADIUS.lg,
          border: `1px solid ${COLORS.info.DEFAULT}30`,
          background: `${COLORS.info.DEFAULT}08`,
          marginBottom: 24,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <Lock size={18} style={{ color: COLORS.info.DEFAULT, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>Kimlik Doğrulama</div>
            <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>
              Tüm istekler <code style={{ background: `${COLORS.bg.main}`, padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>
                Authorization: Bearer &lt;token&gt;</code> header'ı gerektirir.
            </div>
          </div>
        </div>

        {/* Category Tabs */}
        <div style={{ display: "flex", gap: "2px", marginBottom: "24px", borderBottom: `1px solid ${COLORS.border}`, flexWrap: "wrap" }}>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "12px 24px",
                fontSize: 14,
                fontWeight: selectedCategory === cat ? 700 : 400,
                color: selectedCategory === cat ? COLORS.primary.DEFAULT : COLORS.muted,
                background: selectedCategory === cat ? `${COLORS.primary.DEFAULT}08` : "transparent",
                border: "none",
                borderBottom: selectedCategory === cat ? `3px solid ${COLORS.primary.DEFAULT}` : "3px solid transparent",
                cursor: "pointer",
                fontFamily: TYPOGRAPHY.fontFamily.base,
                marginBottom: "-1px",
                transition: "all 0.2s",
                whiteSpace: "nowrap",
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Endpoints */}
        <div style={{ display: 'grid', gap: 8 }}>
          {filtered.map((endpoint) => {
            const key = `${endpoint.method}-${endpoint.path}`;
            const isExpanded = expandedEndpoint === key;

            return (
              <div key={key} style={{
                borderRadius: RADIUS.lg,
                border: `1px solid ${isExpanded ? COLORS.primary.DEFAULT + '40' : COLORS.border}`,
                background: COLORS.bg.surface,
                overflow: 'hidden',
                transition: 'all 0.2s',
              }}>
                {/* Endpoint Header */}
                <button
                  onClick={() => toggleEndpoint(key)}
                  style={{
                    width: '100%', padding: '12px 16px',
                    display: 'flex', alignItems: 'center', gap: 12,
                    background: 'transparent', border: 'none',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  {isExpanded ? <ChevronDown size={14} style={{ color: COLORS.muted }} /> : <ChevronRight size={14} style={{ color: COLORS.muted }} />}

                  <span style={{
                    padding: '3px 10px', borderRadius: 6,
                    background: `${METHOD_COLORS[endpoint.method]}20`,
                    color: METHOD_COLORS[endpoint.method],
                    fontSize: 11, fontWeight: 700, fontFamily: 'monospace',
                    minWidth: 52, textAlign: 'center',
                  }}>
                    {endpoint.method}
                  </span>

                  <code style={{ fontSize: 13, fontWeight: 500, color: COLORS.text, fontFamily: 'monospace' }}>
                    {endpoint.path}
                  </code>

                  <span style={{ flex: 1, fontSize: 12, color: COLORS.muted, marginLeft: 8 }}>
                    {endpoint.description}
                  </span>

                  {endpoint.auth && <Lock size={12} style={{ color: COLORS.muted }} />}

                  <button
                    onClick={(e) => { e.stopPropagation(); copyToClipboard(endpoint.path); }}
                    style={{ background: 'none', border: 'none', color: COLORS.muted, cursor: 'pointer', padding: 4 }}
                    title="Kopyala"
                  >
                    {copiedPath === endpoint.path ? <Check size={14} style={{ color: COLORS.success.DEFAULT }} /> : <Copy size={14} />}
                  </button>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div style={{ padding: '0 16px 16px', borderTop: `1px solid ${COLORS.border}` }}>
                    {/* Parameters */}
                    {endpoint.params && endpoint.params.length > 0 && (
                      <div style={{ marginTop: 16 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.text, marginBottom: 8 }}>Parametreler</div>
                        <div style={{
                          borderRadius: RADIUS.md, border: `1px solid ${COLORS.border}`,
                          overflow: 'hidden',
                        }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                              <tr style={{ background: COLORS.bg.main }}>
                                <th style={{ padding: '8px 12px', textAlign: 'left', color: COLORS.muted, fontWeight: 600 }}>İsim</th>
                                <th style={{ padding: '8px 12px', textAlign: 'left', color: COLORS.muted, fontWeight: 600 }}>Tip</th>
                                <th style={{ padding: '8px 12px', textAlign: 'left', color: COLORS.muted, fontWeight: 600 }}>Zorunlu</th>
                                <th style={{ padding: '8px 12px', textAlign: 'left', color: COLORS.muted, fontWeight: 600 }}>Açıklama</th>
                              </tr>
                            </thead>
                            <tbody>
                              {endpoint.params.map(param => (
                                <tr key={param.name} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                                  <td style={{ padding: '8px 12px' }}>
                                    <code style={{ color: COLORS.primary.DEFAULT, fontFamily: 'monospace', fontSize: 12 }}>{param.name}</code>
                                  </td>
                                  <td style={{ padding: '8px 12px', color: COLORS.muted }}>{param.type}</td>
                                  <td style={{ padding: '8px 12px' }}>
                                    {param.required ? (
                                      <span style={{ color: COLORS.danger.DEFAULT, fontWeight: 600 }}>Evet</span>
                                    ) : (
                                      <span style={{ color: COLORS.muted }}>Hayır</span>
                                    )}
                                  </td>
                                  <td style={{ padding: '8px 12px', color: COLORS.text }}>{param.description}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Response Example */}
                    {endpoint.responseExample && (
                      <div style={{ marginTop: 16 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.text, marginBottom: 8 }}>Yanıt Örneği</div>
                        <pre style={{
                          padding: 12, borderRadius: RADIUS.md,
                          background: COLORS.bg.main, border: `1px solid ${COLORS.border}`,
                          fontSize: 12, color: COLORS.success.DEFAULT,
                          fontFamily: 'monospace', overflow: 'auto',
                          margin: 0,
                        }}>
                          {endpoint.responseExample}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Stats */}
        <div style={{
          marginTop: 24, padding: 16, borderRadius: RADIUS.lg,
          border: `1px solid ${COLORS.border}`, background: COLORS.bg.surface,
          display: 'flex', justifyContent: 'space-around', textAlign: 'center',
        }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.primary.DEFAULT }}>{API_ENDPOINTS.length}</div>
            <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 4 }}>Toplam Endpoint</div>
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.success.DEFAULT }}>{categories.length - 1}</div>
            <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 4 }}>Kategori</div>
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.warning.DEFAULT }}>Bearer</div>
            <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 4 }}>Auth Tipi</div>
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.info.DEFAULT }}>1000/h</div>
            <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 4 }}>Rate Limit</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiPortal;
