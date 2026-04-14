import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, X, Check, RefreshCcw } from 'lucide-react';
import { materialsService, type MaterialLookupItem } from '../../../services/materialsService';

interface StokSeciciModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (stok: MaterialLookupItem) => void;
}

export const StokSeciciModal: React.FC<StokSeciciModalProps> = ({
  isOpen,
  onClose,
  onSelect,
}) => {
  const [arama, setArama] = useState('');
  const [seciliKategori, setSeciliKategori] = useState<string>('Tümü');
  const [stoklar, setStoklar] = useState<MaterialLookupItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const loadMaterials = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');

    try {
      const items = await materialsService.listMaterials({ pageSize: 100 });
      setStoklar(items);
    } catch (error) {
      setStoklar([]);
      setLoadError(error instanceof Error ? error.message : 'Stok listesi yüklenemedi.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    void loadMaterials();
  }, [isOpen, loadMaterials]);

  const kategoriler = useMemo(() => {
    const katSet = new Set(stoklar.map((stok) => stok.kategori || 'Diğer'));
    return ['Tümü', ...Array.from(katSet)];
  }, [stoklar]);

  const filtrelenmisStoklar = useMemo(() => {
    const query = arama.trim().toLowerCase();

    return stoklar.filter((stok) => {
      const aramaUyumu =
        query === '' ||
        stok.kod.toLowerCase().includes(query) ||
        stok.ad.toLowerCase().includes(query) ||
        stok.kategori.toLowerCase().includes(query);

      const kategoriUyumu = seciliKategori === 'Tümü' || stok.kategori === seciliKategori;

      return aramaUyumu && kategoriUyumu;
    });
  }, [arama, seciliKategori, stoklar]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-slate-800 rounded-lg border border-slate-700 shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-slate-200">Stok Seç</h2>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={arama}
              onChange={(e) => setArama(e.target.value)}
              placeholder="Stok kodu veya adı ara..."
              className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500"
              autoFocus
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {kategoriler.map((kat) => (
              <button
                key={kat}
                onClick={() => setSeciliKategori(kat)}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  seciliKategori === kat
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {kat}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto px-4 pb-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-slate-400">
              <div className="flex items-center gap-3">
                <RefreshCcw className="animate-spin" size={18} />
                <span>Stoklar yükleniyor...</span>
              </div>
            </div>
          ) : loadError ? (
            <div className="rounded border border-amber-500/40 bg-amber-500/10 p-4 text-amber-100">
              <p className="text-sm">{loadError}</p>
              <button
                type="button"
                onClick={() => void loadMaterials()}
                className="mt-3 inline-flex items-center gap-2 rounded bg-amber-500 px-3 py-2 text-xs font-medium text-slate-900 hover:bg-amber-400"
              >
                <RefreshCcw size={14} />
                Tekrar Dene
              </button>
            </div>
          ) : filtrelenmisStoklar.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <p>Stok bulunamadı</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtrelenmisStoklar.map((stok) => (
                <button
                  key={stok.kod}
                  onClick={() => {
                    onSelect(stok);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between p-3 bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 hover:border-slate-500 rounded transition-all text-left group"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-blue-400">{stok.kod}</span>
                      <span className="text-xs text-slate-500">•</span>
                      <span className="text-xs text-slate-400">{stok.kategori}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-200 mt-1">{stok.ad}</p>
                    <p className="text-xs text-slate-400">Birim: {stok.birim}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-emerald-400">
                      {stok.fiyat.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                    </p>
                    <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs rounded">
                        <Check size={12} />
                        Seç
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-4 border-t border-slate-700 bg-slate-750 rounded-b-lg">
          <span className="text-xs text-slate-400">
            {filtrelenmisStoklar.length} stok gösteriliyor
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-sm transition-colors"
          >
            İptal
          </button>
        </div>
      </div>
    </div>
  );
};
