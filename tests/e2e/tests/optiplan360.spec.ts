import { test, expect } from '@playwright/test';
import { testWithPage } from '../utils/optiplan-page';

testWithPage.describe('Authentication Flow', () => {
  test('should allow user to login with valid credentials', async ({ optiPlan }) => {
    await optiPlan.navigateToDashboard();
    
    // Should redirect to login
    await expect(optiPlan.page).toHaveURL(/.*login/);
    
    // Login with valid credentials
    await optiPlan.login('testadmin', 'TestAdmin123!');
    
    // Should redirect to dashboard
    await expect(optiPlan.page).toHaveURL(/.*dashboard/);
    await optiPlan.expectSuccessMessage();
  });

  test('should show error for invalid credentials', async ({ optiPlan }) => {
    await optiPlan.navigateToDashboard();
    
    // Try login with invalid credentials
    await optiPlan.login('invaliduser', 'invalidpassword');
    
    // Should show error message
    await optiPlan.expectErrorMessage('Invalid username or password');
    await expect(optiPlan.page).toHaveURL(/.*login/);
  });

  test('should allow user to logout', async ({ optiPlan }) => {
    // First login
    await optiPlan.login('testadmin', 'TestAdmin123!');
    
    // Then logout
    await optiPlan.logout();
    
    // Should redirect to login
    await expect(optiPlan.page).toHaveURL(/.*login/);
  });
});

testWithPage.describe('Dashboard', () => {
  test.beforeEach(async ({ optiPlan }) => {
    await optiPlan.login('testadmin', 'TestAdmin123!');
  });

  test('should display dashboard with key metrics', async ({ optiPlan }) => {
    await optiPlan.navigateToDashboard();
    
    // Check dashboard elements
    await expect(optiPlan.page.locator('[data-testid="dashboard-title"]')).toBeVisible();
    await expect(optiPlan.page.locator('[data-testid="total-orders"]')).toBeVisible();
    await expect(optiPlan.page.locator('[data-testid="total-customers"]')).toBeVisible();
    await expect(optiPlan.page.locator('[data-testid="total-revenue"]')).toBeVisible();
    
    // Check accessibility
    await optiPlan.checkAccessibility();
    
    // Measure performance
    await optiPlan.measurePageLoad('Dashboard');
  });

  test('should show recent orders', async ({ optiPlan }) => {
    await optiPlan.navigateToDashboard();
    
    // Check recent orders section
    await expect(optiPlan.page.locator('[data-testid="recent-orders"]')).toBeVisible();
    
    const ordersData = await optiPlan.getTableData('[data-testid="recent-orders-table"]');
    expect(ordersData.length).toBeGreaterThan(0);
  });
});

testWithPage.describe('Order Management', () => {
  test.beforeEach(async ({ optiPlan }) => {
    await optiPlan.login('testadmin', 'TestAdmin123!');
  });

  test('should create new order', async ({ optiPlan }) => {
    await optiPlan.navigateToOrders();
    
    // Click new order button
    await optiPlan.page.click('[data-testid="new-order-button"]');
    
    // Fill order form
    await optiPlan.fillForm({
      'customer-select': 'Test Müşteri',
      'product-select': 'Test Ürün',
      'quantity-input': '100',
      'thickness-input': '18',
      'width-input': '2100',
      'height-input': '2970'
    });
    
    // Submit order
    await optiPlan.page.click('[data-testid="submit-order-button"]');
    
    // Should show success message
    await optiPlan.expectSuccessMessage('Order created successfully');
    
    // Should redirect to order details
    await expect(optiPlan.page).toHaveURL(/.*orders\/\d+/);
  });

  test('should validate order form', async ({ optiPlan }) => {
    await optiPlan.navigateToOrders();
    
    // Click new order button
    await optiPlan.page.click('[data-testid="new-order-button"]');
    
    // Try to submit empty form
    await optiPlan.page.click('[data-testid="submit-order-button"]');
    
    // Should show validation errors
    await expect(optiPlan.page.locator('[data-testid="validation-error"]')).toBeVisible();
    await expect(optiPlan.page.locator('[data-testid="customer-error"]')).toBeVisible();
    await expect(optiPlan.page.locator('[data-testid="product-error"]')).toBeVisible();
    await expect(optiPlan.page.locator('[data-testid="quantity-error"]')).toBeVisible();
  });

  test('should filter orders', async ({ optiPlan }) => {
    await optiPlan.navigateToOrders();
    
    // Apply filters
    await optiPlan.selectDropdown('[data-testid="status-filter"]', 'PENDING');
    await optiPlan.fillForm({ 'search-input': 'Test' });
    
    // Should show filtered results
    await optiPlan.expectLoadingToComplete();
    
    const filteredData = await optiPlan.getTableData('[data-testid="orders-table"]');
    expect(filteredData.length).toBeGreaterThan(0);
  });
});

testWithPage.describe('Customer Management', () => {
  test.beforeEach(async ({ optiPlan }) => {
    await optiPlan.login('testadmin', 'TestAdmin123!');
  });

  test('should create new customer', async ({ optiPlan }) => {
    await optiPlan.navigateToCustomers();
    
    // Click new customer button
    await optiPlan.page.click('[data-testid="new-customer-button"]');
    
    // Fill customer form
    await optiPlan.fillForm({
      'customer-name': 'E2E Test Customer',
      'customer-phone': '+905559876543',
      'customer-email': 'e2e@test.com',
      'customer-address': 'Test Address, Istanbul'
    });
    
    // Submit form
    await optiPlan.page.click('[data-testid="submit-customer-button"]');
    
    // Should show success message
    await optiPlan.expectSuccessMessage('Customer created successfully');
    
    // Should appear in customer list
    await optiPlan.waitForTableRow('[data-testid="customers-table"]', 'E2E Test Customer');
  });

  test('should search customers', async ({ optiPlan }) => {
    await optiPlan.navigateToCustomers();
    
    // Search for test customer
    await optiPlan.fillForm({ 'customer-search': 'Test' });
    
    // Should show search results
    await optiPlan.expectLoadingToComplete();
    
    const searchResults = await optiPlan.getTableData('[data-testid="customers-table"]');
    expect(searchResults.length).toBeGreaterThan(0);
  });
});

testWithPage.describe('Stock Management', () => {
  test.beforeEach(async ({ optiPlan }) => {
    await optiPlan.login('testadmin', 'TestAdmin123!');
  });

  test('should display stock items', async ({ optiPlan }) => {
    await optiPlan.navigateToStock();
    
    // Check stock table
    await expect(optiPlan.page.locator('[data-testid="stock-table"]')).toBeVisible();
    
    const stockData = await optiPlan.getTableData('[data-testid="stock-table"]');
    expect(stockData.length).toBeGreaterThan(0);
  });

  test('should update stock quantity', async ({ optiPlan }) => {
    await optiPlan.navigateToStock();
    
    // Find test product and click edit
    await optiPlan.waitForTableRow('[data-testid="stock-table"]', 'Test Ürün');
    await optiPlan.page.click('[data-testid="edit-stock-button"]:first-child');
    
    // Update quantity
    await optiPlan.fillForm({ 'stock-quantity': '500' });
    await optiPlan.page.click('[data-testid="update-stock-button"]');
    
    // Should show success message
    await optiPlan.expectSuccessMessage('Stock updated successfully');
    
    // Should reflect updated quantity
    await optiPlan.waitForTableRow('[data-testid="stock-table"]', '500');
  });
});

testWithPage.describe('OCR Processing', () => {
  test.beforeEach(async ({ optiPlan }) => {
    await optiPlan.login('testadmin', 'TestAdmin123!');
  });

  test('should upload and process OCR document', async ({ optiPlan }) => {
    await optiPlan.navigateToOrders();
    
    // Click upload OCR button
    await optiPlan.page.click('[data-testid="upload-ocr-button"]');
    
    // Upload test file
    await optiPlan.uploadFile('[data-testid="file-input"]', 'tests/fixtures/test-order.pdf');
    
    // Start processing
    await optiPlan.page.click('[data-testid="process-ocr-button"]');
    
    // Should show processing status
    await expect(optiPlan.page.locator('[data-testid="ocr-processing"]')).toBeVisible();
    
    // Wait for completion
    await optiPlan.page.waitForSelector('[data-testid="ocr-complete"]', { timeout: 30000 });
    
    // Should show extracted data
    await expect(optiPlan.page.locator('[data-testid="extracted-data"]')).toBeVisible();
  });

  test('should handle low confidence OCR results', async ({ optiPlan }) => {
    await optiPlan.navigateToOrders();
    
    // Upload low quality test file
    await optiPlan.page.click('[data-testid="upload-ocr-button"]');
    await optiPlan.uploadFile('[data-testid="file-input"]', 'tests/fixtures/low-quality.pdf');
    await optiPlan.page.click('[data-testid="process-ocr-button"]');
    
    // Should show operator review required
    await expect(optiPlan.page.locator('[data-testid="operator-review-required"]')).toBeVisible();
    await expect(optiPlan.page.locator('[data-testid="confidence-score"]')).toBeVisible();
  });
});

testWithPage.describe('Export Functionality', () => {
  test.beforeEach(async ({ optiPlan }) => {
    await optiPlan.login('testadmin', 'TestAdmin123!');
  });

  test('should export orders to XLSX', async ({ optiPlan }) => {
    await optiPlan.navigateToOrders();
    
    // Click export button
    await optiPlan.page.click('[data-testid="export-button"]');
    
    // Select XLSX format
    await optiPlan.selectDropdown('[data-testid="export-format"]', 'XLSX');
    
    // Start export
    await optiPlan.page.click('[data-testid="start-export-button"]');
    
    // Should show export progress
    await expect(optiPlan.page.locator('[data-testid="export-progress"]')).toBeVisible();
    
    // Wait for completion
    await optiPlan.page.waitForSelector('[data-testid="export-complete"]', { timeout: 30000 });
    
    // Should show download link
    await expect(optiPlan.page.locator('[data-testid="download-link"]')).toBeVisible();
  });

  test('should handle export validation errors', async ({ optiPlan }) => {
    await optiPlan.navigateToOrders();
    
    // Try to export without required fields
    await optiPlan.page.click('[data-testid="export-button"]');
    await optiPlan.page.click('[data-testid="start-export-button"]');
    
    // Should show validation errors
    await optiPlan.expectErrorMessage('Please select required fields for export');
  });
});
