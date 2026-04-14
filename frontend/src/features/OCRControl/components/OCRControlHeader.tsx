import React from 'react';
import { RefreshCw, AlertTriangle, ChevronRight } from 'lucide-react';
import { useOCRData } from '../contexts/OCRDataContext';
import { CRITICAL_FIELDS } from '../types';

interface OCRControlHeaderProps {
  onFaultyImageClick: () => void;
  showToast: (message: string, type: 'success' | 'error' | 'warning') => void;
}

export const OCRControlHeader: React.FC<OCRControlHeaderProps> = ({
  onFaultyImageClick,
  showToast,
}) => {
  const { state, actions } = useOCRData();
  const { blockerInfo } = state;
  const hasData = state.rows.length > 0 && state.document !== null;
  const canTransfer = hasData && !blockerInfo.hasBlockers;

  const handleRefresh = () => {
    actions.setEmpty();
    showToast('Boş durum yenilendi', 'success');
  };

  const handleTransferToPhase3 = () => {
    if (!hasData) {
      showToast('Önce OCR verisi yüklenmeli', 'warning');
      return;
    }

    if (blockerInfo.hasBlockers) {
      showToast('Blocker var: Phase 3\'e geçiş engellendi', 'error');
      return;
    }

    showToast('Phase 3\'e aktarılıyor...', 'success');
  };

  return (
    <div className="bg-slate-800 border-b border-slate-700 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-slate-200 mb-2">OCR Kontrol</h1>
          <div className="text-sm text-slate-400">
            {hasData ? (
              <>
                <p>Bu ekranda doğrulanan kritik alanlar:</p>
                <div className="flex items-center space-x-2 mt-1">
                  {CRITICAL_FIELDS.map((field, index) => (
                    <React.Fragment key={field}>
                      <span className="font-medium text-slate-300">{field}</span>
                      {index < CRITICAL_FIELDS.length - 1 && (
                        <span className="text-slate-600">•</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
                <p className="mt-2 text-amber-400">
                  Düşük güvenli hücreler operatör onayı bekliyor
                </p>
              </>
            ) : (
              <>
                <p>Henüz OCR verisi yüklenmedi.</p>
                <p className="mt-2 text-slate-500">
                  Boş durum gösteriliyor; veri yüklendiğinde kritik alanlar burada listelenecek.
                </p>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-slate-700 border border-slate-600 rounded text-slate-200 hover:bg-slate-600 transition-colors flex items-center space-x-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Yenile</span>
          </button>

          <button
            onClick={onFaultyImageClick}
            disabled={!hasData}
            className={`px-4 py-2 border rounded flex items-center space-x-2 transition-colors ${
              hasData
                ? 'bg-red-900 border-red-700 text-red-200 hover:bg-red-800'
                : 'bg-slate-700 border-slate-600 text-slate-500 cursor-not-allowed'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Hatalı Görsel</span>
          </button>

          <button
            onClick={handleTransferToPhase3}
            disabled={!canTransfer}
            className={`px-4 py-2 rounded flex items-center space-x-2 transition-colors ${
              canTransfer
                ? 'bg-blue-600 border border-blue-500 text-white hover:bg-blue-700'
                : 'bg-slate-700 border border-slate-600 text-slate-500 cursor-not-allowed'
            }`}
          >
            <span>Phase 3'e Aktar</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};