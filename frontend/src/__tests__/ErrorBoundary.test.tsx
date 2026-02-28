import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../components/Shared/ErrorBoundary';

// Test component that throws error
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>Normal content</div>;
};

describe('ErrorBoundary', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let suppressExpectedErrors: (event: ErrorEvent) => void;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    suppressExpectedErrors = (event: ErrorEvent) => {
      if (event.error instanceof Error && event.error.message === 'Test error') {
        event.preventDefault();
      }
    };
    window.addEventListener('error', suppressExpectedErrors);
  });

  afterEach(() => {
    window.removeEventListener('error', suppressExpectedErrors);
    consoleErrorSpy.mockRestore();
  });

  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('renders error UI when error occurs', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    // Bileşen "Bir hata oluştu" başlığı ve "Tekrar Dene" butonu kullanıyor
    expect(screen.getByText('Bir hata oluştu')).toBeInTheDocument();
    expect(screen.getByText('Tekrar Dene')).toBeInTheDocument();
  });

  it('shows error details in error UI', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    // Hata mesajı ve "Ana Sayfaya Dön" butonu görünmeli
    expect(screen.getByText('Test error')).toBeInTheDocument();
    expect(screen.getByText('Ana Sayfaya Dön')).toBeInTheDocument();
  });
});
