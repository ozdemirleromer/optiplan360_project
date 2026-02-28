/**
 * Spotlight Search Component
 * Ctrl+K ile açılan global arama overlay'i
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, FileText, Package, Users, Settings, BarChart3, Bot, Briefcase, ArrowRight, TrendingUp, Cpu, Factory, Workflow, Activity, Globe, MessageCircle } from 'lucide-react';
import { COLORS, RADIUS, TYPOGRAPHY, SHADOWS } from '../Shared/constants';

interface SpotlightResult {
  id: string;
  type: 'page' | 'order' | 'customer' | 'action' | 'recent';
  title: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  shortcut?: string;
}

interface SpotlightSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (page: string) => void;
}

const PAGE_RESULTS: SpotlightResult[] = [
  { id: 'p-dashboard', type: 'page', title: 'Gösterge Paneli', description: 'Ana sayfa', icon: <BarChart3 size={18} />, action: () => {}, shortcut: 'Ctrl+1' },
  { id: 'p-orders', type: 'page', title: 'Siparişler', description: 'Sipariş yönetimi', icon: <Package size={18} />, action: () => {}, shortcut: 'Ctrl+2' },
  { id: 'p-kanban', type: 'page', title: 'Akış Panoları', description: 'Kanban board', icon: <Workflow size={18} />, action: () => {} },
  { id: 'p-card-management', type: 'page', title: 'Müşteri Yönetimi', description: 'Cari ve stok kartları yönetimi', icon: <Briefcase size={18} />, action: () => {}, shortcut: 'Ctrl+3' },
  { id: 'p-reports-analytics', type: 'page', title: 'Raporlar & Analitik', description: 'Performans raporları ve metrikler', icon: <BarChart3 size={18} />, action: () => {}, shortcut: 'Ctrl+4' },
  { id: 'p-price-tracking', type: 'page', title: 'Fiyat Takip', description: 'Fiyat değişim takibi', icon: <TrendingUp size={18} />, action: () => {} },
  { id: 'p-ai-assistant', type: 'page', title: 'AI Asistan', description: 'Yapay zeka asistanı', icon: <Bot size={18} />, action: () => {} },
  { id: 'p-orchestrator', type: 'page', title: 'OptiPlanning Jobs', description: 'Kesim optimizasyonu iş takibi', icon: <Cpu size={18} />, action: () => {} },
  { id: 'p-product-search', type: 'page', title: 'Ürün Arama', description: 'Spec-first ürün ve malzeme arama', icon: <Search size={18} />, action: () => {} },
  { id: 'p-stations', type: 'page', title: 'İstasyonlar', description: 'Üretim istasyonları', icon: <Factory size={18} />, action: () => {} },
  { id: 'p-system-logs', type: 'page', title: 'Sistem Günlükleri', description: 'Loglar ve denetim kayıtları', icon: <FileText size={18} />, action: () => {} },
  { id: 'p-integration-health', type: 'page', title: 'Entegrasyon Durumu', description: 'Sistem sağlık durumu', icon: <Activity size={18} />, action: () => {} },
  { id: 'p-user-activity', type: 'page', title: 'Kullanıcı Aktivitesi', description: 'Kullanıcı hareketleri', icon: <Users size={18} />, action: () => {} },
  { id: 'p-user-management', type: 'page', title: 'Kullanıcı Yönetimi', description: 'Kullanıcılar, roller ve yetkiler', icon: <Users size={18} />, action: () => {} },
  { id: 'p-integrations', type: 'page', title: 'Entegrasyonlar', description: 'Sistem entegrasyonları', icon: <Settings size={18} />, action: () => {} },
  { id: 'p-whatsapp-business', type: 'page', title: 'WhatsApp Business', description: 'WhatsApp entegrasyonu', icon: <MessageCircle size={18} />, action: () => {} },
  { id: 'p-config', type: 'page', title: 'Sistem Ayarları', description: 'Genel ayarlar', icon: <Settings size={18} />, action: () => {} },
  { id: 'p-workflows', type: 'page', title: 'Otomasyonlar', description: 'İş akışı otomasyonları', icon: <Workflow size={18} />, action: () => {} },
  { id: 'p-api-portal', type: 'page', title: 'API Portal', description: 'API yönetim portalı', icon: <Globe size={18} />, action: () => {} },
  { id: 'p-ai-config', type: 'page', title: 'AI Konfigürasyon', description: 'AI model ayarları', icon: <Settings size={18} />, action: () => {} },
  { id: 'p-organization', type: 'page', title: 'Organizasyon', description: 'Organizasyon yönetimi', icon: <Users size={18} />, action: () => {} },
];

const ACTION_RESULTS: SpotlightResult[] = [
  { id: 'a-new-order', type: 'action', title: 'Yeni Sipariş Oluştur', description: 'Sipariş editörünü aç', icon: <Package size={18} />, action: () => {}, shortcut: 'Ctrl+N' },
  { id: 'a-refresh', type: 'action', title: 'Sayfayı Yenile', description: 'Verileri tazele', icon: <ArrowRight size={18} />, action: () => {}, shortcut: 'Ctrl+R' },
];

export const SpotlightSearch = ({ isOpen, onClose, onNavigate }: SpotlightSearchProps) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load recent searches
  useEffect(() => {
    try {
      const saved = localStorage.getItem('optiplan-recent-searches');
      if (saved) setRecentSearches(JSON.parse(saved));
    } catch { /* localStorage okuma hatası görmezden geliniyor */ }
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Save recent search
  const saveRecentSearch = useCallback((term: string) => {
    if (!term.trim()) return;
    const updated = [term, ...recentSearches.filter(s => s !== term)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('optiplan-recent-searches', JSON.stringify(updated));
  }, [recentSearches]);

  // Filter results
  const filteredResults = query.trim()
    ? [...PAGE_RESULTS, ...ACTION_RESULTS].filter(r =>
        r.title.toLowerCase().includes(query.toLowerCase()) ||
        (r.description?.toLowerCase().includes(query.toLowerCase()))
      )
    : PAGE_RESULTS.slice(0, 5);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredResults.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && filteredResults[selectedIndex]) {
        e.preventDefault();
        const result = filteredResults[selectedIndex];
        saveRecentSearch(result.title);
        
        // Navigate based on result type
        const pageId = result.id.replace('p-', '').replace('a-new-', 'order-editor');
        if (result.id === 'a-refresh') {
          window.location.reload();
        } else if (result.id === 'a-new-order') {
          onNavigate('order-editor');
        } else {
          onNavigate(pageId);
        }
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredResults, selectedIndex, onClose, onNavigate, saveRecentSearch]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
          zIndex: 9998,
          animation: 'fade-in 0.15s ease',
        }}
      />

      {/* Spotlight Modal */}
      <div
        style={{
          position: 'fixed',
          top: '15%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: 560,
          zIndex: 9999,
          animation: 'fade-in-down 0.2s ease',
        }}
      >
        <div
          style={{
            background: COLORS.bg.elevated || COLORS.bg.surface,
            borderRadius: RADIUS.xl,
            border: `1px solid ${COLORS.border}`,
            boxShadow: SHADOWS.xl,
            overflow: 'hidden',
          }}
        >
          {/* Search Input */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '16px 20px',
              borderBottom: `1px solid ${COLORS.border}`,
            }}
          >
            <Search size={20} style={{ color: COLORS.primary.DEFAULT, flexShrink: 0 }} />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              placeholder="Sayfa, sipariş veya işlem ara..."
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: COLORS.text,
                fontSize: 16,
                fontFamily: TYPOGRAPHY.fontFamily.base,
              }}
              autoComplete="off"
              spellCheck={false}
            />
            <div
              style={{
                padding: '4px 8px',
                borderRadius: 6,
                border: `1px solid ${COLORS.border}`,
                fontSize: 11,
                color: COLORS.muted,
                fontWeight: 600,
              }}
            >
              ESC
            </div>
          </div>

          {/* Recent Searches */}
          {!query.trim() && recentSearches.length > 0 && (
            <div style={{ padding: '8px 12px' }}>
              <div style={{ fontSize: 11, color: COLORS.muted, fontWeight: 600, padding: '4px 8px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Son Aramalar
              </div>
              {recentSearches.map((term, i) => (
                <button
                  key={i}
                  onClick={() => setQuery(term)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    padding: '8px 12px',
                    background: 'transparent',
                    border: 'none',
                    color: COLORS.muted,
                    cursor: 'pointer',
                    borderRadius: RADIUS.md,
                    fontSize: 13,
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = `${COLORS.primary.DEFAULT}15`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <Search size={14} style={{ opacity: 0.5 }} />
                  {term}
                </button>
              ))}
            </div>
          )}

          {/* Results */}
          <div style={{ maxHeight: 360, overflowY: 'auto', padding: '8px 12px' }}>
            {!query.trim() && (
              <div style={{ fontSize: 11, color: COLORS.muted, fontWeight: 600, padding: '4px 8px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Hızlı Erişim
              </div>
            )}

            {filteredResults.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: COLORS.muted, fontSize: 14 }}>
                "{query}" için sonuç bulunamadı
              </div>
            )}

            {filteredResults.map((result, index) => (
              <button
                key={result.id}
                onClick={() => {
                  saveRecentSearch(result.title);
                  const pageId = result.id.replace('p-', '').replace('a-new-', 'order-editor');
                  if (result.id === 'a-refresh') {
                    window.location.reload();
                  } else if (result.id === 'a-new-order') {
                    onNavigate('order-editor');
                  } else {
                    onNavigate(pageId);
                  }
                  onClose();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  width: '100%',
                  padding: '10px 12px',
                  background: selectedIndex === index ? `${COLORS.primary.DEFAULT}15` : 'transparent',
                  border: selectedIndex === index ? `1px solid ${COLORS.primary.DEFAULT}30` : '1px solid transparent',
                  borderRadius: RADIUS.md,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  textAlign: 'left',
                  color: COLORS.text,
                }}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: RADIUS.md,
                  background: `${COLORS.primary.DEFAULT}15`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: COLORS.primary.DEFAULT,
                  flexShrink: 0,
                }}>
                  {result.icon}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{result.title}</div>
                  {result.description && (
                    <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>{result.description}</div>
                  )}
                </div>

                {result.shortcut && (
                  <div style={{
                    padding: '3px 8px',
                    borderRadius: 6,
                    border: `1px solid ${COLORS.border}`,
                    fontSize: 11,
                    color: COLORS.muted,
                    fontWeight: 500,
                    flexShrink: 0,
                  }}>
                    {result.shortcut}
                  </div>
                )}

                {selectedIndex === index && (
                  <ArrowRight size={14} style={{ color: COLORS.primary.DEFAULT, flexShrink: 0 }} />
                )}
              </button>
            ))}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '10px 20px',
              borderTop: `1px solid ${COLORS.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 11,
              color: COLORS.muted,
            }}
          >
            <div style={{ display: 'flex', gap: 16 }}>
              <span>↑↓ Gezin</span>
              <span>↵ Seç</span>
              <span>ESC Kapat</span>
            </div>
            <span>Optiplan360 Arama</span>
          </div>
        </div>
      </div>
    </>
  );
};

export default SpotlightSearch;
