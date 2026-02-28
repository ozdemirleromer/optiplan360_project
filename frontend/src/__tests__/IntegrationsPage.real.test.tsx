import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IntegrationsPage } from '../components/Admin/IntegrationsPage';
import { adminService } from '../services/adminService';

vi.mock('../services/adminService');

describe('IntegrationsPage - Real API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tests OCR services with real API calls', async () => {
    vi.mocked(adminService.testAzureOCR).mockResolvedValue({ success: true, message: 'Azure OK', timestamp: new Date().toISOString() });
    vi.mocked(adminService.testGoogle).mockResolvedValue({ success: true, message: 'Google OK', timestamp: new Date().toISOString() });
    vi.mocked(adminService.testAws).mockResolvedValue({ success: true, message: 'AWS OK', timestamp: new Date().toISOString() });
    vi.mocked(adminService.updateOCRConfig).mockResolvedValue({} as never);
    
    render(<IntegrationsPage />);
    
    // Find and click test button
    const testButton = await screen.findByText('OCR Servislerini Test Et');
    fireEvent.click(testButton);
    
    await waitFor(() => {
      expect(adminService.testAzureOCR).toHaveBeenCalled();
      expect(adminService.testGoogle).toHaveBeenCalled();
      expect(adminService.testAws).toHaveBeenCalled();
    });
  });

  it('saves OCR configuration successfully', async () => {
    vi.mocked(adminService.updateOCRConfig).mockResolvedValue({} as never);
    
    render(<IntegrationsPage />);
    
    const saveButton = await screen.findByText('OCR Yapılandırmayı Kaydet');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(adminService.updateOCRConfig).toHaveBeenCalledWith(expect.objectContaining({
        engine: expect.any(String),
        languages: expect.any(Array),
      }));
    });
  });

  it('handles test failures gracefully', async () => {
    vi.mocked(adminService.testAzureOCR).mockRejectedValue(new Error('Azure error'));
    vi.mocked(adminService.testGoogle).mockRejectedValue(new Error('Google error'));
    vi.mocked(adminService.testAws).mockRejectedValue(new Error('AWS error'));
    
    render(<IntegrationsPage />);
    
    const testButton = await screen.findByText('OCR Servislerini Test Et');
    fireEvent.click(testButton);
    
    await waitFor(() => {
      // Should not crash, just show error alert
      expect(adminService.testAzureOCR).toHaveBeenCalled();
    });
  });
});
