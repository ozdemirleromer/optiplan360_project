/**
 * Empty & Loading State Components
 * Boş lister ve yükleme göstergeleri için reusable bileşenler
 */

import React from 'react';
import { Package, Search, AlertCircle } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  secondaryAction,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="text-gray-400 mb-4">
        {icon || <Package className="w-16 h-16" />}
      </div>

      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 text-center mb-6 max-w-sm">{description}</p>

      <div className="flex gap-3">
        {action && (
          <button
            onClick={action.onClick}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            {action.label}
          </button>
        )}

        {secondaryAction && (
          <button
            onClick={secondaryAction.onClick}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            {secondaryAction.label}
          </button>
        )}
      </div>
    </div>
  );
};

export const EmptyOrdersState: React.FC<{ onCreateOrder?: () => void }> = ({
  onCreateOrder,
}) => (
  <EmptyState
    icon={<Package className="w-16 h-16" />}
    title="Henüz sipariş bulunmuyor"
    description="İlk siparişinizi oluşturmak için aşağıdaki butona tıklayın veya Excel'den toplu import edin."
    action={onCreateOrder ? { label: '+ Yeni Sipariş', onClick: onCreateOrder } : undefined}
    secondaryAction={
      onCreateOrder ? { label: 'Excel Import', onClick: () => {} } : undefined
    }
  />
);

export const EmptySearchState: React.FC<{ query: string; onClear?: () => void }> = ({
  query,
  onClear,
}) => (
  <EmptyState
    icon={<Search className="w-16 h-16" />}
    title="Sonuç bulunamadı"
    description={`"${query}" için eşleşen sonuç bulunamadı. Lütfen arama terimini değiştirip tekrar deneyin.`}
    action={onClear ? { label: 'Aramayı Temizle', onClick: onClear } : undefined}
  />
);

export const EmptyErrorState: React.FC<{ onRetry?: () => void }> = ({ onRetry }) => (
  <EmptyState
    icon={<AlertCircle className="w-16 h-16" />}
    title="Bir hata oluştu"
    description="Veriler yüklenirken bir hata oluştu. Lütfen tekrar deneyin."
    action={onRetry ? { label: 'Tekrar Dene', onClick: onRetry } : undefined}
  />
);

/* ─────────────────────────────────────────────────────────────────────── */
/* LOADING STATES */
/* ─────────────────────────────────────────────────────────────────────── */

export const Skeleton: React.FC<{
  width?: string;
  height?: string;
  className?: string;
}> = ({ width = 'w-full', height = 'h-4', className = '' }) => (
  <div
    className={`
      bg-gray-200 rounded animate-pulse
      ${width} ${height} ${className}
    `}
  />
);

export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 5,
  cols = 4,
}) => (
  <div className="space-y-3">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex gap-3">
        {Array.from({ length: cols }).map((_, j) => (
          <Skeleton key={j} className="flex-1" width="flex-1" height="h-8" />
        ))}
      </div>
    ))}
  </div>
);

export const CardSkeleton: React.FC = () => (
  <div className="bg-white rounded-lg p-4 shadow space-y-4">
    <Skeleton width="w-1/3" height="h-6" />
    <Skeleton width="w-2/3" height="h-4" />
    <Skeleton width="w-1/2" height="h-4" />
    <div className="pt-4 flex gap-2">
      <Skeleton width="w-20" height="h-10" className="rounded" />
      <Skeleton width="w-20" height="h-10" className="rounded" />
    </div>
  </div>
);

export const LoadingSpinner: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({
  size = 'md',
}) => {
  const sizeClass =
    size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-12 h-12' : 'w-8 h-8';

  return (
    <div className="flex items-center justify-center">
      <div
        className={`
          ${sizeClass}
          border-2 border-gray-300 border-t-blue-600
          rounded-full animate-spin
        `}
      />
    </div>
  );
};

export const PageLoader: React.FC = () => (
  <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50">
    <LoadingSpinner size="lg" />
    <p className="text-gray-600 font-medium">Yükleniyor...</p>
  </div>
);

export const InlineLoader: React.FC<{ message?: string }> = ({
  message = 'Yükleniyor...',
}) => (
  <div className="flex items-center gap-2 text-gray-600">
    <LoadingSpinner size="sm" />
    <span className="text-sm">{message}</span>
  </div>
);

/**
 * useLoading Hook
 * Async işlemlarda loading state yönetimi
 */
export const useLoading = (initialState = false) => {
  const [isLoading, setIsLoading] = React.useState(initialState);

  const withLoading = React.useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      setIsLoading(true);
      try {
        return await fn();
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  return { isLoading, setIsLoading, withLoading };
};
