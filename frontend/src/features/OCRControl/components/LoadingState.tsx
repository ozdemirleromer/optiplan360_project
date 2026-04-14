import React from 'react';
import { RefreshCw } from 'lucide-react';

export const LoadingState: React.FC = () => {
  return (
    <div className="h-full bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        {/* Loading Spinner */}
        <div className="flex justify-center mb-4">
          <div className="relative">
            <RefreshCw className="w-12 h-12 text-blue-500 animate-spin" />
            <div className="absolute inset-0 w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>

        {/* Loading Text */}
        <h2 className="text-xl font-semibold text-slate-200 mb-2">
          OCR Verileri Yükleniyor
        </h2>
        
        <p className="text-slate-400 mb-4">
          Belge ve OCR verileri getiriliyor...
        </p>

        {/* Loading Details */}
        <div className="bg-slate-800 rounded-lg p-4 max-w-md mx-auto">
          <div className="space-y-2 text-xs text-slate-400">
            <div className="flex items-center justify-between">
              <span>Belge bağlantısı kuruluyor...</span>
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            </div>
            <div className="flex items-center justify-between">
              <span>OCR verileri analiz ediliyor...</span>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            </div>
            <div className="flex items-center justify-between">
              <span>Kritik alanlar tespit ediliyor...</span>
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
