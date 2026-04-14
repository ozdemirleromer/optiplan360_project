import { test, expect, Page } from '@playwright/test';

/**
 * OptiPlan360 E2E Test Base Class
 * Common utilities and setup for E2E tests
 */
export class OptiPlanPage {
  constructor(public page: Page) {}

  // Navigation helpers
  async navigateToDashboard() {
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
  }

  async navigateToOrders() {
    await this.page.click('[data-testid="nav-orders"]');
    await this.page.waitForURL('**/orders');
  }

  async navigateToCustomers() {
    await this.page.click('[data-testid="nav-customers"]');
    await this.page.waitForURL('**/customers');
  }

  async navigateToStock() {
    await this.page.click('[data-testid="nav-stock"]');
    await this.page.waitForURL('**/stock');
  }

  async navigateToAdmin() {
    await this.page.click('[data-testid="nav-admin"]');
    await this.page.waitForURL('**/admin');
  }

  // Authentication helpers
  async login(username: string, password: string) {
    await this.page.goto('/login');
    await this.page.fill('[data-testid="username"]', username);
    await this.page.fill('[data-testid="password"]', password);
    await this.page.click('[data-testid="login-button"]');
    
    // Wait for successful login
    await this.page.waitForSelector('[data-testid="user-menu"]');
    await expect(this.page.locator('[data-testid="user-menu"]')).toBeVisible();
  }

  async logout() {
    await this.page.click('[data-testid="user-menu"]');
    await this.page.click('[data-testid="logout-button"]');
    await this.page.waitForURL('**/login');
  }

  // Form helpers
  async fillForm(formData: Record<string, string>) {
    for (const [field, value] of Object.entries(formData)) {
      await this.page.fill(`[data-testid="${field}"]`, value);
    }
  }

  async selectDropdown(selector: string, value: string) {
    await this.page.click(selector);
    await this.page.click(`[data-value="${value}"]`);
  }

  async uploadFile(selector: string, filePath: string) {
    await this.page.setInputFiles(selector, filePath);
  }

  // Assertion helpers
  async expectSuccessMessage(message?: string) {
    const successLocator = this.page.locator('[data-testid="success-message"]');
    await expect(successLocator).toBeVisible();
    
    if (message) {
      await expect(successLocator).toContainText(message);
    }
  }

  async expectErrorMessage(message?: string) {
    const errorLocator = this.page.locator('[data-testid="error-message"]');
    await expect(errorLocator).toBeVisible();
    
    if (message) {
      await expect(errorLocator).toContainText(message);
    }
  }

  async expectLoadingToComplete() {
    await this.page.waitForSelector('[data-testid="loading"]', { state: 'hidden' });
  }

  // Data helpers
  async getTableData(tableSelector: string) {
    const rows = await this.page.locator(`${tableSelector} tbody tr`).all();
    const data = [];
    
    for (const row of rows) {
      const cells = await row.locator('td').allTextContents();
      data.push(cells);
    }
    
    return data;
  }

  async waitForTableRow(tableSelector: string, searchText: string) {
    await this.page.waitForSelector(`${tableSelector} tbody tr:has-text("${searchText}")`);
  }

  // Performance helpers
  async measurePageLoad(pageName: string) {
    const startTime = Date.now();
    await this.page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    
    console.log(`📊 ${pageName} page load time: ${loadTime}ms`);
    
    // Assert reasonable load times
    expect(loadTime).toBeLessThan(5000);
    
    return loadTime;
  }

  // Accessibility helpers
  async checkAccessibility() {
    // Basic accessibility checks
    const title = await this.page.title();
    expect(title).toBeTruthy();
    
    // Check for proper heading structure
    const h1 = await this.page.locator('h1').count();
    expect(h1).toBeGreaterThan(0);
    
    // Check for proper form labels
    const inputs = await this.page.locator('input:not([aria-label]):not([aria-labelledby])').count();
    expect(inputs).toBe(0);
  }
}

// Test fixtures
export const testWithPage = test.extend<{ optiPlan: OptiPlanPage }>({
  optiPlan: async ({ page }, use) => {
    const optiPlan = new OptiPlanPage(page);
    await use(optiPlan);
  },
});
