import React from 'react';
import type { TeklifHeader as TeklifHeaderType } from '../types/teklif.types';
import { formatTelefon } from '../types/teklif.types';

interface Props {
  data: TeklifHeaderType;
  onChange: (field: keyof TeklifHeaderType, value: TeklifHeaderType[keyof TeklifHeaderType]) => void;
  readOnly?: boolean;
}

export const TeklifHeader: React.FC<Props> = ({ data, onChange, readOnly = false }) => {
  return (
    <div className="grid grid-cols-12 gap-4 p-4 bg-slate-800 rounded border-l-4 border-l-blue-500 border border-slate-700">
      {/* Cari Kodu - 4 kolon */}
      <div className="col-span-3">
        <label className="block text-xs text-slate-400 mb-1">Cari Kodu</label>
        <input
          type="text"
          value={data.cariKodu}
          onChange={(e) => onChange('cariKodu', e.target.value)}
          disabled={readOnly}
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-200 focus:outline-none focus:border-blue-500 text-sm"
          placeholder="CAR-001"
        />
      </div>

      {/* Telefon - 3 kolon */}
      <div className="col-span-3">
        <label className="block text-xs text-slate-400 mb-1">Telefon</label>
        <input
          type="text"
          value={data.telefon}
          onChange={(e) => onChange('telefon', formatTelefon(e.target.value))}
          disabled={readOnly}
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-200 focus:outline-none focus:border-blue-500 text-sm"
          placeholder="0 (5xx) xxx-xx-xx"
          maxLength={17}
        />
      </div>

      {/* Belge No - 3 kolon (Otomatik, readonly) */}
      <div className="col-span-3">
        <label className="block text-xs text-slate-400 mb-1">Belge No</label>
        <div className="flex items-center">
          <input
            type="text"
            value={data.belgeNo}
            readOnly
            className="w-full px-3 py-2 bg-slate-750 border border-slate-600 rounded text-emerald-400 font-mono font-medium cursor-not-allowed text-sm"
          />
          <span className="ml-2 text-xs text-slate-500" title="Otomatik uretilir">
            🔒
          </span>
        </div>
        <span className="text-[10px] text-slate-500">Format: TF-YYYY-######</span>
      </div>

      {/* Belge Tarihi - 3 kolon */}
      <div className="col-span-3">
        <label className="block text-xs text-slate-400 mb-1">Belge Tarihi</label>
        <input
          type="date"
          value={data.belgeTarihi.toISOString().split('T')[0]}
          onChange={(e) => onChange('belgeTarihi', new Date(e.target.value))}
          disabled={readOnly}
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-200 focus:outline-none focus:border-blue-500 text-sm"
        />
      </div>
    </div>
  );
};
