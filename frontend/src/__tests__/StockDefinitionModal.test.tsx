import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StockAndCustomerDefinitionModal } from '../components/Stock/StockAndCustomerDefinitionModal';

describe('StockAndCustomerDefinitionModal - Real API Integration Tests', () => {
  const mockProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSelectStock: vi.fn(),
    onSelectCustomer: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('fetches stock data from real API on search', async () => {
    const mockStockData = [
      { stock_code: 'STK001', stock_name: '18mm Beyaz MDF', quantity: 100, unit_price: 250, thickness: '18mm', color: 'Beyaz' }
    ];
    
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockStockData,
    } as Response);
    
    render(<StockAndCustomerDefinitionModal {...mockProps} />);
    
    const searchInput = screen.getByPlaceholderText('Stok kodu veya adı ile ara...');
    await userEvent.type(searchInput, 'MDF');
    
    // Wait for debounce
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/stock/stock-cards/search?q=MDF')
      );
    }, { timeout: 500 });
    
    await waitFor(() => {
      expect(screen.getByText('STK001')).toBeInTheDocument();
      expect(screen.getByText('18mm Beyaz MDF')).toBeInTheDocument();
    });
  });

  it('fetches customer data from real API on search', async () => {
    const mockCustomerData = [
      { id: 'C001', name: 'Test Müşteri', phone: '5551234567', email: 'test@test.com', tax_number: '123456', address: 'Test Adres' }
    ];
    
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockCustomerData,
    } as Response);
    
    render(<StockAndCustomerDefinitionModal {...mockProps} />);
    
    // Switch to customer tab
    const customerTab = screen.getByText('Cari Tanımlama');
    fireEvent.click(customerTab);
    
    const searchInput = screen.getByPlaceholderText('Müşteri kodu veya adı ile ara...');
    await userEvent.type(searchInput, 'Test');
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/crm/accounts/search?q=Test')
      );
    }, { timeout: 500 });
  });

  it('handles API errors gracefully', async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));
    
    render(<StockAndCustomerDefinitionModal {...mockProps} />);
    
    const searchInput = screen.getByPlaceholderText('Stok kodu veya adı ile ara...');
    await userEvent.type(searchInput, 'Test');
    
    // Should not crash, just show no results
    await waitFor(() => {
      expect(screen.queryByText('STK001')).not.toBeInTheDocument();
    }, { timeout: 500 });
  });

  it('selects stock and calls onSelectStock callback', async () => {
    const mockStockData = [
      { stock_code: 'STK001', stock_name: '18mm Beyaz MDF', quantity: 100, unit_price: 250, thickness: '18mm', color: 'Beyaz' }
    ];
    
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockStockData,
    } as Response);
    
    render(<StockAndCustomerDefinitionModal {...mockProps} />);
    
    const searchInput = screen.getByPlaceholderText('Stok kodu veya adı ile ara...');
    await userEvent.type(searchInput, 'MDF');
    
    await waitFor(() => {
      expect(screen.getByText('STK001')).toBeInTheDocument();
    }, { timeout: 500 });
    
    // Click on stock item
    fireEvent.click(screen.getByText('STK001'));
    
    // Enter quantity - label htmlFor kullanmadigi icin role ile buluyoruz
    const quantityInputs = screen.getAllByRole('spinbutton');
    const quantityInput = quantityInputs[0]; // ilk number input miktar
    fireEvent.change(quantityInput, { target: { value: '5' } });
    
    // Click add button
    const addButton = screen.getByText('Stoğu Ekle');
    fireEvent.click(addButton);
    
    expect(mockProps.onSelectStock).toHaveBeenCalledWith(expect.objectContaining({
      stock_code: 'STK001',
      quantity: 5,
      unit_price: 250,
      total_price: 1250
    }));
  });

  it('debounces search requests', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);

    render(<StockAndCustomerDefinitionModal {...mockProps} />);
    
    const searchInput = screen.getByPlaceholderText('Stok kodu veya adı ile ara...');
    
    // Type quickly
    await userEvent.type(searchInput, 'ABC');
    
    // Should not call API immediately
    expect(global.fetch).not.toHaveBeenCalled();
    
    // Wait for debounce
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    }, { timeout: 500 });
  });
});
