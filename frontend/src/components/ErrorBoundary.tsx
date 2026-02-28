import React, { Component, ErrorInfo, ReactNode } from 'react';
import { COLORS, primaryRgba } from './Shared/constants';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error Boundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });

    // Burada hata tracking servisi entegre edilebilir (Sentry, LogRocket, vb.)
    // Example: Sentry.captureException(error, { extra: errorInfo });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback varsa onu kullan
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '2rem',
            backgroundColor: COLORS.bg.main,
            color: COLORS.text,
            fontFamily: "'Segoe UI', system-ui, sans-serif",
          }}
        >
          <div
            style={{
              maxWidth: '600px',
              width: '100%',
              backgroundColor: COLORS.bg.surface,
              borderRadius: '2px',
              padding: '2rem',
              border: `1px solid ${COLORS.border}`,
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                backgroundColor: '#F43F5E',
                borderRadius: '2px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1.5rem',
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>

            <h1
              style={{
                fontSize: '1.5rem',
                fontWeight: '700',
                marginBottom: '0.5rem',
                color: '#fff',
              }}
            >
              Bir Şeyler Yanlış Gitti
            </h1>

            <p
              style={{
                color: '#A1A1AA',
                marginBottom: '1.5rem',
                lineHeight: '1.6',
              }}
            >
              Üzgünüz, beklenmeyen bir hata oluştu. Lütfen sayfayı yenileyin veya
              yöneticinizle iletişime geçin.
            </p>

            {this.state.error && (
              <details
                style={{
                  backgroundColor: COLORS.bg.main,
                  padding: '1rem',
                  borderRadius: '2px',
                  marginBottom: '1.5rem',
                  border: `1px solid ${COLORS.border}80`,
                }}
              >
                <summary
                  style={{
                    cursor: 'pointer',
                    color: COLORS.primary.DEFAULT,
                    fontWeight: '500',
                    marginBottom: '0.5rem',
                  }}
                >
                  Hata Detayları
                </summary>
                <pre
                  style={{
                    fontSize: '0.75rem',
                    color: '#F43F5E',
                    overflow: 'auto',
                    marginTop: '0.75rem',
                    lineHeight: '1.5',
                  }}
                >
                  {this.state.error.toString()}
                </pre>
                {this.state.errorInfo && (
                  <pre
                    style={{
                      fontSize: '0.7rem',
                      color: '#999999',
                      overflow: 'auto',
                      marginTop: '0.5rem',
                      lineHeight: '1.4',
                    }}
                  >
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </details>
            )}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  flex: 1,
                  padding: '0.75rem 1.5rem',
                  backgroundColor: COLORS.primary.DEFAULT,
                  color: '#fff',
                  border: 'none',
                  borderRadius: '2px',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = COLORS.primary[600];
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = COLORS.primary.DEFAULT;
                }}
              >
                Sayfayı Yenile
              </button>

              <button
                onClick={this.handleReset}
                style={{
                  flex: 1,
                  padding: '0.75rem 1.5rem',
                  backgroundColor: 'transparent',
                  color: COLORS.primary.DEFAULT,
                  border: `1px solid ${primaryRgba(0.3)}`,
                  borderRadius: '2px',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = primaryRgba(0.1);
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                Tekrar Dene
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
