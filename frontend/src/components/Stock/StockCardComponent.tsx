import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, AlertCircle, Package, TrendingDown, Calendar, DollarSign, Palette, Ruler, MapPin, Clock, Plus, X } from 'lucide-react';
import { apiRequest } from '../../services/apiClient';
import { COLORS, RADIUS, TYPOGRAPHY } from '../Shared/constants';

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

interface StockCardDetailResponse {
  id: string;
  stockCode: string;
  stockName: string;
  totalQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  salePrice: number | null;
  color: string | null;
  thickness: string | null;
  warehouseLocation: string | null;
  unit: string;
  isActive: boolean;
  movements: StockMovement[];
}

// Form state — backend'e snake_case gönderilir, local state
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

export const StockCardComponent: React.FC = () => {
  const [searchText, setSearchText] = useState('');
  const [stockDetail, setStockDetail] = useState<StockCardDetailResponse | null>(null);
  const [stockList, setStockList] = useState<StockCard[]>([]);
  const [lowStockItems, setLowStockItems] = useState<StockCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'search' | 'low-stock' | 'detail'>('all');
  const [showNewCardModal, setShowNewCardModal] = useState(false);
  const [newCardForm, setNewCardForm] = useState<NewStockCardForm>(EMPTY_FORM);
  const [newCardLoading, setNewCardLoading] = useState(false);
  const [newCardError, setNewCardError] = useState<string | null>(null);

  // Stok kartlarını yükle
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

  // Düşük stok ürünleri getir
  const fetchLowStockItems = async () => {
    try {
      const data = await apiRequest<{ items?: StockCard[] }>(
        '/stock/stock-cards/low-stock/alert?threshold=10'
      );
      setLowStockItems(data.items || []);
    } catch (error) {
      console.error('Düşük stok ürünleri yükleme hatası:', error);
    }
  };

  // Stok kartı detaylarını getir
  const fetchStockCardDetail = async (stockCode: string) => {
    setLoading(true);
    try {
      const data = await apiRequest<StockCardDetailResponse>(`/stock/stock-cards/${stockCode}`);
      setStockDetail(data);
      setActiveTab('detail');
    } catch (error) {
      console.error('Stok kartı detayı yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  // Stok kartlarını ara
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchText.trim()) return;

    setLoading(true);
    try {
      const data = await apiRequest<StockCard[]>(
        `/stock/stock-cards/search?q=${encodeURIComponent(searchText)}`
      );
      setStockList(data);
      setActiveTab('search');
    } catch (error) {
      console.error('Arama hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  // Senkronizasyonu başlat
  const handleSync = async () => {
    setSyncing(true);
    try {
      await apiRequest('/stock/stock-cards/sync', { method: 'POST' });
      fetchStockCards();
      window.alert('Senkronizasyon tamamlandı');
    } catch (error) {
      console.error('Senkronizasyon hatası:', error);
    } finally {
      setSyncing(false);
    }
  };

  // Yeni stok kartı oluştur
  const handleCreateStockCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCardForm.stock_code.trim() || !newCardForm.stock_name.trim()) {
      setNewCardError('Stok kodu ve adı zorunludur');
      return;
    }
    setNewCardLoading(true);
    setNewCardError(null);
    try {
      await apiRequest('/stock/stock-cards', {
        method: 'POST',
        body: JSON.stringify({
          stock_code: newCardForm.stock_code,
          stock_name: newCardForm.stock_name,
          unit: newCardForm.unit,
          purchase_price: newCardForm.purchase_price ? parseFloat(newCardForm.purchase_price) : null,
          sale_price: newCardForm.sale_price ? parseFloat(newCardForm.sale_price) : null,
          total_quantity: parseFloat(newCardForm.total_quantity) || 0,
          thickness: newCardForm.thickness || null,
          color: newCardForm.color || null,
          warehouse_location: newCardForm.warehouse_location || null,
        }),
      });
      setShowNewCardModal(false);
      setNewCardForm(EMPTY_FORM);
      fetchStockCards();
    } catch (err: unknown) {
      setNewCardError(err instanceof Error ? err.message : 'Stok kartı oluşturulamadı');
    } finally {
      setNewCardLoading(false);
    }
  };

  useEffect(() => {
    fetchStockCards();
    fetchLowStockItems();
  }, []);

  return (
    <div style={{ padding: '20px', minHeight: '100vh', backgroundColor: COLORS.bg.main }}>
      {/* Arama ve Kontroller */}
      <div
        style={{
          backgroundColor: COLORS.bg.surface,
          padding: 16,
          borderRadius: RADIUS.md,
          marginBottom: 24,
          border: `1px solid ${COLORS.border}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {/* Üst satır: Yeni Stok Kartı butonu */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => { setShowNewCardModal(true); setNewCardError(null); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 20px',
              backgroundColor: COLORS.primary.DEFAULT,
              color: 'white',
              border: 'none',
              borderRadius: RADIUS.md,
              cursor: 'pointer',
              fontWeight: TYPOGRAPHY.fontWeight.semibold,
              fontSize: 14,
              transition: 'all 0.2s',
            }}
          >
            <Plus size={18} /> Yeni Stok Kartı
          </button>
        </div>

        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search
              size={18}
              style={{
                position: 'absolute',
                left: '12px',
                top: '12px',
                color: COLORS.muted
              }}
            />
            <input
              type="text"
              placeholder="Stok kodu, adı veya rengi ara..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px 10px 40px',
                border: `1px solid ${COLORS.border}`,
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>
          <button
            type="submit"
            style={{
              padding: '10px 16px',
              backgroundColor: COLORS.primary.DEFAULT,
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Ara
          </button>
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            style={{
              padding: '10px 16px',
              backgroundColor: COLORS.success.DEFAULT,
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
              opacity: syncing ? 0.7 : 1
            }}
          >
            <RefreshCw size={16} style={{ marginRight: '8px' }} />
            {syncing ? 'Senkronize Ediliyor...' : 'Senkronize Et'}
          </button>
        </form>
      </div>

      {/* Tabs */}
      <div style={{ marginBottom: '24px', borderBottom: `1px solid ${COLORS.border}` }}>
        <div style={{ display: 'flex', gap: '16px' }}>
          <button
            onClick={() => { setActiveTab('all'); fetchStockCards(); }}
            style={{
              padding: '12px 16px',
              backgroundColor: activeTab === 'all' ? COLORS.primary.DEFAULT : 'transparent',
              color: activeTab === 'all' ? 'white' : COLORS.text,
              border: 'none',
              cursor: 'pointer',
              fontWeight: 'bold',
              borderBottom: activeTab === 'all' ? `2px solid ${COLORS.primary.DEFAULT}` : 'transparent'
            }}
          >
            Tüm Stoklar ({stockList.length})
          </button>
          <button
            onClick={() => setActiveTab('low-stock')}
            style={{
              padding: '12px 16px',
              backgroundColor: activeTab === 'low-stock' ? COLORS.warning.DEFAULT : 'transparent',
              color: activeTab === 'low-stock' ? 'white' : COLORS.text,
              border: 'none',
              cursor: 'pointer',
              fontWeight: 'bold',
              borderBottom: activeTab === 'low-stock' ? `2px solid ${COLORS.warning.DEFAULT}` : 'transparent'
            }}
          >
            Düşük Stok ({lowStockItems.length})
          </button>
          {stockDetail && (
            <button
              onClick={() => setActiveTab('detail')}
              style={{
                padding: '12px 16px',
                backgroundColor: activeTab === 'detail' ? COLORS.primary.DEFAULT : 'transparent',
                color: activeTab === 'detail' ? 'white' : COLORS.text,
                border: 'none',
                cursor: 'pointer',
                fontWeight: 'bold',
                borderBottom: activeTab === 'detail' ? `2px solid ${COLORS.primary.DEFAULT}` : 'transparent'
              }}
            >
              Detay: {stockDetail.stockCode}
            </button>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px', color: COLORS.muted }}>
          <Clock size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
          <p>Yükleniyor...</p>
        </div>
      )}

      {/* Tüm Stoklar */}
      {activeTab === 'all' && !loading && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '16px'
          }}
        >
          {stockList.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: COLORS.muted }}>
              <Package size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
              <p>Stok kartı bulunamadı</p>
            </div>
          ) : (
            stockList.map((stock) => (
              <div
                key={stock.id}
                onClick={() => fetchStockCardDetail(stock.stockCode)}
                style={{
                  backgroundColor: COLORS.bg.surface,
                  padding: '16px',
                  borderRadius: '8px',
                  border: `1px solid ${COLORS.border}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ fontWeight: 'bold', fontSize: '14px', color: COLORS.primary.DEFAULT, marginBottom: '8px' }}>
                  {stock.stockCode}
                </div>
                <div style={{ fontSize: '13px', color: COLORS.text, marginBottom: '12px', lineHeight: '1.4' }}>
                  {stock.stockName}
                </div>

                {/* Bilgiler */}
                <div style={{ fontSize: '12px', color: COLORS.muted, marginBottom: '8px', display: 'grid', gap: 2 }}>
                  {stock.color && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Palette size={12} aria-hidden /> {stock.color}</div>}
                  {stock.thickness && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Ruler size={12} aria-hidden /> {stock.thickness}</div>}
                  {stock.warehouseLocation && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><MapPin size={12} aria-hidden /> {stock.warehouseLocation}</div>}
                </div>

                {/* Miktar */}
                <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: '12px', marginTop: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', color: COLORS.muted }}>Toplam</span>
                    <span style={{ fontWeight: 'bold', color: COLORS.text }}>
                      {stock.totalQuantity} {stock.unit}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', color: COLORS.muted }}>Uygun</span>
                    <span style={{ color: stock.availableQuantity > 0 ? COLORS.success.DEFAULT : COLORS.danger.DEFAULT }}>
                      {stock.availableQuantity} {stock.unit}
                    </span>
                  </div>
                  {stock.salePrice && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '11px', color: COLORS.muted }}>Satış Fiyatı</span>
                      <span style={{ fontWeight: 'bold', color: COLORS.text }}>
                        ₺{stock.salePrice.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Uyarı */}
                {stock.availableQuantity < 10 && (
                  <div
                    style={{
                      marginTop: '12px',
                      padding: '8px',
                      backgroundColor: '#fef3c7',
                      border: `1px solid ${COLORS.warning.DEFAULT}`,
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '12px',
                      color: '#b45309'
                    }}
                  >
                    <AlertCircle size={14} />
                    Düşük stok
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Düşük Stok */}
      {activeTab === 'low-stock' && !loading && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '16px'
          }}
        >
          {lowStockItems.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: COLORS.muted }}>
              <TrendingDown size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
              <p>Düşük stok ürünü bulunmamaktadır</p>
            </div>
          ) : (
            lowStockItems.map((stock) => (
              <div
                key={stock.id}
                onClick={() => fetchStockCardDetail(stock.stockCode)}
                style={{
                  backgroundColor: '#fef3c7',
                  padding: '16px',
                  borderRadius: '8px',
                  border: `2px solid ${COLORS.warning.DEFAULT}`,
                  cursor: 'pointer'
                }}
              >
                <div style={{ fontWeight: 'bold', fontSize: '14px', color: COLORS.warning.DEFAULT, marginBottom: '8px' }}>
                  {stock.stockCode}
                </div>
                <div style={{ fontSize: '13px', color: '#b45309', marginBottom: '12px' }}>
                  {stock.stockName}
                </div>
                <div style={{ fontSize: '12px', color: '#b45309' }}>
                  Mevcut: {stock.availableQuantity} {stock.unit}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Detay */}
      {activeTab === 'detail' && stockDetail && !loading && (
        <div style={{ maxWidth: '900px' }}>
          {/* Başlık */}
          <div style={{ backgroundColor: COLORS.bg.surface, padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: COLORS.text, marginBottom: '8px' }}>
              {stockDetail.stockCode}
            </div>
            <div style={{ fontSize: '16px', color: COLORS.muted, marginBottom: '12px' }}>
              {stockDetail.stockName}
            </div>
            <div style={{ display: 'flex', gap: '20px', fontSize: '14px', flexWrap: 'wrap' }}>
              {stockDetail.color && <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Palette size={14} aria-hidden /> {stockDetail.color}</div>}
              {stockDetail.thickness && <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Ruler size={14} aria-hidden /> {stockDetail.thickness}</div>}
              {stockDetail.warehouseLocation && <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={14} aria-hidden /> {stockDetail.warehouseLocation}</div>}
            </div>
          </div>

          {/* İstatistikler */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px',
              marginBottom: '20px'
            }}
          >
            <div style={{ backgroundColor: COLORS.bg.surface, padding: '16px', borderRadius: '8px', border: `1px solid ${COLORS.border}` }}>
              <div style={{ fontSize: '12px', color: COLORS.muted, marginBottom: '8px' }}>Toplam Miktar</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: COLORS.primary.DEFAULT }}>
                {stockDetail.totalQuantity} {stockDetail.unit}
              </div>
            </div>

            <div style={{ backgroundColor: COLORS.bg.surface, padding: '16px', borderRadius: '8px', border: `1px solid ${COLORS.border}` }}>
              <div style={{ fontSize: '12px', color: COLORS.muted, marginBottom: '8px' }}>Uygun Miktar</div>
              <div
                style={{
                  fontSize: '24px',
                  fontWeight: 'bold',
                  color: stockDetail.availableQuantity > 0 ? COLORS.success.DEFAULT : COLORS.danger.DEFAULT
                }}
              >
                {stockDetail.availableQuantity} {stockDetail.unit}
              </div>
            </div>

            <div style={{ backgroundColor: COLORS.bg.surface, padding: '16px', borderRadius: '8px', border: `1px solid ${COLORS.border}` }}>
              <div style={{ fontSize: '12px', color: COLORS.muted, marginBottom: '8px' }}>Rezerve Miktar</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: COLORS.warning.DEFAULT }}>
                {stockDetail.reservedQuantity} {stockDetail.unit}
              </div>
            </div>

            {stockDetail.salePrice && (
              <div style={{ backgroundColor: COLORS.bg.surface, padding: '16px', borderRadius: '8px', border: `1px solid ${COLORS.border}` }}>
                <div style={{ fontSize: '12px', color: COLORS.muted, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <DollarSign size={14} /> Satış Fiyatı
                </div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: COLORS.primary.DEFAULT }}>
                  ₺{stockDetail.salePrice.toFixed(2)}
                </div>
              </div>
            )}
          </div>

          {/* Hareketler */}
          <div style={{ backgroundColor: COLORS.bg.surface, padding: '20px', borderRadius: '8px', border: `1px solid ${COLORS.border}` }}>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: COLORS.text, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={18} /> Son Hareketler
            </h3>

            {stockDetail.movements.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: COLORS.muted }}>
                Hareket kaydı bulunmamaktadır
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${COLORS.border}` }}>
                      <th style={{ padding: '12px', textAlign: 'left', color: COLORS.muted }}>Tür</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: COLORS.muted }}>Miktar</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: COLORS.muted }}>Tarih</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: COLORS.muted }}>Referans</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockDetail.movements.map((move) => (
                      <tr key={move.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                        <td style={{ padding: '12px', color: COLORS.text }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            backgroundColor: move.movementType === 'ENTRY' ? '#d1fae5' : '#fee2e2',
                            color: move.movementType === 'ENTRY' ? '#065f46' : '#991b1b',
                            fontSize: '11px',
                            fontWeight: 'bold'
                          }}>
                            {move.movementType === 'ENTRY' ? 'Giriş' : move.movementType === 'EXIT' ? 'Çıkış' : move.movementType}
                          </span>
                        </td>
                        <td style={{ padding: '12px', color: COLORS.text }}>
                          {move.quantity}
                        </td>
                        <td style={{ padding: '12px', color: COLORS.muted }}>
                          {new Date(move.movementDate).toLocaleDateString('tr-TR')}
                        </td>
                        <td style={{ padding: '12px', color: COLORS.muted }}>
                          {move.referenceId || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Yeni Stok Kartı Modal */}
      {showNewCardModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setShowNewCardModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 800,
              maxHeight: '90vh',
              overflow: 'auto',
              background: COLORS.bg.surface,
              borderRadius: RADIUS.lg,
              border: `1px solid ${COLORS.border}`,
              padding: 24,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${COLORS.border}` }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: TYPOGRAPHY.fontWeight.bold, color: COLORS.text, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Plus size={20} /> Yeni Stok Kartı
              </h2>
              <button onClick={() => setShowNewCardModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: COLORS.muted, padding: 4 }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateStockCard} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, padding: '10px 0' }}>

              {/* Sol Kolon - Temel Bilgiler */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: COLORS.primary.DEFAULT, borderBottom: `1px solid ${COLORS.border}`, paddingBottom: 8 }}>
                  Temel Bilgiler
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: COLORS.muted, marginBottom: 4, fontWeight: 600 }}>Stok Kodu *</label>
                    <input type="text" required value={newCardForm.stock_code} onChange={(e) => setNewCardForm(f => ({ ...f, stock_code: e.target.value }))} placeholder="STK-001" style={{ width: '100%', padding: '10px 12px', border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md, background: COLORS.bg.main, color: COLORS.text, fontSize: 14, fontFamily: TYPOGRAPHY.fontFamily.base, boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: COLORS.muted, marginBottom: 4, fontWeight: 600 }}>Birim</label>
                    <select value={newCardForm.unit} onChange={(e) => setNewCardForm(f => ({ ...f, unit: e.target.value }))} style={{ width: '100%', padding: '10px 12px', border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md, background: COLORS.bg.main, color: COLORS.text, fontSize: 14, boxSizing: 'border-box' }}>
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
                  <label style={{ display: 'block', fontSize: 12, color: COLORS.muted, marginBottom: 4, fontWeight: 600 }}>Stok Adı *</label>
                  <input type="text" required value={newCardForm.stock_name} onChange={(e) => setNewCardForm(f => ({ ...f, stock_name: e.target.value }))} placeholder="Ürün adı" style={{ width: '100%', padding: '10px 12px', border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md, background: COLORS.bg.main, color: COLORS.text, fontSize: 14, fontFamily: TYPOGRAPHY.fontFamily.base, boxSizing: 'border-box' }} />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, color: COLORS.muted, marginBottom: 4, fontWeight: 600 }}>Başlangıç Miktarı</label>
                  <input type="number" step="1" min="0" value={newCardForm.total_quantity} onChange={(e) => setNewCardForm(f => ({ ...f, total_quantity: e.target.value }))} style={{ width: '100%', padding: '10px 12px', border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md, background: COLORS.bg.main, color: COLORS.text, fontSize: 14, boxSizing: 'border-box' }} />
                </div>
              </div>

              {/* Sağ Kolon - Fiyat ve Özellikler */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: COLORS.primary.DEFAULT, borderBottom: `1px solid ${COLORS.border}`, paddingBottom: 8 }}>
                  Fiyat ve Özellikler
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: COLORS.muted, marginBottom: 4, fontWeight: 600 }}>Alış Fiyatı (₺)</label>
                    <input type="number" step="0.01" min="0" value={newCardForm.purchase_price} onChange={(e) => setNewCardForm(f => ({ ...f, purchase_price: e.target.value }))} placeholder="0.00" style={{ width: '100%', padding: '10px 12px', border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md, background: COLORS.bg.main, color: COLORS.text, fontSize: 14, boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: COLORS.muted, marginBottom: 4, fontWeight: 600 }}>Satış Fiyatı (₺)</label>
                    <input type="number" step="0.01" min="0" value={newCardForm.sale_price} onChange={(e) => setNewCardForm(f => ({ ...f, sale_price: e.target.value }))} placeholder="0.00" style={{ width: '100%', padding: '10px 12px', border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md, background: COLORS.bg.main, color: COLORS.text, fontSize: 14, boxSizing: 'border-box' }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: COLORS.muted, marginBottom: 4, fontWeight: 600 }}>Renk</label>
                    <input type="text" value={newCardForm.color} onChange={(e) => setNewCardForm(f => ({ ...f, color: e.target.value }))} placeholder="Beyaz" style={{ width: '100%', padding: '10px 12px', border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md, background: COLORS.bg.main, color: COLORS.text, fontSize: 14, fontFamily: TYPOGRAPHY.fontFamily.base, boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: COLORS.muted, marginBottom: 4, fontWeight: 600 }}>Kalınlık</label>
                    <input type="text" value={newCardForm.thickness} onChange={(e) => setNewCardForm(f => ({ ...f, thickness: e.target.value }))} placeholder="18mm" style={{ width: '100%', padding: '10px 12px', border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md, background: COLORS.bg.main, color: COLORS.text, fontSize: 14, fontFamily: TYPOGRAPHY.fontFamily.base, boxSizing: 'border-box' }} />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, color: COLORS.muted, marginBottom: 4, fontWeight: 600 }}>Depo Konumu</label>
                  <input type="text" value={newCardForm.warehouse_location} onChange={(e) => setNewCardForm(f => ({ ...f, warehouse_location: e.target.value }))} placeholder="A-01" style={{ width: '100%', padding: '10px 12px', border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md, background: COLORS.bg.main, color: COLORS.text, fontSize: 14, fontFamily: TYPOGRAPHY.fontFamily.base, boxSizing: 'border-box' }} />
                </div>
              </div>

              {newCardError && (
                <div style={{ gridColumn: '1 / -1', padding: 10, background: COLORS.error.light, border: `1px solid ${COLORS.error.DEFAULT}`, borderRadius: RADIUS.md, color: COLORS.error.DEFAULT, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertCircle size={14} /> {newCardError}
                </div>
              )}

              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12, paddingTop: 16, borderTop: `1px solid ${COLORS.border}` }}>
                <button type="button" onClick={() => setShowNewCardModal(false)} disabled={newCardLoading} style={{ padding: '10px 16px', border: `1px solid ${COLORS.border}`, background: COLORS.bg.main, color: COLORS.text, borderRadius: RADIUS.md, cursor: 'pointer', fontSize: 14, fontWeight: 500, minWidth: 100 }}>
                  Vazgeç
                </button>
                <button type="submit" disabled={newCardLoading} style={{ padding: '10px 16px', border: 'none', background: COLORS.primary.DEFAULT, color: 'white', borderRadius: RADIUS.md, cursor: newCardLoading ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600, opacity: newCardLoading ? 0.7 : 1, minWidth: 140 }}>
                  {newCardLoading ? 'Oluşturuluyor...' : 'Stok Kartı Oluştur'}
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
