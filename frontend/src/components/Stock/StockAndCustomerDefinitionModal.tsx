import React, { useState, useEffect } from 'react';
import { Search, X, Plus, ArrowRight, Package, Users, Palette, Ruler, BarChart3, Smartphone, Mail, Building2 } from 'lucide-react';
import { COLORS, RADIUS, TYPOGRAPHY, primaryRgba } from '../Shared/constants';

export interface StockDefinition {
  stock_code: string;
  stock_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  thickness?: string;
  color?: string;
}

export interface CustomerDefinition {
  customer_id: string;
  customer_name: string;
  phone: string;
  email: string;
  tax_number?: string;
  address: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelectStock?: (stock: StockDefinition) => void;
  onSelectCustomer?: (customer: CustomerDefinition) => void;
  onOpenStockCard?: (stockCode: string) => void;
  onOpenCustomerCard?: (customerId: string) => void;
}

export const StockAndCustomerDefinitionModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSelectStock,
  onSelectCustomer,
  onOpenStockCard,
  onOpenCustomerCard
}) => {
  const [activeTab, setActiveTab] = useState<'stock' | 'customer'>('stock');
  
  // Stok Form
  const [stockSearch, setStockSearch] = useState('');
  const [selectedStock, setSelectedStock] = useState<StockDefinition | null>(null);
  const [stockQuantity, setStockQuantity] = useState(1);
  const [stockUnitPrice, setStockUnitPrice] = useState(0);
  
  // Cari Form
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDefinition | null>(null);
  
  // Gerçek API'den veri çek
  const [stockSearchResults, setStockSearchResults] = useState<StockDefinition[]>([]);
  const [customerSearchResults, setCustomerSearchResults] = useState<CustomerDefinition[]>([]);
  const [, setSearching] = useState(false);

  const asString = (value: unknown): string => (typeof value === "string" ? value : "");
  const asNumber = (value: unknown): number => (typeof value === "number" ? value : Number(value) || 0);
  
  // Stok ara - API çağrısı
  useEffect(() => {
    if (!stockSearch.trim()) {
      setStockSearchResults([]);
      return;
    }
    
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/v1/stock/stock-cards/search?q=${encodeURIComponent(stockSearch)}`);
        if (response.ok) {
          const data = await response.json();
          setStockSearchResults(data.map((s: Record<string, unknown>) => {
            const quantity = asNumber(s.quantity);
            const unitPrice = asNumber(s.unit_price);
            return {
              stock_code: asString(s.stock_code),
              stock_name: asString(s.stock_name),
              quantity,
              unit_price: unitPrice,
              total_price: quantity * unitPrice,
              thickness: asString(s.thickness),
              color: asString(s.color),
            };
          }));
        }
      } catch (err) {
        console.error('Stok arama hatası:', err);
      } finally {
        setSearching(false);
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [stockSearch]);
  
  // Müşteri ara - API çağrısı
  useEffect(() => {
    if (!customerSearch.trim()) {
      setCustomerSearchResults([]);
      return;
    }
    
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/v1/crm/accounts/search?q=${encodeURIComponent(customerSearch)}`);
        if (response.ok) {
          const data = await response.json();
          setCustomerSearchResults(data.map((c: Record<string, unknown>) => ({
            customer_id: asString(c.id),
            customer_name: asString(c.name),
            phone: asString(c.phone),
            email: asString(c.email),
            tax_number: asString(c.tax_number),
            address: asString(c.address),
          })));
        }
      } catch (err) {
        console.error('Müşteri arama hatası:', err);
      } finally {
        setSearching(false);
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [customerSearch]);

  const handleStockSelect = (stock: StockDefinition) => {
    setSelectedStock(stock);
    setStockUnitPrice(stock.unit_price);
  };

  const handleAddStock = () => {
    if (selectedStock && stockQuantity > 0) {
      const definition: StockDefinition = {
        ...selectedStock,
        quantity: stockQuantity,
        unit_price: stockUnitPrice,
        total_price: stockQuantity * stockUnitPrice
      };
      onSelectStock?.(definition);
      // Formu sıfırla
      setSelectedStock(null);
      setStockQuantity(1);
      setStockUnitPrice(0);
      setStockSearch('');
    }
  };

  const handleCustomerSelect = (customer: CustomerDefinition) => {
    setSelectedCustomer(customer);
    onSelectCustomer?.(customer);
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: COLORS.bg.surface,
          borderRadius: RADIUS.lg,
          maxWidth: 900,
          width: '95%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px',
            borderBottom: `1px solid ${COLORS.border}`,
            position: 'sticky',
            top: 0,
            backgroundColor: COLORS.bg.surface
          }}
        >
          <div>
            <h2 style={{ fontSize: 20, fontWeight: TYPOGRAPHY.fontWeight.bold, color: COLORS.text, margin: 0, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
              <Package size={20} aria-hidden /> Stok ve Cari Tanımlama
            </h2>
            <p style={{ fontSize: 12, color: COLORS.muted, margin: 0 }}>
              Stok ve müşteri bilgilerini tanımla, hızlıca kartlarını aç
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: COLORS.muted,
              fontSize: 24
            }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: `2px solid ${COLORS.border}`,
            backgroundColor: COLORS.bg.main
          }}
        >
          <button
            onClick={() => setActiveTab('stock')}
            style={{
              flex: 1,
              padding: '16px',
              backgroundColor: activeTab === 'stock' ? COLORS.bg.surface : COLORS.bg.main,
              border: 'none',
              borderBottom: activeTab === 'stock' ? `2px solid ${COLORS.primary.DEFAULT}` : 'none',
              cursor: 'pointer',
              fontWeight: TYPOGRAPHY.fontWeight.bold,
              color: activeTab === 'stock' ? COLORS.primary.DEFAULT : COLORS.muted,
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6
            }}
          >
            <Package size={16} aria-hidden /> Stok Tanımlama
          </button>
          <button
            onClick={() => setActiveTab('customer')}
            style={{
              flex: 1,
              padding: '16px',
              backgroundColor: activeTab === 'customer' ? COLORS.bg.surface : COLORS.bg.main,
              border: 'none',
              borderBottom: activeTab === 'customer' ? `2px solid ${COLORS.primary.DEFAULT}` : 'none',
              cursor: 'pointer',
              fontWeight: TYPOGRAPHY.fontWeight.bold,
              color: activeTab === 'customer' ? COLORS.primary.DEFAULT : COLORS.muted,
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6
            }}
          >
            <Users size={16} aria-hidden /> Cari Tanımlama
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>
          {/* Stock Tab */}
          {activeTab === 'stock' && (
            <div>
              <div style={{ marginBottom: 24 }}>
                <label style={{ fontSize: 14, fontWeight: TYPOGRAPHY.fontWeight.bold, color: COLORS.text, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Search size={14} aria-hidden /> Stok Ara
                </label>
                <div style={{ position: 'relative' }}>
                  <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: COLORS.muted }} />
                  <input
                    type="text"
                    placeholder="Stok kodu veya adı ile ara..."
                    value={stockSearch}
                    onChange={(e) => setStockSearch(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 40px',
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: RADIUS.sm,
                      fontSize: 14,
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Arama Sonuçları */}
              {stockSearch && stockSearchResults.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ fontSize: 12, fontWeight: TYPOGRAPHY.fontWeight.bold, color: COLORS.muted, marginBottom: 8, display: 'block' }}>
                    ARAMA SONUÇLARI
                  </label>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {stockSearchResults.map((stock) => (
                      <div
                        key={stock.stock_code}
                        onClick={() => handleStockSelect(stock)}
                        style={{
                          padding: '12px',
                          border: selectedStock?.stock_code === stock.stock_code 
                            ? `2px solid ${COLORS.primary.DEFAULT}` 
                            : `1px solid ${COLORS.border}`,
                          borderRadius: RADIUS.sm,
                          backgroundColor: selectedStock?.stock_code === stock.stock_code ? primaryRgba(0.08) : COLORS.bg.main,
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          if (selectedStock?.stock_code !== stock.stock_code) {
                            e.currentTarget.style.backgroundColor = COLORS.bg.surface;
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (selectedStock?.stock_code !== stock.stock_code) {
                            e.currentTarget.style.backgroundColor = COLORS.bg.main;
                          }
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '6px' }}>
                          <div>
                            <div style={{ fontWeight: 'bold', color: COLORS.primary.DEFAULT, fontSize: '13px' }}>
                              {stock.stock_code}
                            </div>
                            <div style={{ fontSize: '12px', color: COLORS.text }}>
                              {stock.stock_name}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', fontSize: '12px' }}>
                            <div style={{ color: COLORS.muted }}>Fiyat</div>
                            <div style={{ fontWeight: 'bold', color: COLORS.primary.DEFAULT }}>
                              ₺{stock.unit_price.toFixed(2)}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: COLORS.muted }}>
                          {stock.thickness && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Ruler size={10} aria-hidden /> {stock.thickness}</span>}
                          {stock.color && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Palette size={10} aria-hidden /> {stock.color}</span>}
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><BarChart3 size={10} aria-hidden /> {stock.quantity} {stock.stock_name.includes('Levha') ? 'm²' : 'Adet'} Stok</span>
                        </div>
                        {selectedStock?.stock_code === stock.stock_code && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenStockCard?.(stock.stock_code);
                            }}
                            style={{
                              marginTop: '8px',
                              padding: '4px 8px',
                              fontSize: '11px',
                              backgroundColor: COLORS.success.DEFAULT,
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                          >
                            <Package size={12} aria-hidden /> Stok Kartını Aç
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Seçili Stok Form */}
              {selectedStock && (
                <div
                  style={{
                    backgroundColor: primaryRgba(0.08),
                    padding: 16,
                    borderRadius: RADIUS.md,
                    border: `2px solid ${COLORS.primary.DEFAULT}`,
                    marginBottom: 24
                  }}
                >
                  <div style={{ fontWeight: TYPOGRAPHY.fontWeight.bold, fontSize: 14, color: COLORS.primary.DEFAULT, marginBottom: 12 }}>
                    [OK] Seçili Stok: {selectedStock.stock_code}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 'bold', color: COLORS.text, display: 'block', marginBottom: '4px' }}>
                        Miktar
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={stockQuantity}
                        onChange={(e) => setStockQuantity(Number(e.target.value) || 1)}
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: `1px solid ${COLORS.border}`,
                          borderRadius: '4px',
                          fontSize: '13px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 'bold', color: COLORS.text, display: 'block', marginBottom: '4px' }}>
                        Birim Fiyat (₺)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={stockUnitPrice}
                        onChange={(e) => setStockUnitPrice(Number(e.target.value) || 0)}
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: `1px solid ${COLORS.border}`,
                          borderRadius: '4px',
                          fontSize: '13px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>

                  <div
                    style={{
                      backgroundColor: COLORS.bg.surface,
                      padding: 12,
                      borderRadius: RADIUS.sm,
                      marginBottom: 12,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <span style={{ fontSize: 13, color: COLORS.muted }}>Toplam Tutar:</span>
                    <span style={{ fontSize: 16, fontWeight: TYPOGRAPHY.fontWeight.bold, color: COLORS.primary.DEFAULT }}>
                      ₺{(stockQuantity * stockUnitPrice).toFixed(2)}
                    </span>
                  </div>

                  <button
                    onClick={handleAddStock}
                    style={{
                      width: '100%',
                      padding: 10,
                      backgroundColor: COLORS.success.DEFAULT,
                      color: 'white',
                      border: 'none',
                      borderRadius: RADIUS.md,
                      fontWeight: TYPOGRAPHY.fontWeight.bold,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <Plus size={16} /> Stoğu Ekle
                  </button>
                </div>
              )}

              {stockSearch && stockSearchResults.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', color: COLORS.muted }}>
                  <p>Arama sonucu bulunamadı</p>
                </div>
              )}
            </div>
          )}

          {/* Customer Tab */}
          {activeTab === 'customer' && (
            <div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ fontSize: '14px', fontWeight: 'bold', color: COLORS.text, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Search size={14} aria-hidden /> Cari Ara
                </label>
                <div style={{ position: 'relative' }}>
                  <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: COLORS.muted }} />
                  <input
                    type="text"
                    placeholder="Müşteri kodu veya adı ile ara..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 40px',
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: '6px',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Arama Sonuçları */}
              {customerSearch && customerSearchResults.length > 0 && (
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: COLORS.muted, marginBottom: '8px', display: 'block' }}>
                    ARAMA SONUÇLARI
                  </label>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {customerSearchResults.map((customer) => (
                      <div
                        key={customer.customer_id}
                        onClick={() => handleCustomerSelect(customer)}
                        style={{
                          padding: '14px',
                          border: selectedCustomer?.customer_id === customer.customer_id 
                            ? `2px solid ${COLORS.success.DEFAULT}` 
                            : `1px solid ${COLORS.border}`,
                          borderRadius: '6px',
                          backgroundColor: selectedCustomer?.customer_id === customer.customer_id ? COLORS.success.light : COLORS.bg.main,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                        onMouseEnter={(e) => {
                          if (selectedCustomer?.customer_id !== customer.customer_id) {
                            e.currentTarget.style.backgroundColor = COLORS.bg.surface;
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (selectedCustomer?.customer_id !== customer.customer_id) {
                            e.currentTarget.style.backgroundColor = COLORS.bg.main;
                          }
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 'bold', color: COLORS.primary.DEFAULT, fontSize: '13px', marginBottom: '4px' }}>
                            {customer.customer_name}
                          </div>
                          <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: COLORS.muted }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Smartphone size={12} aria-hidden /> {customer.phone}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Mail size={12} aria-hidden /> {customer.email}</span>
                            {customer.tax_number && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Building2 size={12} aria-hidden /> VKN: {customer.tax_number}</span>}
                          </div>
                        </div>
                        {selectedCustomer?.customer_id === customer.customer_id && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenCustomerCard?.(customer.customer_id);
                            }}
                            style={{
                              padding: '6px 12px',
                              fontSize: '12px',
                              backgroundColor: COLORS.success.DEFAULT,
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            <Users size={14} aria-hidden /> Cari Kartı Aç <ArrowRight size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {customerSearch && customerSearchResults.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', color: COLORS.muted }}>
                  <p>Arama sonucu bulunamadı</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: `1px solid ${COLORS.border}`,
            backgroundColor: COLORS.bg.main,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px'
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '10px 16px',
              backgroundColor: COLORS.bg.main,
              color: COLORS.text,
              border: `1px solid ${COLORS.border}`,
              borderRadius: RADIUS.md,
              fontWeight: TYPOGRAPHY.fontWeight.bold,
              cursor: 'pointer'
            }}
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};

export default StockAndCustomerDefinitionModal;
