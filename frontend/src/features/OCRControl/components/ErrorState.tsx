import React from 'react';
import { AlertTriangle, RefreshCw, FileQuestion } from 'lucide-react';

interface ErrorStateProps {
  type: 'image' | 'save';
  showToast: (message: string, type: 'success' | 'error' | 'warning') => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ type, showToast }) => {
  const handleRefresh = () => {
    showToast('Veriler yeniden yükleniyor...', 'success');
  };

  const getErrorInfo = () => {
    switch (type) {
      case 'image':
        return {
          icon: <FileQuestion className="w-12 h-12" />,
          title: 'Belge Yükleme Hatası',
          description: 'Belge görüntülenirken bir hata oluştu.',
          details: [
            'Belge dosyasına erişilemiyor',
            'Desteklenmeyen dosya formatı',
            'Ağ bağlantı sorunları'
          ],
          action: 'Belgeyi yeniden yüklemeyi deneyin'
        };
      
      case 'save':
        return {
          icon: <AlertTriangle className="w-12 h-12" />,
          title: 'Kaydetme Hatası',
          description: 'Değişiklikler kaydedilirken bir hata oluştu.',
          details: [
            'Sunucu bağlantı hatası',
            'Veri doğrulama hatası',
            'İşlem zaman aşımı'
          ],
          action: 'Değişiklikleri yeniden kaydetmeyi deneyin'
        };
      
      default:
        return {
          icon: <AlertTriangle className="w-12 h-12" />,
          title: 'Bilinmeyen Hata',
          description: 'Beklenmedik bir hata oluştu.',
          details: ['Sistem hatası'],
          action: 'Sayfayı yenileyin'
        };
    }
  };

  const errorInfo = getErrorInfo();

  return (
    <div className="h-full bg-slate-900 flex items-center justify-center">
      <div className="max-w-2xl mx-auto text-center px-8">
        {/* Error Icon */}
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-red-900 rounded-full border border-red-700 text-red-300">
            {errorInfo.icon}
          </div>
        </div>

        {/* Error Title */}
        <h2 className="text-2xl font-semibold text-slate-200 mb-4">
          {errorInfo.title}
        </h2>

        {/* Error Description */}
        <p className="text-slate-400 mb-6">
          {errorInfo.description}
        </p>

        {/* Error Details */}
        <div className="bg-red-900 border border-red-700 rounded-lg p-4 mb-6 text-left">
          <h3 className="text-sm font-medium text-red-100 mb-3">
            Olası nedenler:
          </h3>
          <ul className="text-xs text-red-200 space-y-1">
            {errorInfo.details.map((detail, index) => (
              <li key={index} className="flex items-start space-x-2">
                <span className="text-red-400 mt-1">•</span>
                <span>{detail}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Recommended Action */}
        <div className="bg-slate-800 rounded-lg p-4 mb-6">
          <p className="text-sm text-slate-300">
            <span className="font-medium">Öneri:</span> {errorInfo.action}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center space-x-4">
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-blue-600 border border-blue-500 rounded text-blue-100 hover:bg-blue-700 transition-colors flex items-center space-x-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Yenile</span>
          </button>
        </div>

        {/* Additional Help */}
        <div className="mt-8 text-xs text-slate-500">
          <p>
            Sorun devam ederse sistem yöneticisiyle iletişime geçin.
          </p>
        </div>
      </div>
    </div>
  );
};
