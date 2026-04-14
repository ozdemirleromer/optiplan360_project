import React from 'react';
import { FileText, RefreshCw, AlertTriangle } from 'lucide-react';

interface EmptyStateProps {
  showToast: (message: string, type: 'success' | 'error' | 'warning') => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ showToast }) => {
  const handleRefresh = () => {
    showToast('Veriler yenileniyor...', 'success');
  };

  return (
    <div className="h-full bg-slate-900 flex items-center justify-center">
      <div className="max-w-2xl mx-auto text-center px-8">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-slate-800 rounded-full border border-slate-700">
            <FileText className="w-12 h-12 text-slate-400" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-semibold text-slate-200 mb-4">
          OCR Kontrol Kuyruğu Boş
        </h2>

        {/* Description */}
        <div className="text-slate-400 mb-8 space-y-3">
          <p>
            Bu ekranda doğrulanması beklenen belge bulunmamaktadır.
          </p>
          
          <div className="bg-slate-800 rounded-lg p-4 text-left">
            <h3 className="text-sm font-medium text-slate-300 mb-3">
              Bu ekran şu işlemleri yapar:
            </h3>
            <ul className="text-xs text-slate-400 space-y-2">
              <li className="flex items-start space-x-2">
                <span className="text-blue-400 mt-1">•</span>
                <span>OCR çıktısını operatöre güvenli ve hızlı gösterir</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-blue-400 mt-1">•</span>
                <span>Belge ile OCR verisini yan yana doğrular</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-blue-400 mt-1">•</span>
                <span>Yalnızca kritik alanları operatör onayına sunar</span>
              </li>
            </ul>
          </div>

          <div className="bg-slate-800 rounded-lg p-4 text-left">
            <h3 className="text-sm font-medium text-slate-300 mb-3">
              Doğrulanan kritik alanlar:
            </h3>
            <div className="flex flex-wrap gap-2">
              {['BOY', 'EN', 'ADET', 'U1', 'U2', 'K1', 'K2'].map((field) => (
                <span
                  key={field}
                  className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-xs font-medium text-slate-300"
                >
                  {field}
                </span>
              ))}
            </div>
          </div>

          <div className="bg-amber-900 border border-amber-700 rounded-lg p-4 text-left">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-4 h-4 text-amber-300 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-amber-100 mb-2">
                  Önemli Kurallar:
                </h3>
                <ul className="text-xs text-amber-200 space-y-1">
                  <li>• %80 altı confidence alanları turuncu warning state alır</li>
                  <li>• Onaysız düşük güvenli hücre varsa Phase 3'e geçiş engellenir</li>
                  <li>• Kayıt geldiğinde split-screen çalışma alanı açılır</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center space-x-4">
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-slate-700 border border-slate-600 rounded text-slate-200 hover:bg-slate-600 transition-colors flex items-center space-x-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Yenile</span>
          </button>
        </div>

        {/* Additional Info */}
        <div className="mt-8 text-xs text-slate-500">
          <p>
            Yeni belgeler geldiğinde bu ekran otomatik olarak güncellenecektir.
          </p>
        </div>
      </div>
    </div>
  );
};
