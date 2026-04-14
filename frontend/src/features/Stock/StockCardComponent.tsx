import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, AlertCircle, Package, TrendingDown, Calendar, Plus, X } from 'lucide-react';
import { apiRequest } from '../../services/apiClient';
import { integrationService, type EntityMap, type OutboxItem } from '../../services/integrationService';
import { COLORS, RADIUS, TYPOGRAPHY, primaryRgba } from '../../components/Shared/constants';

// NOT: apiClient.ts transformKeys() tüm API yanıtlarını camelCase'e çevirir.
interface StockCard {
  id: string;
  stockCode: string;
  stockName: string;
  unit: string;
  purchasePrice: number | null;
  salePrice: number | null;
  totalQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  thickness: string | null;
  color: string | null;
  warehouseLocation: string | null;
  isActive: boolean;
  lastSyncDate: string | null;
}

interface StockMovement {
  id: string;
  movementType: string;
  quantity: number;
  unitPrice: number | null;
  totalAmount: number | null;
  movementDate: string;
  referenceDocument: string | null;
  referenceId: string | null;
  description: string | null;
}

interface Barkod {
  id: string;
  barcode: string;
}

interface SatisFiyati {
  id: string;
  priceType: string;
  amount: number;
}

interface StockCardDetailResponse {
  id: string;
  stockCode: string;
  stockName: string;
  purchasePrice: number | null;
  salePrice: number | null;
  totalQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  thickness: string | null;
  color: string | null;
  warehouseLocation: string | null;
  unit: string;
  isActive: boolean;
  lastSyncDate: string | null;
  barkodlar: Barkod[];
  satisFiyatlari: SatisFiyati[];
  movements: StockMovement[];
}

interface BarkodRow { barcode: string }
interface SatisFiyatRow { price_type: string; amount: string }

interface NewStockCardForm {
  stock_code: string;
  stock_name: string;
  unit: string;
  purchase_price: string;
  sale_price: string;
  total_quantity: string;
  thickness: string;
  color: string;
  warehouse_location: string;
}

const EMPTY_FORM: NewStockCardForm = {
  stock_code: '',
  stock_name: '',
  unit: 'ADET',
  purchase_price: '',
  sale_price: '',
  total_quantity: '0',
  thickness: '',
  color: '',
  warehouse_location: '',
};

type StockMandatoryFieldKey = 'stock_code' | 'stock_name' | 'unit';

const STOCK_MANDATORY_FIELDS: Array<{ key: StockMandatoryFieldKey; label: string }> = [
  { key: 'stock_code', label: 'Stok Kodu' },
  { key: 'stock_name', label: 'Stok Adı' },
  { key: 'unit', label: 'Birim' },
];

function isStockFieldFilled(form: NewStockCardForm, field: StockMandatoryFieldKey) {
  return form[field].trim() !== '';
}

function getStockMandatorySummary(form: NewStockCardForm) {
  const items = STOCK_MANDATORY_FIELDS.map(({ key, label }) => ({
    key,
    label,
    filled: isStockFieldFilled(form, key),
  }));

  const completed = items.filter((item) => item.filled).length;

  return {
    items,
    completed,
    remaining: items.length - completed,
  };
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: `1px solid ${COLORS.border}`,
  borderRadius: RADIUS.md,
  background: COLORS.bg.main,
  color: COLORS.text,
  fontSize: 14,
  fontFamily: TYPOGRAPHY.fontFamily.base,
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  color: COLORS.muted,
  marginBottom: 4,
  fontWeight: 600,
};

const workspaceShellStyle: React.CSSProperties = {
  backgroundColor: COLORS.bg.surface,
  border: `1px solid ${COLORS.border}`,
  borderRadius: RADIUS.lg,
  boxShadow: '0 12px 30px rgba(15, 23, 42, 0.06)',
};

const sectionSurfaceStyle: React.CSSProperties = {
  backgroundColor: COLORS.bg.elevated ?? COLORS.bg.surface,
  padding: '14px',
  borderRadius: RADIUS.md,
  border: `1px solid ${COLORS.border}`,
  boxShadow: '0 8px 18px rgba(15, 23, 42, 0.04)',
};

const denseLabelStyle: React.CSSProperties = {
  fontSize: 10,
  color: COLORS.muted,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  fontWeight: 700,
};

function getWorkspaceTabStyle(active: boolean): React.CSSProperties {
  return {
    border: `1px solid ${active ? COLORS.primary : COLORS.border}`,
    background: active ? primaryRgba(0.12) : COLORS.bg.elevated ?? COLORS.bg.surface,
    color: active ? COLORS.primary : COLORS.text,
    borderRadius: RADIUS.md,
    padding: '7px 11px',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 36,
  };
}

interface StockCardComponentProps {
  openCreateOnMount?: boolean;
  onCreateOpenHandled?: () => void;
}

type StockListTab = 'all' | 'search' | 'low-stock';
type StockDetailTab = 'general' | 'pricing' | 'barcodes' | 'sales-prices' | 'movements' | 'technical';

export const StockCardComponent: React.FC<StockCardComponentProps> = ({
  openCreateOnMount = false,
  onCreateOpenHandled,
}) => {
  const [searchText, setSearchText] = useState('');
  const [stockDetail, setStockDetail] = useState<StockCardDetailResponse | null>(null);
  const [stockList, setStockList] = useState<StockCard[]>([]);
  const [lowStockItems, setLowStockItems] = useState<StockCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [activeListTab, setActiveListTab] = useState<StockListTab>('all');
  const [detailTab, setDetailTab] = useState<StockDetailTab>('general');
  const [showNewCardModal, setShowNewCardModal] = useState(false);
  const [newCardForm, setNewCardForm] = useState<NewStockCardForm>(EMPTY_FORM);
  const [formBarkodlar, setFormBarkodlar] = useState<BarkodRow[]>([{ barcode: '' }]);
  const [formSatisFiyatlari, setFormSatisFiyatlari] = useState<SatisFiyatRow[]>([{ price_type: '', amount: '' }]);
  const [newCardLoading, setNewCardLoading] = useState(false);
  const [newCardError, setNewCardError] = useState<string | null>(null);
  const [detailEntityMaps, setDetailEntityMaps] = useState<EntityMap[]>([]);
  const [detailOutboxItems, setDetailOutboxItems] = useState<OutboxItem[]>([]);
  const [isCompactLayout, setIsCompactLayout] = useState(() => (typeof window !== "undefined" ? window.innerWidth < 1280 : false));

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleResize = () => setIsCompactLayout(window.innerWidth < 1280);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const fetchStockCards = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<StockCard[]>('/stock/stock-cards');
      setStockList(data);
    } catch (error) {
      console.error('Stok kartları yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLowStockItems = async () => {
    try {
      const data = await apiRequest<{ items?: StockCard[] }>('/stock/stock-cards/low-stock/alert?threshold=10');
      setLowStockItems(data.items || []);
    } catch (error) {
      console.error('Düşük stok ürünleri yükleme hatası:', error);
    }
  };

  const fetchStockCardDetail = async (stockCode: string) => {
    setLoading(true);
    try {
      const [data, maps, outbox] = await Promise.all([
        apiRequest<StockCardDetailResponse>(`/stock/stock-cards/${stockCode}`),
        integrationService.listEntityMaps({ entity_type: 'STOCK', internal_id: stockCode }).catch(() => [] as EntityMap[]),
        integrationService.listOutbox({ entity_type: 'STOCK', entity_id: stockCode }).catch(() => [] as OutboxItem[]),
      ]);
      setStockDetail(data as StockCardDetailResponse);
      setDetailEntityMaps(maps);
      setDetailOutboxItems(outbox);
      setDetailTab('general');
    } catch (error) {
      console.error('Stok kartı detayı yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchText.trim()) return;
    setLoading(true);
    try {
      const data = await apiRequest<StockCard[]>(`/stock/stock-cards/search?q=${encodeURIComponent(searchText)}`);
      setStockList(data);
      setActiveListTab('search');
    } catch (error) {
      console.error('Arama hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await apiRequest('/stock/stock-cards/sync', { method: 'POST' });
      void fetchStockCards();
    } catch (error) {
      console.error('Senkronizasyon hatası:', error);
    } finally {
      setSyncing(false);
    }
  };

  const handleCreateStockCard = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate barkodlar
    const filledBarkodlar = formBarkodlar.filter(b => b.barcode.trim());
    const barkodValues = filledBarkodlar.map(b => b.barcode.trim());
    if (new Set(barkodValues).size !== barkodValues.length) {
      setNewCardError('Aynı barkod bir stok kartında tekrar edemez');
      return;
    }

    // Validate satisFiyatlari
    const filledFiyatlar = formSatisFiyatlari.filter(f => f.price_type.trim() || f.amount.trim());
    for (const f of filledFiyatlar) {
      if (!f.price_type.trim() || !f.amount.trim()) {
        setNewCardError('Satış fiyat satırlarında fiyat tipi ve tutar birlikte girilmelidir');
        return;
      }
    }
    const priceTypes = filledFiyatlar.map(f => f.price_type.trim());
    if (new Set(priceTypes).size !== priceTypes.length) {
      setNewCardError('Aynı fiyat tipi bir stok kartında tekrar edemez');
      return;
    }

    if (!canSubmitNewCard) {
      setNewCardError('Stok kodu, adı ve birimi zorunludur');
      return;
    }

    setNewCardLoading(true);
    setNewCardError(null);
    try {
      const created = await apiRequest<StockCardDetailResponse>('/stock/stock-cards', {
        method: 'POST',
        body: JSON.stringify({
          stock_code: newCardForm.stock_code.trim(),
          stock_name: newCardForm.stock_name.trim(),
          unit: newCardForm.unit.trim(),
          purchase_price: newCardForm.purchase_price ? parseFloat(newCardForm.purchase_price) : null,
          sale_price: newCardForm.sale_price ? parseFloat(newCardForm.sale_price) : null,
          total_quantity: parseFloat(newCardForm.total_quantity) || 0,
          thickness: newCardForm.thickness.trim() || null,
          color: newCardForm.color.trim() || null,
          warehouse_location: newCardForm.warehouse_location.trim() || null,
          material_type: null,
          width_mm: null,
          height_mm: null,
          barkodlar: barkodValues.map(barcode => ({ barcode })),
          satis_fiyatlari: filledFiyatlar.map(f => ({ price_type: f.price_type.trim(), amount: parseFloat(f.amount) })),
        }),
      });
      setShowNewCardModal(false);
      setNewCardForm(EMPTY_FORM);
      setFormBarkodlar([{ barcode: '' }]);
      setFormSatisFiyatlari([{ price_type: '', amount: '' }]);
      setStockDetail(created as StockCardDetailResponse);
      setDetailEntityMaps([]);
      setDetailOutboxItems([]);
      setActiveListTab('all');
      setDetailTab('general');
      void fetchStockCards();
    } catch (err: unknown) {
      setNewCardError(err instanceof Error ? err.message : 'Stok kartı oluşturulamadı');
    } finally {
      setNewCardLoading(false);
    }
  };

  useEffect(() => {
    void fetchStockCards();
    void fetchLowStockItems();
  }, []);

  useEffect(() => {
    if (!openCreateOnMount) return;
    setNewCardError(null);
    setShowNewCardModal(true);
    onCreateOpenHandled?.();
  }, [openCreateOnMount, onCreateOpenHandled]);

  const visibleStocks = activeListTab === 'low-stock' ? lowStockItems : stockList;
  const listTitle = activeListTab === 'low-stock' ? 'Düşük Stok Listesi' : activeListTab === 'search' ? 'Arama Sonuçları' : 'Tüm Stoklar';
  const listSubtitle = activeListTab === 'low-stock'
    ? `${lowStockItems.length} kritik stok kaydı`
    : activeListTab === 'search'
      ? `${stockList.length} arama sonucu`
      : `${stockList.length} stok kaydı`;
  const stockMandatorySummary = getStockMandatorySummary(newCardForm);
  const canSubmitNewCard = stockMandatorySummary.remaining === 0;

  return (
    <div style={{ padding: '20px', minHeight: '100vh', backgroundColor: COLORS.bg.main }}>
      {/* Toolbar */}
      <div style={{ ...workspaceShellStyle, padding: 16, marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ display: 'grid', gap: 4 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.text }}>Stok Kartı</div>
            <div style={{ fontSize: 13, color: COLORS.muted }}>Mikro uyumlu yatay stok yönetimi ve ayrışmış alt grid yapısı</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => void handleSync()} disabled={syncing} style={{ padding: '10px 16px', backgroundColor: COLORS.success, color: 'white', border: 'none', borderRadius: RADIUS.md, cursor: syncing ? 'not-allowed' : 'pointer', fontWeight: 700, opacity: syncing ? 0.7 : 1 }}>
              <RefreshCw size={16} style={{ marginRight: '8px' }} />
              {syncing ? 'Senkronize Ediliyor...' : 'Senkronize Et'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowNewCardModal(true);
                setNewCardError(null);
                setNewCardForm(EMPTY_FORM);
                setFormBarkodlar([{ barcode: '' }]);
                setFormSatisFiyatlari([{ price_type: '', amount: '' }]);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', backgroundColor: COLORS.primary, color: 'white', border: 'none', borderRadius: RADIUS.md, cursor: 'pointer', fontWeight: TYPOGRAPHY.fontWeight.semibold, fontSize: 14 }}
            >
              <Plus size={18} /> Yeni Stok Kartı
            </button>
          </div>
        </div>
        <form onSubmit={(e) => void handleSearch(e)} style={{ display: 'grid', gridTemplateColumns: isCompactLayout ? '1fr' : 'minmax(280px, 1fr) auto auto', gap: '12px', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: COLORS.muted }} />
            <input type="text" placeholder="Stok kodu, adı veya rengi ara..." value={searchText} onChange={(e) => setSearchText(e.target.value)} style={{ width: '100%', padding: '10px 12px 10px 40px', border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md, fontSize: '14px' }} />
          </div>
          <button type="submit" style={{ padding: '10px 16px', backgroundColor: COLORS.primary, color: 'white', border: 'none', borderRadius: RADIUS.md, cursor: 'pointer', fontWeight: 700 }}>Ara</button>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <span style={{ padding: '6px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, color: COLORS.text, background: COLORS.bg.elevated ?? COLORS.bg.main, border: `1px solid ${COLORS.border}` }}>Toplam {stockList.length}</span>
            <span style={{ padding: '6px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, color: COLORS.warning, background: `${COLORS.warning}18`, border: `1px solid ${COLORS.warning}` }}>Düşük {lowStockItems.length}</span>
                {stockDetail ? <span style={{ padding: '6px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, color: COLORS.primary, background: primaryRgba(0.12), border: `1px solid ${COLORS.primary}` }}>Seçili {stockDetail.stockCode}</span> : null}
          </div>
        </form>
      </div>

      <div style={{ display: 'grid', gap: 18 }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', paddingBottom: '12px', borderBottom: `1px solid ${COLORS.border}` }}>
          <button type="button" onClick={() => { setActiveListTab('all'); void fetchStockCards(); }} style={{ padding: '10px 14px', backgroundColor: activeListTab === 'all' ? COLORS.primary : COLORS.bg.surface, color: activeListTab === 'all' ? 'white' : COLORS.text, border: `1px solid ${activeListTab === 'all' ? COLORS.primary : COLORS.border}`, borderRadius: RADIUS.md, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
            Tüm Stoklar ({stockList.length})
          </button>
          <button type="button" onClick={() => setActiveListTab('low-stock')} style={{ padding: '10px 14px', backgroundColor: activeListTab === 'low-stock' ? COLORS.warning : COLORS.bg.surface, color: activeListTab === 'low-stock' ? 'white' : COLORS.text, border: `1px solid ${activeListTab === 'low-stock' ? COLORS.warning : COLORS.border}`, borderRadius: RADIUS.md, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
            Düşük Stok ({lowStockItems.length})
          </button>
          {stockDetail ? (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: COLORS.muted }}>
              <Package size={14} /> Seçili: {stockDetail.stockCode}
            </div>
          ) : null}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: COLORS.muted }}>
            <p>Yükleniyor...</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: isCompactLayout ? '1fr' : 'minmax(320px, 380px) minmax(0, 1fr)', gap: '14px', alignItems: 'start' }}>
            <div style={{ ...workspaceShellStyle, padding: '14px', display: 'grid', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text }}>{listTitle}</div>
                  <div style={{ fontSize: 11, color: COLORS.muted }}>{listSubtitle} • Mikro uyumlu yoğun liste</div>
                </div>
                <button type="button" onClick={() => { setShowNewCardModal(true); setNewCardError(null); setNewCardForm(EMPTY_FORM); setFormBarkodlar([{ barcode: '' }]); setFormSatisFiyatlari([{ price_type: '', amount: '' }]); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 11px', backgroundColor: COLORS.primary, color: 'white', border: 'none', borderRadius: RADIUS.md, cursor: 'pointer', fontWeight: TYPOGRAPHY.fontWeight.semibold, fontSize: 13 }}>
                  <Plus size={16} /> Yeni Stok
                </button>
              </div>

              <div style={{ maxHeight: isCompactLayout ? 'none' : '680px', overflowY: 'auto', display: 'grid', gap: '8px', paddingRight: 4 }}>
                {visibleStocks.length === 0 ? (
                  <div style={{ padding: '32px 20px', textAlign: 'center', color: COLORS.muted }}>
                    {activeListTab === 'low-stock' ? <TrendingDown size={40} style={{ marginBottom: '10px', opacity: 0.5 }} /> : <Package size={40} style={{ marginBottom: '10px', opacity: 0.5 }} />}
                    <p style={{ margin: 0 }}>{activeListTab === 'low-stock' ? 'Düşük stok ürünü bulunmamaktadır' : 'Stok kartı bulunamadı'}</p>
                  </div>
                ) : (
                  visibleStocks.map((stock) => {
                    const isSelected = stockDetail?.stockCode === stock.stockCode;
                    const lowStock = stock.availableQuantity < 10;
                    return (
                      <div key={stock.id} onClick={() => void fetchStockCardDetail(stock.stockCode)} style={{ padding: '14px 16px', minHeight: 112, borderRadius: RADIUS.md, border: `1px solid ${isSelected ? COLORS.primary : lowStock ? COLORS.warning : COLORS.border}`, backgroundColor: isSelected ? primaryRgba(0.12) : lowStock ? '#fff7ed' : COLORS.bg.elevated ?? COLORS.bg.surface, boxShadow: isSelected ? `0 0 0 1px ${primaryRgba(0.12)}` : '0 8px 18px rgba(15, 23, 42, 0.04)', cursor: 'pointer', display: 'grid', gap: 8 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12, alignItems: 'start' }}>
                          <div style={{ display: 'grid', gap: 3 }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: COLORS.primary }}>{stock.stockCode}</div>
                            <div style={{ fontSize: 13, color: COLORS.text }}>{stock.stockName}</div>
                            <div style={{ fontSize: 11, color: COLORS.muted }}>{[stock.thickness, stock.color, stock.warehouseLocation].filter(Boolean).join(' • ') || 'Teknik bilgi bekleniyor'}</div>
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            {lowStock ? <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, color: '#b45309', background: '#fef3c7' }}>Düşük</span> : null}
                            <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, color: stock.isActive ? COLORS.success : COLORS.warning, background: stock.isActive ? `${COLORS.success}18` : `${COLORS.warning}18` }}>{stock.isActive ? 'Aktif' : 'Pasif'}</span>
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                          <div>
                            <div style={denseLabelStyle}>Alış</div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.text }}>₺{(stock.purchasePrice ?? 0).toFixed(2)}</div>
                          </div>
                          <div>
                            <div style={denseLabelStyle}>Satış</div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.text }}>₺{(stock.salePrice ?? 0).toFixed(2)}</div>
                          </div>
                          <div>
                            <div style={denseLabelStyle}>Uygun</div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: lowStock ? COLORS.warning : COLORS.success }}>{stock.availableQuantity} {stock.unit}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div style={{ ...workspaceShellStyle, padding: '14px', display: 'grid', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'grid', gap: 4 }}>
                  <div style={{ fontSize: 17, fontWeight: 700, color: COLORS.text }}>Stok Çalışma Alanı</div>
                  <div style={{ fontSize: 11, color: COLORS.muted }}>{stockDetail ? 'Mikro uyumlu yatay detay görünümü' : 'Soldaki listeden bir stok kartı seçildiğinde çalışma alanı burada açılır'}</div>
                </div>
                {stockDetail ? <span style={{ padding: '6px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, color: COLORS.primary, background: primaryRgba(0.12), border: `1px solid ${COLORS.primary}` }}>Seçili {stockDetail.stockCode}</span> : null}
              </div>
              {stockDetail ? (
                <>
                  <div style={{ padding: '12px 14px', borderRadius: RADIUS.lg, border: `1px solid ${COLORS.border}`, background: COLORS.bg.elevated ?? COLORS.bg.surface, display: 'grid', gap: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      <div style={{ display: 'grid', gap: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 17, fontWeight: 700, color: COLORS.text }}>{stockDetail.stockCode}</span>
                          {stockDetail.isActive ? <span style={{ padding: '4px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700, color: COLORS.success, background: `${COLORS.success}18` }}>Aktif</span> : <span style={{ padding: '4px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700, color: COLORS.warning, background: `${COLORS.warning}18` }}>Pasif</span>}
                        </div>
                        <span style={{ fontSize: 14, color: COLORS.muted }}>{stockDetail.stockName}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <button type="button" onClick={() => void handleSync()} disabled={syncing} style={{ padding: '7px 11px', backgroundColor: COLORS.success, color: 'white', border: 'none', borderRadius: RADIUS.md, cursor: syncing ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 11, opacity: syncing ? 0.7 : 1 }}>
                          {syncing ? 'Senkronize Ediliyor...' : 'Senkronize Et'}
                        </button>
                        <button type="button" onClick={() => { setShowNewCardModal(true); setNewCardError(null); setNewCardForm(EMPTY_FORM); setFormBarkodlar([{ barcode: '' }]); setFormSatisFiyatlari([{ price_type: '', amount: '' }]); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 11px', backgroundColor: COLORS.primary, color: 'white', border: 'none', borderRadius: RADIUS.md, cursor: 'pointer', fontWeight: TYPOGRAPHY.fontWeight.semibold, fontSize: 12 }}>
                          <Plus size={16} /> Yeni Stok
                        </button>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                      <div><div style={denseLabelStyle}>Birim</div><div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>{stockDetail.unit}</div></div>
                      <div><div style={denseLabelStyle}>Depo</div><div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>{stockDetail.warehouseLocation || 'Yok'}</div></div>
                      <div><div style={denseLabelStyle}>Renk</div><div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>{stockDetail.color || 'Yok'}</div></div>
                      <div><div style={denseLabelStyle}>Kalınlık</div><div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>{stockDetail.thickness || 'Yok'}</div></div>
                      <div><div style={denseLabelStyle}>Son Sync</div><div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>{stockDetail.lastSyncDate ? new Date(stockDetail.lastSyncDate).toLocaleString('tr-TR') : 'Yok'}</div></div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '0 0 10px', borderBottom: `1px solid ${COLORS.border}` }}>
                    {[
                      { id: 'general', label: 'Genel' },
                      { id: 'pricing', label: 'Fiyat ve Stok' },
                      { id: 'barcodes', label: `Barkodlar (${(stockDetail.barkodlar ?? []).length})` },
                      { id: 'sales-prices', label: `Satış Fiyatları (${(stockDetail.satisFiyatlari ?? []).length})` },
                      { id: 'movements', label: `Hareketler (${stockDetail.movements.length})` },
                      { id: 'technical', label: 'Teknik' },
                    ].map((tab) => {
                      const active = detailTab === tab.id;
                      return (
                        <button key={tab.id} type="button" onClick={() => setDetailTab(tab.id as StockDetailTab)} style={getWorkspaceTabStyle(active)}>
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  {detailTab === 'general' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                      <div style={sectionSurfaceStyle}>
                        <h3 style={{ fontSize: '14px', fontWeight: 600, color: COLORS.text, marginBottom: '10px', marginTop: 0 }}>Genel Bilgiler</h3>
                        <div style={{ fontSize: 13, display: 'grid', gap: 6 }}>
                          <div><span style={{ color: COLORS.muted }}>Renk:</span> {stockDetail.color || 'Yok'}</div>
                          <div><span style={{ color: COLORS.muted }}>Kalınlık:</span> {stockDetail.thickness || 'Yok'}</div>
                          <div><span style={{ color: COLORS.muted }}>Depo:</span> {stockDetail.warehouseLocation || 'Yok'}</div>
                          <div><span style={{ color: COLORS.muted }}>Birim:</span> {stockDetail.unit}</div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {detailTab === 'pricing' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                      <div style={sectionSurfaceStyle}>
                        <h3 style={{ fontSize: '14px', fontWeight: 600, color: COLORS.text, marginBottom: '10px', marginTop: 0 }}>Ticari Bilgiler</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <div><div style={{ fontSize: 11, color: COLORS.muted }}>Alış Fiyatı</div><div style={{ fontSize: 17, fontWeight: 700, color: COLORS.text }}>₺{(stockDetail.purchasePrice ?? 0).toFixed(2)}</div></div>
                          <div><div style={{ fontSize: 11, color: COLORS.muted }}>Satış Fiyatı</div><div style={{ fontSize: 17, fontWeight: 700, color: COLORS.text }}>₺{(stockDetail.salePrice ?? 0).toFixed(2)}</div></div>
                        </div>
                      </div>
                      <div style={sectionSurfaceStyle}>
                        <h3 style={{ fontSize: '14px', fontWeight: 600, color: COLORS.text, marginBottom: '10px', marginTop: 0 }}>Depo ve Miktar</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                          <div><div style={{ fontSize: 11, color: COLORS.muted }}>Toplam</div><div style={{ fontSize: 18, fontWeight: 700, color: COLORS.primary }}>{stockDetail.totalQuantity} {stockDetail.unit}</div></div>
                          <div><div style={{ fontSize: 11, color: COLORS.muted }}>Uygun</div><div style={{ fontSize: 18, fontWeight: 700, color: stockDetail.availableQuantity > 0 ? COLORS.success : COLORS.danger }}>{stockDetail.availableQuantity} {stockDetail.unit}</div></div>
                          <div><div style={{ fontSize: 11, color: COLORS.muted }}>Rezerve</div><div style={{ fontSize: 18, fontWeight: 700, color: COLORS.warning }}>{stockDetail.reservedQuantity} {stockDetail.unit}</div></div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {detailTab === 'barcodes' ? (
                    <div style={sectionSurfaceStyle}>
                      <h3 style={{ fontSize: '14px', fontWeight: 600, color: COLORS.text, marginBottom: '10px', marginTop: 0 }}>Barkodlar</h3>
                      <div role="region" aria-label="Barkod Alt Gridi">
                        {(stockDetail.barkodlar ?? []).length === 0 ? <div style={{ fontSize: 13, color: COLORS.muted }}>Barkod kaydı yok</div> : (stockDetail.barkodlar ?? []).map(b => <div key={b.id} style={{ fontSize: 13, padding: '6px 0', borderBottom: `1px solid ${COLORS.border}` }}>{b.barcode}</div>)}
                      </div>
                    </div>
                  ) : null}

                  {detailTab === 'sales-prices' ? (
                    <div style={sectionSurfaceStyle}>
                      <h3 style={{ fontSize: '14px', fontWeight: 600, color: COLORS.text, marginBottom: '10px', marginTop: 0 }}>Satış Fiyatları</h3>
                      <div role="region" aria-label="Satış Fiyatları Alt Gridi">
                        {(stockDetail.satisFiyatlari ?? []).length === 0 ? <div style={{ fontSize: 13, color: COLORS.muted }}>Satış fiyatı kaydı yok</div> : (stockDetail.satisFiyatlari ?? []).map(f => <div key={f.id} style={{ fontSize: 13, padding: '6px 0', display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${COLORS.border}` }}><span>{f.priceType}</span><span>₺{f.amount.toFixed(2)}</span></div>)}
                      </div>
                    </div>
                  ) : null}

                  {detailTab === 'technical' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 0.72fr) minmax(360px, 1.28fr)', gap: 12, alignItems: 'start' }}>
                      <div style={sectionSurfaceStyle}>
                        <h3 style={{ fontSize: '14px', fontWeight: 600, color: COLORS.text, marginBottom: '10px', marginTop: 0 }}>Stok Teknik Paneli</h3>
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 4, fontWeight: 600 }}>Eşleme Kayıtları</div>
                          {detailEntityMaps.length === 0 ? <div style={{ fontSize: 13, color: COLORS.muted }}>Eşleme kaydı yok</div> : detailEntityMaps.map(m => <div key={m.id} style={{ fontSize: 13 }}>{m.externalSystem} / {m.externalId}</div>)}
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 4, fontWeight: 600 }}>Outbox</div>
                          {detailOutboxItems.length === 0 ? <div style={{ fontSize: 13, color: COLORS.muted }}>Outbox kaydı yok</div> : detailOutboxItems.map(item => <div key={item.id} style={{ fontSize: 13 }}>{item.status} {item.errorMessage}</div>)}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {detailTab === 'movements' ? (
                    <div style={sectionSurfaceStyle}>
                      <h3 style={{ fontSize: '14px', fontWeight: 600, color: COLORS.text, marginBottom: '10px', marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><Calendar size={16} /> Son Hareketler</h3>
                      {stockDetail.movements.length === 0 ? (
                        <div style={{ fontSize: 13, color: COLORS.muted }}>Hareket kaydı yok</div>
                      ) : (
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ borderBottom: `2px solid ${COLORS.border}` }}>
                                <th style={{ padding: '10px', textAlign: 'left', color: COLORS.muted }}>Tür</th>
                                <th style={{ padding: '10px', textAlign: 'left', color: COLORS.muted }}>Miktar</th>
                                <th style={{ padding: '10px', textAlign: 'left', color: COLORS.muted }}>Tarih</th>
                                <th style={{ padding: '10px', textAlign: 'left', color: COLORS.muted }}>Referans</th>
                              </tr>
                            </thead>
                            <tbody>
                              {stockDetail.movements.map((move) => (
                                <tr key={move.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                                  <td style={{ padding: '10px', color: COLORS.text }}>{move.movementType}</td>
                                  <td style={{ padding: '10px', color: COLORS.text }}>{move.quantity}</td>
                                  <td style={{ padding: '10px', color: COLORS.muted }}>{new Date(move.movementDate).toLocaleDateString('tr-TR')}</td>
                                  <td style={{ padding: '10px', color: COLORS.muted }}>{move.referenceId || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ) : null}
                </>
              ) : (
                <div style={{ minHeight: isCompactLayout ? '320px' : '520px', display: 'grid', placeItems: 'center', textAlign: 'center', color: COLORS.muted, paddingTop: 12 }}>
                  <div style={{ display: 'grid', gap: 8, justifyItems: 'center', maxWidth: 320 }}>
                    <div style={{ width: 52, height: 52, borderRadius: 999, border: `1px solid ${COLORS.border}`, display: 'grid', placeItems: 'center', color: COLORS.primary, background: primaryRgba(0.08) }}>
                      <Package size={22} />
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.text, marginBottom: 0 }}>Stok çalışma alanı</div>
                    <div style={{ fontSize: 13, lineHeight: 1.6 }}>Soldaki listeden bir stok kartı seçildiğinde detay alanı burada açılır.</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {/* Yeni Stok Kartı Modal */}
      {showNewCardModal && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowNewCardModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 800, maxHeight: '90vh', overflow: 'auto', background: COLORS.bg.surface, borderRadius: RADIUS.lg, border: `1px solid ${COLORS.border}`, padding: 20 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${COLORS.border}` }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: TYPOGRAPHY.fontWeight.bold, color: COLORS.text, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Plus size={20} /> Yeni Stok Kartı
              </h2>
              <button type="button" onClick={() => setShowNewCardModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: COLORS.muted, padding: 4 }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={(e) => void handleCreateStockCard(e)} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, padding: '10px 0' }}>
              <div
                style={{
                  gridColumn: '1 / -1',
                  padding: '12px 14px',
                  borderRadius: RADIUS.lg,
                  border: `1px solid ${stockMandatorySummary.remaining > 0 ? COLORS.warning : COLORS.success}`,
                  background: stockMandatorySummary.remaining > 0 ? `${COLORS.warning}10` : `${COLORS.success}12`,
                  display: 'grid',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ display: 'grid', gap: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.text }}>Mecburi Bilgi Durumu</span>
                    <span style={{ fontSize: 11, color: COLORS.muted }}>
                      Stok kartı açılışı için önce kod, ad ve birim bilgisini tamamlayın.
                    </span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: stockMandatorySummary.remaining > 0 ? COLORS.warning : COLORS.success }}>
                    {stockMandatorySummary.completed}/{stockMandatorySummary.items.length} tamam
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {stockMandatorySummary.items.map((item) => (
                    <span
                      key={item.key}
                      style={{
                        padding: '5px 9px',
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 700,
                        color: item.filled ? COLORS.success : COLORS.warning,
                        background: item.filled ? `${COLORS.success}14` : `${COLORS.warning}14`,
                        border: `1px solid ${item.filled ? COLORS.success : COLORS.warning}`,
                      }}
                    >
                      {item.label}
                    </span>
                  ))}
                </div>
              </div>
              {/* Left Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: COLORS.primary, borderBottom: `1px solid ${COLORS.border}`, paddingBottom: 6 }}>Mecburi Bilgiler</h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label htmlFor="form-stock-code" style={labelStyle}>Stok Kodu *</label>
                    <input id="form-stock-code" type="text" required value={newCardForm.stock_code} onChange={(e) => setNewCardForm(f => ({ ...f, stock_code: e.target.value }))} placeholder="STK-001" style={inputStyle} />
                  </div>
                  <div>
                    <label htmlFor="form-unit" style={labelStyle}>Birim *</label>
                    <select id="form-unit" required value={newCardForm.unit} onChange={(e) => setNewCardForm(f => ({ ...f, unit: e.target.value }))} style={{ ...inputStyle }}>
                      <option value="ADET">Adet</option>
                      <option value="KG">Kg</option>
                      <option value="M">Metre</option>
                      <option value="M2">m²</option>
                      <option value="M3">m³</option>
                      <option value="LT">Litre</option>
                      <option value="PAKET">Paket</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="form-stock-name" style={labelStyle}>Stok Adı *</label>
                  <input id="form-stock-name" type="text" required value={newCardForm.stock_name} onChange={(e) => setNewCardForm(f => ({ ...f, stock_name: e.target.value }))} placeholder="Ürün adı" style={inputStyle} />
                </div>

                <div>
                  <label htmlFor="form-total-qty" style={labelStyle}>Toplam Stok</label>
                  <input id="form-total-qty" type="number" step="1" min="0" value={newCardForm.total_quantity} onChange={(e) => setNewCardForm(f => ({ ...f, total_quantity: e.target.value }))} style={inputStyle} />
                </div>

                {/* Barkodlar */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 8 }}>Barkodlar</div>
                  {formBarkodlar.map((row, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 6, alignItems: 'flex-end', marginBottom: 8 }}>
                      <div style={{ flex: 1 }}>
                        <label htmlFor={`form-barcode-${idx}`} style={labelStyle}>Barkod {idx + 1}</label>
                        <input
                          id={`form-barcode-${idx}`}
                          type="text"
                          value={row.barcode}
                          onChange={(e) => {
                            const v = e.target.value;
                            setFormBarkodlar(prev => prev.map((b, i) => i === idx ? { barcode: v } : b));
                          }}
                          placeholder="Barkod numarası"
                          style={inputStyle}
                        />
                      </div>
                      {formBarkodlar.length > 1 && (
                        <button type="button" onClick={() => setFormBarkodlar(prev => prev.filter((_, i) => i !== idx))} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: COLORS.muted, padding: 4 }}>
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={() => setFormBarkodlar(prev => [...prev, { barcode: '' }])} style={{ fontSize: 11, color: COLORS.primary, border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px 0' }}>
                    + Yeni barkod satırı
                  </button>
                </div>
              </div>

              {/* Right Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gap: 4 }}>
                  <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: COLORS.primary, borderBottom: `1px solid ${COLORS.border}`, paddingBottom: 6 }}>Opsiyonel Bilgiler ve Alt Gridler</h4>
                  <span style={{ fontSize: 11, color: COLORS.muted }}>
                    Fiyat, renk, kalınlık, barkod ve satış fiyatı satırları kart açıldıktan sonra da tamamlanabilir.
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label htmlFor="form-purchase-price" style={labelStyle}>Alış Fiyatı</label>
                    <input id="form-purchase-price" type="number" step="0.01" min="0" value={newCardForm.purchase_price} onChange={(e) => setNewCardForm(f => ({ ...f, purchase_price: e.target.value }))} placeholder="0.00" style={inputStyle} />
                  </div>
                  <div>
                    <label htmlFor="form-sale-price" style={labelStyle}>Satış Fiyatı</label>
                    <input id="form-sale-price" type="number" step="0.01" min="0" value={newCardForm.sale_price} onChange={(e) => setNewCardForm(f => ({ ...f, sale_price: e.target.value }))} placeholder="0.00" style={inputStyle} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label htmlFor="form-color" style={labelStyle}>Renk</label>
                    <input id="form-color" type="text" value={newCardForm.color} onChange={(e) => setNewCardForm(f => ({ ...f, color: e.target.value }))} placeholder="Beyaz" style={inputStyle} />
                  </div>
                  <div>
                    <label htmlFor="form-thickness" style={labelStyle}>Kalınlık</label>
                    <input id="form-thickness" type="text" value={newCardForm.thickness} onChange={(e) => setNewCardForm(f => ({ ...f, thickness: e.target.value }))} placeholder="18mm" style={inputStyle} />
                  </div>
                </div>

                <div>
                  <label htmlFor="form-warehouse" style={labelStyle}>Depo Yeri</label>
                  <input id="form-warehouse" type="text" value={newCardForm.warehouse_location} onChange={(e) => setNewCardForm(f => ({ ...f, warehouse_location: e.target.value }))} placeholder="A-01" style={inputStyle} />
                </div>

                {/* Satış Fiyatları */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 8 }}>Satış Fiyatları</div>
                  {formSatisFiyatlari.map((row, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'flex-end', marginBottom: 8 }}>
                      <div>
                        <label htmlFor={`form-price-type-${idx}`} style={labelStyle}>Fiyat Tipi</label>
                        <input
                          id={`form-price-type-${idx}`}
                          type="text"
                          value={row.price_type}
                          onChange={(e) => {
                            const v = e.target.value;
                            setFormSatisFiyatlari(prev => prev.map((r, i) => i === idx ? { ...r, price_type: v } : r));
                          }}
                          placeholder="LISTE"
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label htmlFor={`form-amount-${idx}`} style={labelStyle}>Tutar</label>
                        <input
                          id={`form-amount-${idx}`}
                          type="number"
                          step="0.01"
                          min="0"
                          value={row.amount}
                          onChange={(e) => {
                            const v = e.target.value;
                            setFormSatisFiyatlari(prev => prev.map((r, i) => i === idx ? { ...r, amount: v } : r));
                          }}
                          placeholder="0.00"
                          style={inputStyle}
                        />
                      </div>
                      {formSatisFiyatlari.length > 1 && (
                        <button type="button" onClick={() => setFormSatisFiyatlari(prev => prev.filter((_, i) => i !== idx))} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: COLORS.muted, padding: 4 }}>
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={() => setFormSatisFiyatlari(prev => [...prev, { price_type: '', amount: '' }])} style={{ fontSize: 11, color: COLORS.primary, border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px 0' }}>
                    + Fiyat Satırı Ekle
                  </button>
                </div>
              </div>

              {newCardError && (
                <div style={{ gridColumn: '1 / -1', padding: 10, border: `1px solid ${COLORS.danger}`, borderRadius: RADIUS.md, color: COLORS.danger, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertCircle size={14} /> {newCardError}
                </div>
              )}

              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12, paddingTop: 16, borderTop: `1px solid ${COLORS.border}` }}>
                <button type="button" onClick={() => setShowNewCardModal(false)} disabled={newCardLoading} style={{ padding: '10px 16px', border: `1px solid ${COLORS.border}`, background: COLORS.bg.main, color: COLORS.text, borderRadius: RADIUS.md, cursor: 'pointer', fontSize: 14, fontWeight: 500, minWidth: 100 }}>
                  Vazgeç
                </button>
                <button type="submit" disabled={newCardLoading || !canSubmitNewCard} style={{ padding: '10px 16px', border: 'none', background: COLORS.primary, color: 'white', borderRadius: RADIUS.md, cursor: newCardLoading || !canSubmitNewCard ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600, opacity: newCardLoading || !canSubmitNewCard ? 0.7 : 1, minWidth: 160 }}>
                  {newCardLoading
                    ? 'Oluşturuluyor...'
                    : canSubmitNewCard
                      ? 'Stok Kartını Oluştur'
                      : `Mecburi Bilgileri Tamamla (${stockMandatorySummary.remaining})`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockCardComponent;















