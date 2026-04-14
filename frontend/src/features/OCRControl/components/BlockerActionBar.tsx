import React from 'react';
import { AlertTriangle, CheckCircle, ChevronRight } from 'lucide-react';
import { useOCRData } from '../contexts/OCRDataContext';

interface BlockerActionBarProps {
  showToast: (message: string, type: 'success' | 'error' | 'warning') => void;
}

export const BlockerActionBar: React.FC<BlockerActionBarProps> = ({ showToast }) => {
  const { state } = useOCRData();
  const hasData = state.rows.length > 0 && state.document !== null;
  const blockerInfo = state.blockerInfo;
  const canTransfer = hasData && !blockerInfo.hasBlockers;

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

  if (!hasData) {
    return (
      <div className="border-t px-6 py-4 bg-slate-800 border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-2 rounded-full bg-slate-700 text-slate-300">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium text-slate-100">OCR verisi bekleniyor</p>
              <p className="text-sm text-slate-300">
                Boş durum gösteriliyor. Veri yüklendiğinde Phase 3 aktarımı aktif olur.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleTransferToPhase3}
            disabled
            className="px-6 py-2 rounded flex items-center space-x-2 font-medium bg-slate-700 border border-slate-600 text-slate-500 cursor-not-allowed"
          >
            <span>Phase 3'e Aktar</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`border-t px-6 py-4 ${
      canTransfer
        ? 'bg-emerald-900 border-emerald-700'
        : 'bg-amber-900 border-amber-700'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className={`p-2 rounded-full ${
            canTransfer
              ? 'bg-emerald-800 text-emerald-200'
              : 'bg-amber-800 text-amber-200'
          }`}>
            {canTransfer ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
          </div>

          <div>
            <p className={`font-medium ${
              canTransfer ? 'text-emerald-100' : 'text-amber-100'
            }`}>
              {blockerInfo.message}
            </p>
            <p className={`text-sm ${
              canTransfer ? 'text-emerald-200' : 'text-amber-200'
            }`}>
              {blockerInfo.totalCriticalFields} kritik alandan {blockerInfo.approvedCount} tanesi onaylandı
              {blockerInfo.hasBlockers && ` • ${blockerInfo.unapprovedLowConfidenceCount} hücre onay bekliyor`}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleTransferToPhase3}
          disabled={!canTransfer}
          className={`px-6 py-2 rounded flex items-center space-x-2 font-medium transition-colors ${
            canTransfer
              ? 'bg-blue-600 border border-blue-500 text-white hover:bg-blue-700'
              : 'bg-slate-700 border border-slate-600 text-slate-500 cursor-not-allowed'
          }`}
        >
          <span>Phase 3'e Aktar</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {blockerInfo.hasBlockers ? (
        <div className="mt-3 pt-3 border-t border-amber-700">
          <div className="bg-amber-800 rounded p-3">
            <h4 className="text-sm font-medium text-amber-100 mb-2">
              Blocker Detayları:
            </h4>
            <ul className="text-xs text-amber-200 space-y-1">
              <li>• Confidence %80 altındaki kritik alanlar onay bekliyor</li>
              <li>• Kritik alan onayları tamamlanmadan geçiş yapılamaz</li>
              <li>• Düşük güvenli hücreleri manuel olarak onaylayın veya değerlerini güncelleyin</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="mt-3 pt-3 border-t border-emerald-700">
          <div className="bg-emerald-800 rounded p-3">
            <h4 className="text-sm font-medium text-emerald-100 mb-2">
              Onay Tamamlandı:
            </h4>
            <ul className="text-xs text-emerald-200 space-y-1">
              <li>• Tüm kritik alanlar doğrulandı</li>
              <li>• Phase 3'e aktarım için hazır</li>
              <li>• Belge güvenli bir şekilde sonraki faza gönderilebilir</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};