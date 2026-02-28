import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../services/apiClient';

// API'den gelen malzeme verisinin tip tanımı
interface MaterialSuggestion {
  name: string;
  raw_name: string;
  thickness: number;
  width: number;
  height: number;
  color: string;
}

// Parça verisi tipi
interface PartRow {
  id: string;
  boy: number;
  en: number;
  adet: number;
  grain: string;
  u1: string;
  u2: string;
  k1: string;
  k2: string;
  partInfo: string;
  delikKodu1: string;
  delikKodu2: string;
  isBack: boolean;
  partGroup: string;
  disableEdgeBanding: boolean;
}

// Müşteri verisi
interface Customer {
  id: number;
  name: string;
  phone: string;
}

const OrderEditor: React.FC = () => {
  // Header state'leri (zorunlu alanlar)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerPhone, setCustomerPhone] = useState('');
  const [materialName, setMaterialName] = useState('');
  const [thickness, setThickness] = useState<number>(18);
  const [plateSize, setPlateSize] = useState({ width: 2100, height: 2800 });
  const [banding, setBanding] = useState(true);

  // Malzeme arama
  const [materialQuery, setMaterialQuery] = useState('');
  const [materialSuggestions, setMaterialSuggestions] = useState<MaterialSuggestion[]>([]);
  const [showMaterialSuggestions, setShowMaterialSuggestions] = useState(false);

  // Parça satırları
  const [rows, setRows] = useState<PartRow[]>([
    {
      id: '1',
      boy: 0,
      en: 0,
      adet: 1,
      grain: '0-Material',
      u1: '',
      u2: '',
      k1: '',
      k2: '',
      partInfo: '',
      delikKodu1: '',
      delikKodu2: '',
      isBack: false,
      partGroup: 'GOVDE',
      disableEdgeBanding: false
    }
  ]);

  // Müşteri arama
  const searchCustomer = useCallback(async (phone: string) => {
    const normalizedPhone = phone.replace(/\D/g, "");
    if (normalizedPhone.length < 10) return;
    const queryPhone = normalizedPhone.slice(-10);
    if (!queryPhone.startsWith("5")) {
      setSelectedCustomer(null);
      return;
    }

    try {
      const customer = await apiRequest<Customer>(`/customers/lookup?phone=${encodeURIComponent(queryPhone)}`);
      setSelectedCustomer(customer);
    } catch (error) {
      console.error('Müşteri arama hatası:', error);
      setSelectedCustomer(null);
    }
  }, []);

  // Malzeme arama
  const searchMaterials = useCallback(async (query: string) => {
    if (query.length < 2) {
      setMaterialSuggestions([]);
      setShowMaterialSuggestions(false);
      return;
    }

    try {
      const materials = await apiRequest<MaterialSuggestion[]>(
        `/materials/suggest?q=${encodeURIComponent(query)}&thickness=${thickness}`
      );
      setMaterialSuggestions(materials);
      setShowMaterialSuggestions(true);
    } catch (error) {
      console.error('Malzeme arama hatası:', error);
      setMaterialSuggestions([]);
      setShowMaterialSuggestions(false);
    }
  }, [thickness]);

  // Yeni parça satırı ekle
  const addRow = () => {
    const newRow: PartRow = {
      id: Date.now().toString(),
      boy: 0,
      en: 0,
      adet: 1,
      grain: '0-Material',
      u1: '',
      u2: '',
      k1: '',
      k2: '',
      partInfo: '',
      delikKodu1: '',
      delikKodu2: '',
      isBack: false,
      partGroup: 'GOVDE',
      disableEdgeBanding: false
    };
    setRows([...rows, newRow]);
  };

  // Parça satırı sil
  const removeRow = (id: string) => {
    if (rows.length > 1) {
      setRows(rows.filter(row => row.id !== id));
    }
  };

  // Grain değişimi
  const handleGrainChange = (index: number, value: string) => {
    const updatedRows = [...rows];
    updatedRows[index].grain = value;

    // @433 kuralı: Grain 1/2'de 0.1mm ekle
    if (value === "1-Material" || value === "2-Material") {
      updatedRows[index].boy += 0.1;
      updatedRows[index].en += 0.1;
    }

    setRows(updatedRows);
  };

  // Arkalık toggle
  const handleBackToggle = (index: number) => {
    const updatedRows = [...rows];
    updatedRows[index].isBack = !updatedRows[index].isBack;
    updatedRows[index].partGroup = updatedRows[index].isBack ? 'ARKALIK' : 'GOVDE';

    if (updatedRows[index].isBack) {
      updatedRows[index].u1 = '';
      updatedRows[index].u2 = '';
      updatedRows[index].k1 = '';
      updatedRows[index].k2 = '';
      updatedRows[index].disableEdgeBanding = true;
    } else {
      updatedRows[index].disableEdgeBanding = false;
    }

    setRows(updatedRows);
  };

  // Satır güncelleme
  const updateRow = (index: number, field: keyof PartRow, value: string | number | boolean) => {
    const updatedRows = [...rows];
    updatedRows[index] = { ...updatedRows[index], [field]: value };
    setRows(updatedRows);
  };

  // Form validasyonu
  const isFormValid = () => {
    return selectedCustomer && materialName && thickness && rows.some(row => row.boy > 0 && row.en > 0);
  };

  // Eklenen siparişin ID'si
  const [lastSavedOrderId, setLastSavedOrderId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Sipariş kaydet
  const saveOrder = async () => {
    if (!isFormValid()) {
      alert('Lütfen zorunlu alanları doldurun!');
      return;
    }

    const orderData = {
      customer_id: selectedCustomer?.id,
      material_name: materialName,
      thickness_mm: thickness,
      plate_width: plateSize.width,
      plate_height: plateSize.height,
      parts: rows.map(row => ({
        boy_mm: row.boy,
        en_mm: row.en,
        adet: row.adet,
        grain: row.grain,
        u1: row.u1,
        u2: row.u2,
        k1: row.k1,
        k2: row.k2,
        part_info: row.partInfo,
        delik_kodu1: row.delikKodu1,
        delik_kodu2: row.delikKodu2,
        part_group: row.partGroup
      }))
    };

    try {
      const response = await apiRequest<{ id: string }>('/orders', {
        method: 'POST',
        body: JSON.stringify(orderData)
      });

      alert('Sipariş başarıyla kaydedildi!');
      setLastSavedOrderId(response.id);
      // Formu hemen sıfırlamak yerine dışa aktarım şansı tanıyalım
    } catch (error) {
      console.error('Sipariş kaydetme hatası:', error);
      alert('Sipariş kaydedilemedi!');
    }
  };

  // Form sıfırla
  const resetForm = () => {
    setSelectedCustomer(null);
    setCustomerPhone('');
    setMaterialName('');
    setThickness(18);
    setPlateSize({ width: 2100, height: 2800 });
    setBanding(true);
    setRows([{
      id: '1',
      boy: 0,
      en: 0,
      adet: 1,
      grain: '0-Material',
      u1: '',
      u2: '',
      k1: '',
      k2: '',
      partInfo: '',
      delikKodu1: '',
      delikKodu2: '',
      isBack: false,
      partGroup: 'GOVDE',
      disableEdgeBanding: false
    }]);
  };

  // Effect'ler
  useEffect(() => {
    searchCustomer(customerPhone);
  }, [customerPhone, searchCustomer]);

  useEffect(() => {
    searchMaterials(materialQuery);
  }, [materialQuery, thickness, searchMaterials]);

  return (
    <div className="max-w-7xl mx-auto p-6 bg-gray-900 rounded-lg shadow-lg">
      <h2 className="text-3xl font-bold mb-6 text-gray-800">Sipariş Editörü</h2>

      {/* Zorunlu Header Alanları */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="text-lg font-semibold mb-4 text-blue-800">Zorunlu Bilgiler</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* Müşteri */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Müşteri Telefon *
            </label>
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="532xxxxxxx"
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
            />
            {selectedCustomer && (
              <p className="text-sm text-green-600 mt-1">
                {selectedCustomer.name}
              </p>
            )}
          </div>

          {/* Malzeme */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Malzeme *
            </label>
            <input
              type="text"
              value={materialQuery}
              onChange={(e) => {
                setMaterialQuery(e.target.value);
                setMaterialName(e.target.value);
              }}
              placeholder="Malzeme ara..."
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
            />
            {showMaterialSuggestions && materialSuggestions.length > 0 && (
              <div className="absolute z-10 w-full bg-gray-800 border rounded mt-1 max-h-40 overflow-y-auto">
                {materialSuggestions.map((material, index) => (
                  <div
                    key={index}
                    onClick={() => {
                      setMaterialName(material.name);
                      setMaterialQuery(material.name);
                      setShowMaterialSuggestions(false);
                    }}
                    className="p-2 hover:bg-gray-100 cursor-pointer"
                  >
                    {material.name} ({material.thickness}mm)
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Kalınlık */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kalınlık (mm) *
            </label>
            <select
              value={thickness}
              onChange={(e) => setThickness(Number(e.target.value))}
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
            >
              <option value={4}>4 mm</option>
              <option value={5}>5 mm</option>
              <option value={8}>8 mm</option>
              <option value={18}>18 mm</option>
            </select>
          </div>

          {/* Bant */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bant (Gövde için)
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={banding}
                onChange={(e) => setBanding(e.target.checked)}
                className="mr-2"
              />
              Bant uygula
            </label>
          </div>
        </div>
      </div>

      {/* Plaka Ebatı */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">Plaka Ebatı</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Genişlik (mm)
            </label>
            <input
              type="number"
              value={plateSize.width}
              onChange={(e) => setPlateSize(prev => ({ ...prev, width: parseInt(e.target.value) || 0 }))}
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Yükseklik (mm)
            </label>
            <input
              type="number"
              value={plateSize.height}
              onChange={(e) => setPlateSize(prev => ({ ...prev, height: parseInt(e.target.value) || 0 }))}
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <p className="text-sm text-gray-500 mt-2">Standart: 2100x2800</p>
      </div>

      {/* Parça Tablosu */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Parça Listesi</h3>
          <button
            onClick={addRow}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
          >
            + Yeni Parça
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 p-2 text-left">Boy</th>
                <th className="border border-gray-300 p-2 text-left">En</th>
                <th className="border border-gray-300 p-2 text-left">Adet</th>
                <th className="border border-gray-300 p-2 text-left">Desen</th>
                <th className="border border-gray-300 p-2 text-left">U1</th>
                <th className="border border-gray-300 p-2 text-left">U2</th>
                <th className="border border-gray-300 p-2 text-left">K1</th>
                <th className="border border-gray-300 p-2 text-left">K2</th>
                <th className="border border-gray-300 p-2 text-left">Parça Bilgi</th>
                <th className="border border-gray-300 p-2 text-left">Delik Kodu-1</th>
                <th className="border border-gray-300 p-2 text-left">Delik Kodu-2</th>
                <th className="border border-gray-300 p-2 text-left">Grup</th>
                <th className="border border-gray-300 p-2 text-left">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id}>
                  <td className="border border-gray-300 p-1">
                    <input
                      type="number"
                      value={row.boy}
                      onChange={(e) => updateRow(index, 'boy', Number(e.target.value))}
                      className="w-full p-1 border rounded"
                      placeholder="Boy"
                    />
                  </td>
                  <td className="border border-gray-300 p-1">
                    <input
                      type="number"
                      value={row.en}
                      onChange={(e) => updateRow(index, 'en', Number(e.target.value))}
                      className="w-full p-1 border rounded"
                      placeholder="En"
                    />
                  </td>
                  <td className="border border-gray-300 p-1">
                    <input
                      type="number"
                      value={row.adet}
                      onChange={(e) => updateRow(index, 'adet', Number(e.target.value))}
                      className="w-full p-1 border rounded"
                      min="1"
                    />
                  </td>
                  <td className="border border-gray-300 p-1">
                    <select
                      value={row.grain}
                      onChange={(e) => handleGrainChange(index, e.target.value)}
                      className="w-full p-1 border rounded"
                    >
                      <option value="0-Material">0-Material</option>
                      <option value="1-Material">1-Material</option>
                      <option value="2-Material">2-Material</option>
                      <option value="3-Material">3-Material</option>
                    </select>
                  </td>
                  <td className="border border-gray-300 p-1">
                    <input
                      type="text"
                      value={row.u1}
                      onChange={(e) => updateRow(index, 'u1', e.target.value)}
                      disabled={row.disableEdgeBanding}
                      className="w-full p-1 border rounded disabled:bg-gray-100"
                    />
                  </td>
                  <td className="border border-gray-300 p-1">
                    <input
                      type="text"
                      value={row.u2}
                      onChange={(e) => updateRow(index, 'u2', e.target.value)}
                      disabled={row.disableEdgeBanding}
                      className="w-full p-1 border rounded disabled:bg-gray-100"
                    />
                  </td>
                  <td className="border border-gray-300 p-1">
                    <input
                      type="text"
                      value={row.k1}
                      onChange={(e) => updateRow(index, 'k1', e.target.value)}
                      disabled={row.disableEdgeBanding}
                      className="w-full p-1 border rounded disabled:bg-gray-100"
                    />
                  </td>
                  <td className="border border-gray-300 p-1">
                    <input
                      type="text"
                      value={row.k2}
                      onChange={(e) => updateRow(index, 'k2', e.target.value)}
                      disabled={row.disableEdgeBanding}
                      className="w-full p-1 border rounded disabled:bg-gray-100"
                    />
                  </td>
                  <td className="border border-gray-300 p-1">
                    <input
                      type="text"
                      value={row.partInfo}
                      onChange={(e) => updateRow(index, 'partInfo', e.target.value)}
                      className="w-full p-1 border rounded"
                      placeholder="Açıklama"
                    />
                  </td>
                  <td className="border border-gray-300 p-1">
                    <input
                      type="text"
                      value={row.delikKodu1}
                      onChange={(e) => updateRow(index, 'delikKodu1', e.target.value)}
                      className="w-full p-1 border rounded"
                      placeholder="Delik-1"
                    />
                  </td>
                  <td className="border border-gray-300 p-1">
                    <input
                      type="text"
                      value={row.delikKodu2}
                      onChange={(e) => updateRow(index, 'delikKodu2', e.target.value)}
                      className="w-full p-1 border rounded"
                      placeholder="Delik-2"
                    />
                  </td>
                  <td className="border border-gray-300 p-1">
                    <div className="flex items-center space-x-2">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={row.isBack}
                          onChange={() => handleBackToggle(index)}
                          className="mr-1"
                        />
                        Arkalık
                      </label>
                    </div>
                  </td>
                  <td className="border border-gray-300 p-1">
                    <button
                      onClick={() => removeRow(row.id)}
                      className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-sm"
                      disabled={rows.length === 1}
                    >
                      Sil
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* İşlem Butonları */}
      <div className="flex justify-end space-x-4">
        <button
          onClick={resetForm}
          className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded"
        >
          Formu Temizle
        </button>
        <button
          onClick={saveOrder}
          disabled={!isFormValid() || isExporting}
          className={`px-6 py-2 rounded ${isFormValid() && !isExporting
              ? 'bg-blue-500 hover:bg-blue-600 text-white'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
        >
          Siparişi Kaydet
        </button>

        {lastSavedOrderId && (
          <button
            onClick={async () => {
              setIsExporting(true);
              try {
                const response = await apiRequest<{ success: boolean; message: string }>('/optiplanning/export', {
                  method: 'POST',
                  body: JSON.stringify({
                    order_id: lastSavedOrderId,
                    format_type: 'EXCEL',
                    trigger_exe: true
                  })
                });
                alert(response.message || 'OptiPlanning aktarımı tamamlandı!');
                resetForm();
                setLastSavedOrderId(null);
              } catch (error) {
                console.error('Dışa aktarım hatası:', error);
                alert('OptiPlanning aktarımı başarısız oldu.');
              } finally {
                setIsExporting(false);
              }
            }}
            disabled={isExporting}
            className={`px-6 py-2 rounded flex items-center ${isExporting
                ? 'bg-orange-300 cursor-not-allowed text-white'
                : 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg'
              }`}
          >
            {isExporting ? 'Aktarılıyor...' : 'OptiPlanning\'e Aktar'}
          </button>
        )}
      </div>
    </div>
  );
};

export default OrderEditor;
