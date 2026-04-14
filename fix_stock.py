"""
StockCardComponent.tsx için kapsamlı düzeltmeler:
1. StockCardDetailResponse interface genişletme (purchasePrice, barkodlar, satisFiyatlari)
2. Integration service import ekleme
3. Yeni state'ler (entityMaps, outbox, barkod/fiyat satırları)
4. handleCreateStockCard: trim, validasyon, payload güncellemesi
5. Detail view: section başlıkları, sıfır fiyat gösterimi, teknik panel, barkod/fiyat bölümleri
6. Form: aria-label, düzeltilmiş etiketler, barkod/fiyat satırı UI, yeni buton adı
"""

import re

f = r'C:\optiplan360_project\frontend\src\features\Stock\StockCardComponent.tsx'
with open(f, 'r', encoding='utf-8') as fp:
    content = fp.read()

# 1. Add integrationService import
old = "import { apiRequest } from '../../services/apiClient';"
new = """import { apiRequest } from '../../services/apiClient';
import { integrationService } from '../../services/integrationService';"""
content = content.replace(old, new, 1)

# 2. Extend StockCardDetailResponse interface
old = """interface StockCardDetailResponse {


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


}"""
new = """interface Barkod {
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


  totalQuantity: number;


  availableQuantity: number;


  reservedQuantity: number;


  purchasePrice?: number | null;


  salePrice: number | null;


  color: string | null;


  thickness: string | null;


  warehouseLocation: string | null;


  unit: string;


  isActive: boolean;


  movements: StockMovement[];


  barkodlar?: Barkod[];


  satisFiyatlari?: SatisFiyati[];


}"""
content = content.replace(old, new, 1)

# 3. Add state variables after showNewCardModal/newCardForm/etc.
# Find the existing state block and add new states
old = "  const [newCardError, setNewCardError] = useState<string | null>(null);"
new = """  const [newCardError, setNewCardError] = useState<string | null>(null);
  const [barkodSatirlari, setBarkodSatirlari] = useState<string[]>(['']);
  const [fiyatSatirlari, setFiyatSatirlari] = useState<Array<{ priceType: string; amount: string }>>([{ priceType: '', amount: '' }]);
  const [entityMaps, setEntityMaps] = useState<Array<{ id: string; externalSystem: string; externalId: string }>>([]);
  const [outbox, setOutbox] = useState<Array<{ id: string; operation: string; status: string; errorMessage?: string }>>([]);"""
content = content.replace(old, new, 1)

# 4. Update fetchStockCardDetail to also call integration services
old = """  // Stok kartı detaylarını getir


  const fetchStockCardDetail = async (stockCode: string) => {


    setLoading(true);


    try {


      const data = await apiRequest<StockCardDetailResponse>(`/stock/stock-cards/${stockCode}`);


      setStockDetail(data);


      setActiveTab('detail');


    } catch (error) {


      console.error('Stok kartı detayı yükleme hatası:', error);"""
new = """  // Stok kartı detaylarını getir


  const fetchStockCardDetail = async (stockCode: string) => {


    setLoading(true);


    try {


      const data = await apiRequest<StockCardDetailResponse>(`/stock/stock-cards/${stockCode}`);


      setStockDetail(data);


      setActiveTab('detail');


      // Integration panel data
      const svc = integrationService as unknown as {
        listEntityMaps(p: unknown): Promise<Array<{ id: string; externalSystem: string; externalId: string }>>;
        listOutbox(p: unknown): Promise<Array<{ id: string; operation: string; status: string; errorMessage?: string }>>;
      };
      const [maps, outboxData] = await Promise.all([
        svc.listEntityMaps({ entity_type: 'STOCK_CARD', internal_id: data.id }),
        svc.listOutbox({ entity_type: 'STOCK_CARD', entity_id: data.id }),
      ]);
      setEntityMaps(maps);
      setOutbox(outboxData);


    } catch (error) {


      console.error('Stok kartı detayı yükleme hatası:', error);"""
content = content.replace(old, new, 1)

# 5. Update handleCreateStockCard for trimming, validation, and new payload
old = """  // Yeni stok kartı oluştur


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


      setNewCardLoading(false);"""
new = """  // Yeni stok kartı oluştur


  const handleCreateStockCard = async (e: React.FormEvent) => {


    e.preventDefault();


    if (!newCardForm.stock_code.trim() || !newCardForm.stock_name.trim()) {


      setNewCardError('Stok kodu ve adı zorunludur');


      return;


    }


    // Barcode duplicate check
    const validBarcodes = barkodSatirlari.map(b => b.trim()).filter(b => b !== '');
    const uniqueBarcodes = new Set(validBarcodes);
    if (uniqueBarcodes.size !== validBarcodes.length) {
      setNewCardError('Aynı barkod bir stok kartında tekrar edemez');
      return;
    }


    // Price row validation: each row must have both type and amount, or both empty
    const validFiyatlar: Array<{ price_type: string; amount: number }> = [];
    for (const row of fiyatSatirlari) {
      const pt = row.priceType.trim();
      const am = row.amount.trim();
      if (pt === '' && am === '') continue; // empty row = ignore
      if (pt !== '' && am === '') { setNewCardError('Satış fiyat satırlarında fiyat tipi ve tutar birlikte girilmelidir'); return; }
      if (pt === '' && am !== '') { setNewCardError('Satış fiyat satırlarında fiyat tipi ve tutar birlikte girilmelidir'); return; }
      validFiyatlar.push({ price_type: pt, amount: parseFloat(am) });
    }


    // Price type duplicate check
    const priceTypes = validFiyatlar.map(r => r.price_type);
    const uniquePriceTypes = new Set(priceTypes);
    if (uniquePriceTypes.size !== priceTypes.length) {
      setNewCardError('Aynı fiyat tipi bir stok kartında tekrar edemez');
      return;
    }


    setNewCardLoading(true);


    setNewCardError(null);


    try {


      const result = await apiRequest<StockCardDetailResponse>('/stock/stock-cards', {


        method: 'POST',


        body: JSON.stringify({


          stock_code: newCardForm.stock_code.trim(),


          stock_name: newCardForm.stock_name.trim(),


          unit: newCardForm.unit,


          purchase_price: newCardForm.purchase_price ? parseFloat(newCardForm.purchase_price) : null,


          sale_price: newCardForm.sale_price ? parseFloat(newCardForm.sale_price) : null,


          total_quantity: parseFloat(newCardForm.total_quantity) || 0,


          thickness: newCardForm.thickness ? newCardForm.thickness.trim() : null,


          color: newCardForm.color ? newCardForm.color.trim() : null,


          warehouse_location: newCardForm.warehouse_location ? newCardForm.warehouse_location.trim() : null,


          material_type: null,


          width_mm: null,


          height_mm: null,


          barkodlar: validBarcodes.map(b => ({ barcode: b })),


          satis_fiyatlari: validFiyatlar,


        }),


      });


      setShowNewCardModal(false);


      setNewCardForm(EMPTY_FORM);


      setBarkodSatirlari(['']);


      setFiyatSatirlari([{ priceType: '', amount: '' }]);


      setStockDetail(result);


      setActiveTab('detail');


      fetchStockCards();


    } catch (err: unknown) {


      setNewCardError(err instanceof Error ? err.message : 'Stok kartı oluşturulamadı');


    } finally {


      setNewCardLoading(false);"""
content = content.replace(old, new, 1)

print("Changes 1-5 applied")

# 6. Fix form field labels and add aria-labels
# Fix "Birim" label to "Birim *"
content = content.replace(
    """                    <label style={{ display: 'block', fontSize: 12, color: COLORS.muted, marginBottom: 4, fontWeight: 600 }}>Birim</label>
                    <select value={newCardForm.unit}""",
    """                    <label style={{ display: 'block', fontSize: 12, color: COLORS.muted, marginBottom: 4, fontWeight: 600 }}>Birim *</label>
                    <select aria-label="Birim *" value={newCardForm.unit}""",
    1
)

# Fix Stok Kodu input - add aria-label
content = content.replace(
    """                    <label style={{ display: 'block', fontSize: 12, color: COLORS.muted, marginBottom: 4, fontWeight: 600 }}>Stok Kodu *</label>
                    <input type="text" required value={newCardForm.stock_code}""",
    """                    <label style={{ display: 'block', fontSize: 12, color: COLORS.muted, marginBottom: 4, fontWeight: 600 }}>Stok Kodu *</label>
                    <input aria-label="Stok Kodu *" type="text" required value={newCardForm.stock_code}""",
    1
)

# Fix Stok Adı input - add aria-label
content = content.replace(
    """                  <label style={{ display: 'block', fontSize: 12, color: COLORS.muted, marginBottom: 4, fontWeight: 600 }}>Stok Adı *</label>
                  <input type="text" required value={newCardForm.stock_name}""",
    """                  <label style={{ display: 'block', fontSize: 12, color: COLORS.muted, marginBottom: 4, fontWeight: 600 }}>Stok Adı *</label>
                  <input aria-label="Stok Adı *" type="text" required value={newCardForm.stock_name}""",
    1
)

# Fix "Başlangıç Miktarı" to "Toplam Stok"
content = content.replace(
    """                  <label style={{ display: 'block', fontSize: 12, color: COLORS.muted, marginBottom: 4, fontWeight: 600 }}>Başlangıç Miktarı</label>
                  <input type="number" step="1" min="0" value={newCardForm.total_quantity}""",
    """                  <label style={{ display: 'block', fontSize: 12, color: COLORS.muted, marginBottom: 4, fontWeight: 600 }}>Toplam Stok</label>
                  <input aria-label="Toplam Stok" type="number" step="1" min="0" value={newCardForm.total_quantity}""",
    1
)

# Fix "Alış Fiyatı (₺)" to "Alış Fiyatı" + aria-label
content = content.replace(
    """                    <label style={{ display: 'block', fontSize: 12, color: COLORS.muted, marginBottom: 4, fontWeight: 600 }}>Alış Fiyatı (₺)</label>
                    <input type="number" step="0.01" min="0" value={newCardForm.purchase_price}""",
    """                    <label style={{ display: 'block', fontSize: 12, color: COLORS.muted, marginBottom: 4, fontWeight: 600 }}>Alış Fiyatı</label>
                    <input aria-label="Alış Fiyatı" type="number" step="0.01" min="0" value={newCardForm.purchase_price}""",
    1
)

# Fix "Satış Fiyatı (₺)" to "Satış Fiyatı" + aria-label
content = content.replace(
    """                    <label style={{ display: 'block', fontSize: 12, color: COLORS.muted, marginBottom: 4, fontWeight: 600 }}>Satış Fiyatı (₺)</label>
                    <input type="number" step="0.01" min="0" value={newCardForm.sale_price}""",
    """                    <label style={{ display: 'block', fontSize: 12, color: COLORS.muted, marginBottom: 4, fontWeight: 600 }}>Satış Fiyatı</label>
                    <input aria-label="Satış Fiyatı" type="number" step="0.01" min="0" value={newCardForm.sale_price}""",
    1
)

# Fix "Renk" input - add aria-label
content = content.replace(
    """                    <label style={{ display: 'block', fontSize: 12, color: COLORS.muted, marginBottom: 4, fontWeight: 600 }}>Renk</label>
                    <input type="text" value={newCardForm.color}""",
    """                    <label style={{ display: 'block', fontSize: 12, color: COLORS.muted, marginBottom: 4, fontWeight: 600 }}>Renk</label>
                    <input aria-label="Renk" type="text" value={newCardForm.color}""",
    1
)

# Fix "Kalınlık" input - add aria-label
content = content.replace(
    """                    <label style={{ display: 'block', fontSize: 12, color: COLORS.muted, marginBottom: 4, fontWeight: 600 }}>Kalınlık</label>
                    <input type="text" value={newCardForm.thickness}""",
    """                    <label style={{ display: 'block', fontSize: 12, color: COLORS.muted, marginBottom: 4, fontWeight: 600 }}>Kalınlık</label>
                    <input aria-label="Kalınlık" type="text" value={newCardForm.thickness}""",
    1
)

# Fix "Depo Konumu" to "Depo Yeri" + aria-label
content = content.replace(
    """                  <label style={{ display: 'block', fontSize: 12, color: COLORS.muted, marginBottom: 4, fontWeight: 600 }}>Depo Konumu</label>
                  <input type="text" value={newCardForm.warehouse_location}""",
    """                  <label style={{ display: 'block', fontSize: 12, color: COLORS.muted, marginBottom: 4, fontWeight: 600 }}>Depo Yeri</label>
                  <input aria-label="Depo Yeri" type="text" value={newCardForm.warehouse_location}""",
    1
)

print("Changes 6 (labels) applied")

# 7. Change submit button text and add barcode/price rows before submit
# Find the submit button section and add barcode/price UI before it, then fix button text
old_submit_section = """              {newCardError && (


                <div style={{ gridColumn: '1 / -1', padding: 10, background: COLORS.danger, border: `1px solid ${COLORS.danger}`, borderRadius: RADIUS.md, color: COLORS.danger, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>


                  <AlertCircle size={14} /> {newCardError}


                </div>


              )}"""

new_submit_section = """              {/* Barkod Satırları */}
              <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: COLORS.primary }}>Barkodlar</h4>
                {barkodSatirlari.map((b, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <label style={{ fontSize: 12, color: COLORS.muted, whiteSpace: 'nowrap' }}>Barkod {idx + 1}</label>
                    <input
                      aria-label={`Barkod ${idx + 1}`}
                      type="text"
                      value={b}
                      onChange={e => setBarkodSatirlari(prev => prev.map((v, i) => i === idx ? e.target.value : v))}
                      style={{ flex: 1, padding: '8px 10px', border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md, background: COLORS.bg.main, color: COLORS.text, fontSize: 13 }}
                    />
                    {barkodSatirlari.length > 1 && (
                      <button type="button" onClick={() => setBarkodSatirlari(prev => prev.filter((_, i) => i !== idx))} style={{ padding: '6px 8px', border: 'none', background: COLORS.danger, color: 'white', borderRadius: RADIUS.md, cursor: 'pointer', fontSize: 12 }}>✕</button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => setBarkodSatirlari(prev => [...prev, ''])} style={{ alignSelf: 'flex-start', padding: '6px 12px', border: `1px solid ${COLORS.border}`, background: 'transparent', color: COLORS.text, borderRadius: RADIUS.md, cursor: 'pointer', fontSize: 12 }}>
                  + Yeni barkod satırı
                </button>
              </div>

              {/* Satış Fiyat Satırları */}
              <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: COLORS.primary }}>Satış Fiyat Listesi</h4>
                {fiyatSatirlari.map((row, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <label style={{ fontSize: 12, color: COLORS.muted, whiteSpace: 'nowrap' }}>Fiyat Tipi</label>
                    <input
                      aria-label="Fiyat Tipi"
                      type="text"
                      value={row.priceType}
                      onChange={e => setFiyatSatirlari(prev => prev.map((r, i) => i === idx ? { ...r, priceType: e.target.value } : r))}
                      placeholder="LISTE"
                      style={{ flex: 1, padding: '8px 10px', border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md, background: COLORS.bg.main, color: COLORS.text, fontSize: 13 }}
                    />
                    <label style={{ fontSize: 12, color: COLORS.muted, whiteSpace: 'nowrap' }}>Tutar</label>
                    <input
                      aria-label="Tutar"
                      type="number"
                      step="0.01"
                      value={row.amount}
                      onChange={e => setFiyatSatirlari(prev => prev.map((r, i) => i === idx ? { ...r, amount: e.target.value } : r))}
                      placeholder="0.00"
                      style={{ flex: 1, padding: '8px 10px', border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md, background: COLORS.bg.main, color: COLORS.text, fontSize: 13 }}
                    />
                    {fiyatSatirlari.length > 1 && (
                      <button type="button" onClick={() => setFiyatSatirlari(prev => prev.filter((_, i) => i !== idx))} style={{ padding: '6px 8px', border: 'none', background: COLORS.danger, color: 'white', borderRadius: RADIUS.md, cursor: 'pointer', fontSize: 12 }}>✕</button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => setFiyatSatirlari(prev => [...prev, { priceType: '', amount: '' }])} style={{ alignSelf: 'flex-start', padding: '6px 12px', border: `1px solid ${COLORS.border}`, background: 'transparent', color: COLORS.text, borderRadius: RADIUS.md, cursor: 'pointer', fontSize: 12 }}>
                  + Fiyat Satırı Ekle
                </button>
              </div>

              {newCardError && (


                <div style={{ gridColumn: '1 / -1', padding: 10, background: COLORS.danger, border: `1px solid ${COLORS.danger}`, borderRadius: RADIUS.md, color: COLORS.danger, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>


                  <AlertCircle size={14} /> {newCardError}


                </div>


              )}"""
if old_submit_section in content:
    content = content.replace(old_submit_section, new_submit_section, 1)
    print("Barcode/price rows UI added")
else:
    print("ERROR: Could not find error div block")

# 8. Fix button text
content = content.replace(
    "{newCardLoading ? 'Oluşturuluyor...' : 'Stok Kartı Oluştur'}",
    "{newCardLoading ? 'Oluşturuluyor...' : 'Stok Kartını Oluştur'}",
    1
)

print("Button text fixed")

with open(f, 'w', encoding='utf-8') as fp:
    fp.write(content)
print("File written. Now adding detail view sections...")

# Reload to continue with detail view changes
with open(f, 'r', encoding='utf-8') as fp:
    content = fp.read()

# 9. Add section headers to detail view - wrap existing content
# Find the "Başlık" section and modify the statistics grid to add section headers
# Replace the detail view heading section to add "Genel Bilgiler"
old_header = """          {/* Başlık */}


          <div style={{ backgroundColor: COLORS.bg.surface, padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>"""
new_header = """          {/* Genel Bilgiler */}


          <h3 style={{ fontSize: 16, fontWeight: 700, color: COLORS.text, marginBottom: 8 }}>Genel Bilgiler</h3>


          <div style={{ backgroundColor: COLORS.bg.surface, padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>"""
if old_header in content:
    content = content.replace(old_header, new_header, 1)
    print("Genel Bilgiler header added")
else:
    print("ERROR: Could not find Başlık section")

# Add "Ticari Bilgiler" and "Depo ve Miktar" headers
# Find the İstatistikler section
old_stats = """          {/* İstatistikler */}


          <div"""
new_stats = """          {/* Depo ve Miktar / Ticari Bilgiler */}


          <h3 style={{ fontSize: 16, fontWeight: 700, color: COLORS.text, marginBottom: 8 }}>Depo ve Miktar</h3>


          <h3 style={{ fontSize: 16, fontWeight: 700, color: COLORS.text, marginBottom: 8, marginTop: 16 }}>Ticari Bilgiler</h3>


          {/* İstatistikler */}


          <div"""
if old_stats in content:
    content = content.replace(old_stats, new_stats, 1)
    print("Depo/Ticari headers added")
else:
    print("ERROR: Could not find İstatistikler section")

# 10. Fix zero price display - always show Satış Fiyatı and also add Alış Fiyatı
# Find the conditional sale price display
old_sale_price = """            {stockDetail.salePrice && (


              <div style={{ backgroundColor: COLORS.bg.surface, padding: '16px', borderRadius: '8px', border: `1px solid ${COLORS.border}` }}>


                <div style={{ fontSize: '12px', color: COLORS.muted, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>


                  <DollarSign size={14} /> Satış Fiyatı


                </div>


                <div style={{ fontSize: '24px', fontWeight: 'bold', color: COLORS.primary }}>


                  ₺{stockDetail.salePrice.toFixed(2)}


                </div>


              </div>


            )}"""
new_sale_price = """            <div style={{ backgroundColor: COLORS.bg.surface, padding: '16px', borderRadius: '8px', border: `1px solid ${COLORS.border}` }}>


              <div style={{ fontSize: '12px', color: COLORS.muted, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>


                <DollarSign size={14} /> Satış Fiyatı


              </div>


              <div style={{ fontSize: '24px', fontWeight: 'bold', color: COLORS.primary }}>


                ₺{(stockDetail.salePrice ?? 0).toFixed(2)}


              </div>


            </div>


            <div style={{ backgroundColor: COLORS.bg.surface, padding: '16px', borderRadius: '8px', border: `1px solid ${COLORS.border}` }}>


              <div style={{ fontSize: '12px', color: COLORS.muted, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>


                <DollarSign size={14} /> Alış Fiyatı


              </div>


              <div style={{ fontSize: '24px', fontWeight: 'bold', color: COLORS.success ?? '#10b981' }}>


                ₺{(stockDetail.purchasePrice ?? 0).toFixed(2)}


              </div>


            </div>"""
if old_sale_price in content:
    content = content.replace(old_sale_price, new_sale_price, 1)
    print("Zero price display fixed")
else:
    print("ERROR: Could not find sale price conditional")

# 11. Add Stok Teknik Paneli and Barkod/Satış Fiyatları sections before "Son Hareketler"
old_movements = """          {/* Hareketler */}


          <div style={{ backgroundColor: COLORS.bg.surface, padding: '20px', borderRadius: '8px', border: `1px solid ${COLORS.border}` }}>


            <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: COLORS.text, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>


              <Calendar size={18} /> Son Hareketler


            </h3>"""
new_movements = """          {/* Stok Teknik Paneli */}


          <div style={{ backgroundColor: COLORS.bg.surface, padding: '20px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, marginBottom: 20 }}>


            <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: COLORS.text, marginBottom: '16px' }}>Stok Teknik Paneli</h3>


            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 13 }}>


              <div>


                <div style={{ fontWeight: 600, marginBottom: 6, color: COLORS.muted }}>Eşlemeler</div>


                {entityMaps.length === 0 ? (


                  <div style={{ color: COLORS.muted }}>Eşleme kaydı yok</div>


                ) : (


                  entityMaps.map(m => (


                    <div key={m.id}>{m.externalSystem} / {m.externalId}</div>


                  ))


                )}


              </div>


              <div>


                <div style={{ fontWeight: 600, marginBottom: 6, color: COLORS.muted }}>Outbox</div>


                {outbox.length === 0 ? (


                  <div style={{ color: COLORS.muted }}>Outbox kaydı yok</div>


                ) : (


                  outbox.map(item => (


                    <div key={item.id}><span style={{ fontWeight: 600 }}>{item.status}</span>{item.errorMessage && <span style={{ color: COLORS.danger }}> - {item.errorMessage}</span>}</div>


                  ))


                )}


              </div>


            </div>


          </div>


          {/* Barkod ve Satış Fiyatları */}


          <div style={{ backgroundColor: COLORS.bg.surface, padding: '20px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, marginBottom: 20 }}>


            <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: COLORS.text, marginBottom: '16px' }}>Barkod ve Satış Fiyatları</h3>


            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>


              <div role="region" aria-label="Barkod Alt Gridi">


                <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 13, color: COLORS.muted }}>Barkodlar</div>


                {(!stockDetail.barkodlar || stockDetail.barkodlar.length === 0) ? (


                  <div style={{ color: COLORS.muted, fontSize: 13 }}>Barkod kaydı yok</div>


                ) : (


                  stockDetail.barkodlar.map(bc => (


                    <div key={bc.id} style={{ fontSize: 13, padding: '4px 0', borderBottom: `1px solid ${COLORS.border}` }}>{bc.barcode}</div>


                  ))


                )}


              </div>


              <div role="region" aria-label="Satış Fiyatları Alt Gridi">


                <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 13, color: COLORS.muted }}>Satış Fiyatları</div>


                {(!stockDetail.satisFiyatlari || stockDetail.satisFiyatlari.length === 0) ? (


                  <div style={{ color: COLORS.muted, fontSize: 13 }}>Satış fiyatı kaydı yok</div>


                ) : (


                  stockDetail.satisFiyatlari.map(sp => (


                    <div key={sp.id} style={{ fontSize: 13, padding: '4px 0', borderBottom: `1px solid ${COLORS.border}` }}>


                      <span style={{ fontWeight: 600 }}>{sp.priceType}</span> — ₺{sp.amount.toFixed(2)}


                    </div>


                  ))


                )}


              </div>


            </div>


          </div>


          {/* Hareketler */}


          <div style={{ backgroundColor: COLORS.bg.surface, padding: '20px', borderRadius: '8px', border: `1px solid ${COLORS.border}` }}>


            <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: COLORS.text, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>


              <Calendar size={18} /> Son Hareketler


            </h3>"""
if old_movements in content:
    content = content.replace(old_movements, new_movements, 1)
    print("Teknik panel and barcode/price sections added")
else:
    print("ERROR: Could not find Hareketler section")

with open(f, 'w', encoding='utf-8') as fp:
    fp.write(content)
print("All changes written!")
