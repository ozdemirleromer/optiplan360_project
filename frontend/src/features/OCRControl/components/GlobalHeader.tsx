import React from 'react';
import { Bell, User, Home, ChevronRight } from 'lucide-react';

export const GlobalHeader: React.FC = () => {
  return (
    <header className="bg-slate-800 border-b border-slate-700 h-14 flex items-center px-4">
      <div className="flex items-center flex-1">
        {/* Breadcrumb */}
        <nav className="flex items-center space-x-2 text-sm">
          <Home className="w-4 h-4 text-slate-400" />
          <ChevronRight className="w-4 h-4 text-slate-600" />
          <span className="text-slate-400">Ana Sayfa</span>
          <ChevronRight className="w-4 h-4 text-slate-600" />
          <span className="text-slate-400">OptiPlan 360</span>
          <ChevronRight className="w-4 h-4 text-slate-600" />
          <span className="text-slate-200 font-medium">OCR Kontrol</span>
        </nav>
      </div>

      {/* Connection Status - Removed HTTP 500 Warning */}
      <div className="flex-1 max-w-md mx-8">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
          <span className="text-sm text-emerald-400">Sistem Aktif</span>
        </div>
      </div>

      {/* Right side icons */}
      <div className="flex items-center space-x-4">
        {/* Notifications */}
        <button className="relative p-2 text-slate-400 hover:text-slate-200 transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>

        {/* User */}
        <button className="flex items-center space-x-2 text-slate-400 hover:text-slate-200 transition-colors">
          <User className="w-5 h-5" />
          <span className="text-sm">Operatör</span>
        </button>
      </div>
    </header>
  );
};
