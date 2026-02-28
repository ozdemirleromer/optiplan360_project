import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OpportunitiesTab, QuotesTab, ErrorsTab, AuditTab } from '../components/CRM/CRMPage';
import { crmService } from '../services/crmService';
import { integrationService } from '../services/integrationService';

// Mock services
vi.mock('../services/crmService');
vi.mock('../services/integrationService');

describe('CRMPage Tab Components - Real Functionality Tests', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('OpportunitiesTab', () => {
    it('fetches and displays real opportunities data', async () => {
      const mockOpportunities = [
        { id: '1', title: 'Test Firsat 1', account: { companyName: 'Musteri A' }, stage: 'PROSPECTING', amount: 50000 },
        { id: '2', title: 'Test Firsat 2', account: { companyName: 'Musteri B' }, stage: 'PROPOSAL', amount: 75000 },
      ];

      vi.mocked(crmService.listOpportunities).mockResolvedValue(mockOpportunities as never);

      render(<OpportunitiesTab />);

      await waitFor(() => {
        expect(screen.getByText('Test Firsat 1')).toBeInTheDocument();
        expect(screen.getByText('Test Firsat 2')).toBeInTheDocument();
      });
    });

    it('handles API errors gracefully', async () => {
      vi.mocked(crmService.listOpportunities).mockRejectedValue(new Error('API Error'));

      render(<OpportunitiesTab />);

      await waitFor(() => {
        expect(screen.getByText('Henüz fırsat bulunmuyor.')).toBeInTheDocument();
      });
    });

    it('opens create opportunity modal', async () => {
      vi.mocked(crmService.listOpportunities).mockResolvedValue([]);

      render(<OpportunitiesTab />);

      await waitFor(() => {
        expect(screen.getByText('+ Yeni Fırsat')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('+ Yeni Fırsat'));

      await waitFor(() => {
        expect(screen.getByText('Yeni Fırsat Oluştur')).toBeInTheDocument();
      });
    });
  });

  describe('QuotesTab', () => {
    it('fetches and displays real quotes data', async () => {
      const mockQuotes = [
        { id: '1', quoteNumber: 'QT-001', accountId: 'A', total: 25000, status: 'SENT' },
        { id: '2', quoteNumber: 'QT-002', accountId: 'B', total: 50000, status: 'ACCEPTED' },
      ];

      vi.mocked(crmService.listQuotes).mockResolvedValue(mockQuotes as never);

      render(<QuotesTab />);

      await waitFor(() => {
        expect(screen.getByText('QT-001')).toBeInTheDocument();
        expect(screen.getByText('QT-002')).toBeInTheDocument();
      });
    });

    it('displays correct status badges', async () => {
      const mockQuotes = [
        { id: '1', quoteNumber: 'QT-001', accountId: 'A', total: 1000, status: 'SENT' },
        { id: '2', quoteNumber: 'QT-002', accountId: 'B', total: 2000, status: 'ACCEPTED' },
      ];

      vi.mocked(crmService.listQuotes).mockResolvedValue(mockQuotes as never);

      render(<QuotesTab />);

      await waitFor(() => {
        expect(screen.getByText('SENT')).toBeInTheDocument();
        expect(screen.getByText('ACCEPTED')).toBeInTheDocument();
      });
    });
  });

  describe('ErrorsTab', () => {
    it('fetches and displays real error logs', async () => {
      const mockErrors = [
        { errorCode: 'API_ERROR', errorMessage: 'Connection failed', createdAt: new Date().toISOString() },
        { errorCode: 'SYNC_ERROR', errorMessage: 'Sync failed', createdAt: new Date().toISOString() },
      ];

      vi.mocked(integrationService.listErrors).mockResolvedValue(mockErrors as never);

      render(<ErrorsTab />);

      await waitFor(() => {
        expect(screen.getByText('API_ERROR')).toBeInTheDocument();
        expect(screen.getByText('Connection failed')).toBeInTheDocument();
        expect(screen.getByText('SYNC_ERROR')).toBeInTheDocument();
      });
    });

    it('displays empty state when no errors', async () => {
      vi.mocked(integrationService.listErrors).mockResolvedValue([]);

      render(<ErrorsTab />);

      await waitFor(() => {
        expect(screen.getByText('Henüz hata kaydı bulunmuyor.')).toBeInTheDocument();
      });
    });
  });

  describe('AuditTab', () => {
    it('fetches and displays real audit logs', async () => {
      const mockAudits = [
        { action: 'CREATE', entityType: 'order', entityId: '123', createdAt: new Date().toISOString() },
        { action: 'UPDATE', entityType: 'customer', entityId: '456', createdAt: new Date().toISOString() },
      ];

      vi.mocked(integrationService.listAudit).mockResolvedValue(mockAudits as never);

      render(<AuditTab />);

      await waitFor(() => {
        expect(screen.getByText('CREATE')).toBeInTheDocument();
        expect(screen.getByText('order: 123')).toBeInTheDocument();
        expect(screen.getByText('UPDATE')).toBeInTheDocument();
      });
    });

    it('displays empty state when no audit records', async () => {
      vi.mocked(integrationService.listAudit).mockResolvedValue([]);

      render(<AuditTab />);

      await waitFor(() => {
        expect(screen.getByText('Henüz işlem kaydı bulunmuyor.')).toBeInTheDocument();
      });
    });
  });
});
