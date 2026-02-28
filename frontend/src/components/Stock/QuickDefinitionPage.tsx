import React, { useState } from 'react';
import { Plus, Package, Users, AlertCircle, Zap, Clock, Smartphone, Mail } from 'lucide-react';
import {
  StockAndCustomerDefinitionModal,
  type StockDefinition,
  type CustomerDefinition,
} from './StockAndCustomerDefinitionModal';
import { StockCardComponent } from './StockCardComponent';
import { COLORS, RADIUS, TYPOGRAPHY, primaryRgba } from '../Shared/constants';

interface DefinedItem {
  id: string;
  type: 'stock' | 'customer';
  stock_code?: string;
  stock_name?: string;
  quantity?: number;
  unit_price?: number;
  total_price?: number;
  customer_id?: string;
  customer_name?: string;
  phone?: string;
  email?: string;
  defined_at: string;
}

export const QuickDefinitionPage: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [definedItems, setDefinedItems] = useState<DefinedItem[]>([]);
  const [selectedStockCard, setSelectedStockCard] = useState<string | null>(null);
  const [, setSelectedCustomerCard] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'definition' | 'stock-card' | 'customer-card'>('definition');

  const handleAddStock = (stock: StockDefinition) => {
    const newItem: DefinedItem = {
      id: `stock_${Date.now()}`,
      type: 'stock',
      stock_code: stock.stock_code,
      stock_name: stock.stock_name,
      quantity: stock.quantity,
      unit_price: stock.unit_price,
      total_price: stock.total_price,
      defined_at: new Date().toLocaleTimeString('tr-TR')
    };
    setDefinedItems([newItem, ...definedItems]);
  };

  const handleAddCustomer = (customer: CustomerDefinition) => {
    const newItem: DefinedItem = {
      id: `customer_${Date.now()}`,
      type: 'customer',
      customer_id: customer.customer_id,
      customer_name: customer.customer_name,
      phone: customer.phone,
      email: customer.email,
      defined_at: new Date().toLocaleTimeString('tr-TR')
    };
    setDefinedItems([newItem, ...definedItems]);
  };

  const handleRemoveItem = (id: string) => {
    setDefinedItems(definedItems.filter(item => item.id !== id));
  };

  const handleOpenStockCard = (stockCode: string) => {
    setSelectedStockCard(stockCode);
    setViewMode('stock-card');
    setIsModalOpen(false);
  };

  const handleOpenCustomerCard = (customerId: string) => {
    setSelectedCustomerCard(customerId);
    setViewMode('customer-card');
    setIsModalOpen(false);
  };

  // Stok Kartı görünümü
  if (viewMode === 'stock-card' && selectedStockCard) {
    return (
      <div style={{ padding: 20, minHeight: '100vh', backgroundColor: COLORS.bg.main }}>
        <button
          onClick={() => setViewMode('definition')}
          style={{
            marginBottom: '20px',
            padding: '10px 16px',
            backgroundColor: COLORS.primary.DEFAULT,
            color: 'white',
            border: 'none',
            borderRadius: RADIUS.md,
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          ← Tanımlama Sayfasına Dön
        </button>
        <StockCardComponent />
      </div>
    );
  }

  // Ana tanımlama sayfası
  return (
    <div style={{ padding: 20, minHeight: '100vh', backgroundColor: COLORS.bg.main }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: 28, fontWeight: TYPOGRAPHY.fontWeight.bold, color: COLORS.text, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Zap size={28} aria-hidden /> Hızlı Tanımlama
        </h1>
        <p style={{ color: COLORS.muted, fontSize: 14 }}>
          Stok ve müşteri bilgilerini hızlıca tanımla, kartlarını aç
        </p>
      </div>

      {/* Action Buttons */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}
      >
        <button
          onClick={() => setIsModalOpen(true)}
          style={{
            padding: 24,
            backgroundColor: COLORS.bg.surface,
            border: `2px solid ${COLORS.primary.DEFAULT}`,
            borderRadius: RADIUS.md,
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = primaryRgba(0.08);
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = COLORS.bg.surface;
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <Plus size={32} style={{ color: COLORS.primary.DEFAULT }} />
          <div>
            <div style={{ fontWeight: TYPOGRAPHY.fontWeight.bold, fontSize: 16, color: COLORS.primary.DEFAULT }}>
              Yeni Tanımlama
            </div>
            <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4 }}>
              Stok ve cari ekle
            </div>
          </div>
        </button>

        <div
          style={{
            padding: 24,
            backgroundColor: COLORS.bg.surface,
            border: `1px solid ${COLORS.border}`,
            borderRadius: RADIUS.md,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <Package size={24} style={{ color: COLORS.primary.DEFAULT }} />
            <div>
              <div style={{ fontWeight: TYPOGRAPHY.fontWeight.bold, fontSize: 18, color: COLORS.primary.DEFAULT }}>
                {definedItems.filter(i => i.type === 'stock').length}
              </div>
              <div style={{ fontSize: 12, color: COLORS.muted }}>
                Stok Tanıması
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            padding: 24,
            backgroundColor: COLORS.bg.surface,
            border: `1px solid ${COLORS.border}`,
            borderRadius: RADIUS.md,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <Users size={24} style={{ color: COLORS.success.DEFAULT }} />
            <div>
              <div style={{ fontWeight: TYPOGRAPHY.fontWeight.bold, fontSize: 18, color: COLORS.success.DEFAULT }}>
                {definedItems.filter(i => i.type === 'customer').length}
              </div>
              <div style={{ fontSize: 12, color: COLORS.muted }}>
                Cari Tanıması
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tanımlanan Öğeler */}
      {definedItems.length > 0 && (
        <div
          style={{
            backgroundColor: COLORS.bg.surface,
            borderRadius: RADIUS.md,
            border: `1px solid ${COLORS.border}`,
            padding: 20
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: TYPOGRAPHY.fontWeight.bold, color: COLORS.text, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Package size={18} aria-hidden /> Tanımlanan Öğeler ({definedItems.length})
          </h2>

          <div 
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '12px'
            }}
          >
            {definedItems.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: 12,
                  backgroundColor: item.type === 'stock' ? primaryRgba(0.08) : COLORS.success.light,
                  border: `1px solid ${item.type === 'stock' ? COLORS.primary.DEFAULT : COLORS.success.DEFAULT}`,
                  borderRadius: RADIUS.sm,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start'
                }}
              >
                <div style={{ flex: 1 }}>
                  {item.type === 'stock' ? (
                    <>
                      <div style={{ fontWeight: 'bold', fontSize: '13px', color: COLORS.primary.DEFAULT, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Package size={14} aria-hidden /> {item.stock_code}
                      </div>
                      <div style={{ fontSize: '12px', color: COLORS.text }}>
                        {item.stock_name}
                      </div>
                      <div style={{ fontSize: '11px', color: COLORS.muted, marginTop: '4px' }}>
                        {item.quantity} Adet × ₺{item.unit_price?.toFixed(2)} = 
                        <span style={{ fontWeight: 'bold', color: COLORS.primary.DEFAULT }}>
                          {' '}₺{item.total_price?.toFixed(2)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontWeight: 'bold', fontSize: '13px', color: COLORS.success.DEFAULT, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Users size={14} aria-hidden /> {item.customer_name}
                      </div>
                      <div style={{ fontSize: '11px', color: COLORS.muted, marginTop: '4px', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Smartphone size={12} aria-hidden /> {item.phone} | <Mail size={12} aria-hidden /> {item.email}
                      </div>
                    </>
                  )}
                  <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={12} aria-hidden /> {item.defined_at}
                  </div>
                </div>

                <button
                  onClick={() => handleRemoveItem(item.id)}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: COLORS.danger.DEFAULT,
                    color: 'white',
                    border: 'none',
                    borderRadius: RADIUS.sm,
                    fontSize: 11,
                    cursor: 'pointer',
                    marginLeft: 8
                  }}
                >
                  Sil
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Boş Durum */}
      {definedItems.length === 0 && (
        <div
          style={{
            backgroundColor: COLORS.bg.surface,
            borderRadius: RADIUS.md,
            padding: '60px 20px',
            textAlign: 'center',
            border: `1px dashed ${COLORS.border}`
          }}
        >
          <AlertCircle size={48} style={{ color: COLORS.muted, marginBottom: '16px', opacity: 0.5 }} />
          <p style={{ color: COLORS.muted, fontSize: 14, marginBottom: 16 }}>
            Henüz hiçbir stok veya cari tanımlaması yapılmadı
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            style={{
              padding: '10px 20px',
              backgroundColor: COLORS.primary.DEFAULT,
              color: 'white',
              border: 'none',
              borderRadius: RADIUS.md,
              fontWeight: TYPOGRAPHY.fontWeight.bold,
              cursor: 'pointer'
            }}
          >
            <Plus size={16} style={{ marginRight: '8px', display: 'inline' }} />
            Şimdi Ekle
          </button>
        </div>
      )}

      {/* Modal */}
      <StockAndCustomerDefinitionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelectStock={handleAddStock}
        onSelectCustomer={handleAddCustomer}
        onOpenStockCard={handleOpenStockCard}
        onOpenCustomerCard={handleOpenCustomerCard}
      />
    </div>
  );
};

export default QuickDefinitionPage;
