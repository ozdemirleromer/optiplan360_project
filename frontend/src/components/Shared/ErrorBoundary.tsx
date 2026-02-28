/**
 * Error Boundary Component
 * Tüm React hataları yakalar ve güvenli UI gösterir
 * @example
 *   <ErrorBoundary>
 *     <YourApp />
 *   </ErrorBoundary>
 */

import React, { ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);

    // Sentry, LogRocket vb. monitoring servisine gönder
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Optional: API'ye hata raporla
    // reportErrorToServer(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorCode = `ERR-${Date.now().toString(36).toUpperCase()}`;

      return (
        <div className="min-h-screen bg-gradient-to-b from-red-50 to-gray-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
            <div className="flex justify-center mb-4">
              <AlertCircle className="w-16 h-16 text-red-500" />
            </div>

            <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
              Bir hata oluştu
            </h1>

            <p className="text-gray-600 text-center mb-6">
              Sayfa yüklenirken beklenmedik bir sorun oluştu. Lütfen sayfayı
              yenileyin veya ana sayfaya dönün.
            </p>

            <div className="bg-gray-100 rounded p-4 mb-6 border-l-4 border-red-500">
              <p className="text-xs font-mono text-gray-700 break-words">
                {this.state.error?.message || 'Unknown error'}
              </p>
              <p className="text-xs text-gray-500 mt-2">Hata Kodu: {errorCode}</p>
            </div>

            {process.env.NODE_ENV === 'development' && (
              <details className="mb-6 bg-gray-100 p-3 rounded text-xs">
                <summary className="cursor-pointer font-semibold text-gray-700">
                  Detaylı Bilgi (Geliştirici Modu)
                </summary>
                <pre className="mt-2 overflow-auto text-gray-600 whitespace-pre-wrap">
                  {this.state.error?.stack}
                </pre>
              </details>
            )}

            <div className="space-y-3">
              <button
                onClick={this.handleReset}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Tekrar Dene
              </button>

              <button
                onClick={this.handleGoHome}
                className="w-full flex items-center justify-center gap-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                <Home className="w-4 h-4" />
                Ana Sayfaya Dön
              </button>
            </div>

            <p className="text-xs text-gray-500 text-center mt-4">
              Sorun devam ederse, destek ekibiyle iletişime geçin.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * useErrorHandler Hook
 * Async operasyonlarda hata yönetimi
 */
export const useErrorHandler = () => {
  const [error, setError] = React.useState<Error | null>(null);

  const handleError = (err: unknown) => {
    const error = err instanceof Error ? err : new Error(String(err));
    setError(error);
    console.error('useErrorHandler:', error);
  };

  const clearError = () => {
    setError(null);
  };

  return { error, handleError, clearError };
};
