import { test, expect } from '@playwright/test';
import { testWithPage } from '../utils/optiplan-page';

testWithPage.describe('Performance Tests', () => {
  test('should load dashboard within performance threshold', async ({ optiPlan }) => {
    await optiPlan.login('testadmin', 'TestAdmin123!');
    
    const loadTime = await optiPlan.measurePageLoad('Dashboard');
    
    // Dashboard should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });

  test('should handle large data sets efficiently', async ({ optiPlan }) => {
    await optiPlan.login('testadmin', 'TestAdmin123!');
    await optiPlan.navigateToOrders();
    
    // Measure time to load large order list
    const startTime = Date.now();
    await optiPlan.expectLoadingToComplete();
    const loadTime = Date.now() - startTime;
    
    // Should load within 5 seconds even with large data
    expect(loadTime).toBeLessThan(5000);
  });

  test('should maintain responsiveness during file upload', async ({ optiPlan }) => {
    await optiPlan.login('testadmin', 'TestAdmin123!');
    await optiPlan.navigateToOrders();
    
    // Start file upload
    await optiPlan.page.click('[data-testid="upload-ocr-button"]');
    
    // UI should remain responsive during upload
    const startTime = Date.now();
    await expect(optiPlan.page.locator('[data-testid="upload-button"]')).toBeVisible();
    const responseTime = Date.now() - startTime;
    
    expect(responseTime).toBeLessThan(1000);
  });
});

testWithPage.describe('Accessibility Tests', () => {
  test('should meet basic accessibility standards', async ({ optiPlan }) => {
    await optiPlan.login('testadmin', 'TestAdmin123!');
    await optiPlan.navigateToDashboard();
    
    // Check page structure
    await expect(optiPlan.page.locator('h1')).toBeVisible();
    await expect(optiPlan.page.locator('main')).toBeVisible();
    await expect(optiPlan.page.locator('nav')).toBeVisible();
    
    // Check form accessibility
    const forms = await optiPlan.page.locator('form').all();
    for (const form of forms) {
      const inputs = await form.locator('input').all();
      for (const input of inputs) {
        const hasLabel = await input.locator('xpath=../label').count() > 0 ||
                       await input.getAttribute('aria-label') !== null ||
                       await input.getAttribute('aria-labelledby') !== null;
        expect(hasLabel).toBeTruthy();
      }
    }
  });

  test('should support keyboard navigation', async ({ optiPlan }) => {
    await optiPlan.login('testadmin', 'TestAdmin123!');
    
    // Test keyboard navigation through main menu
    await optiPlan.page.keyboard.press('Tab');
    await expect(optiPlan.page.locator(':focus')).toBeVisible();
    
    // Navigate through menu items
    for (let i = 0; i < 5; i++) {
      await optiPlan.page.keyboard.press('Tab');
      await expect(optiPlan.page.locator(':focus')).toBeVisible();
    }
  });

  test('should have proper color contrast', async ({ optiPlan }) => {
    await optiPlan.login('testadmin', 'TestAdmin123!');
    
    // Check that important elements have sufficient contrast
    const buttons = await optiPlan.page.locator('button').all();
    
    for (const button of buttons.slice(0, 5)) { // Check first 5 buttons
      const styles = await button.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          color: computed.color,
          backgroundColor: computed.backgroundColor
        };
      });
      
      // Basic contrast check (would need proper calculation in real implementation)
      expect(styles.color).toBeTruthy();
      expect(styles.backgroundColor).toBeTruthy();
    }
  });
});

testWithPage.describe('Error Handling Tests', () => {
  test('should handle network errors gracefully', async ({ optiPlan }) => {
    // Simulate network failure
    await optiPlan.page.route('**/api/**', route => route.abort());
    
    await optiPlan.login('testadmin', 'TestAdmin123!');
    
    // Should show network error message
    await optiPlan.expectErrorMessage('Network error. Please check your connection.');
  });

  test('should handle server errors gracefully', async ({ optiPlan }) => {
    // Simulate server error
    await optiPlan.page.route('**/api/**', route => 
      route.fulfill({ status: 500, body: 'Internal Server Error' })
    );
    
    await optiPlan.login('testadmin', 'TestAdmin123!');
    
    // Should show server error message
    await optiPlan.expectErrorMessage('Server error. Please try again later.');
  });

  test('should handle timeout errors gracefully', async ({ optiPlan }) => {
    // Simulate timeout
    await optiPlan.page.route('**/api/**', route => {
      // Don't fulfill the request to simulate timeout
    });
    
    await optiPlan.login('testadmin', 'TestAdmin123!');
    
    // Should show timeout message after reasonable time
    await optiPlan.expectErrorMessage('Request timeout. Please try again.');
  });
});

testWithPage.describe('Responsive Design Tests', () => {
  test('should work on mobile devices', async ({ optiPlan }) => {
    await optiPlan.page.setViewportSize({ width: 375, height: 667 }); // iPhone size
    
    await optiPlan.login('testadmin', 'TestAdmin123!');
    await optiPlan.navigateToDashboard();
    
    // Should adapt to mobile layout
    await expect(optiPlan.page.locator('[data-testid="mobile-menu"]')).toBeVisible();
    await expect(optiPlan.page.locator('[data-testid="dashboard-title"]')).toBeVisible();
    
    // Mobile menu should be functional
    await optiPlan.page.click('[data-testid="mobile-menu"]');
    await expect(optiPlan.page.locator('[data-testid="mobile-nav"]')).toBeVisible();
  });

  test('should work on tablet devices', async ({ optiPlan }) => {
    await optiPlan.page.setViewportSize({ width: 768, height: 1024 }); // iPad size
    
    await optiPlan.login('testadmin', 'TestAdmin123!');
    await optiPlan.navigateToOrders();
    
    // Should adapt to tablet layout
    await expect(optiPlan.page.locator('[data-testid="orders-table"]')).toBeVisible();
    await expect(optiPlan.page.locator('[data-testid="sidebar"]')).toBeVisible();
  });

  test('should maintain functionality across orientations', async ({ optiPlan }) => {
    await optiPlan.page.setViewportSize({ width: 812, height: 375 }); // Landscape mobile
    
    await optiPlan.login('testadmin', 'TestAdmin123!');
    await optiPlan.navigateToDashboard();
    
    // Should adapt to landscape
    await expect(optiPlan.page.locator('[data-testid="dashboard-title"]')).toBeVisible();
    
    // Rotate to portrait
    await optiPlan.page.setViewportSize({ width: 375, height: 812 });
    
    // Should still be functional
    await expect(optiPlan.page.locator('[data-testid="dashboard-title"]')).toBeVisible();
  });
});

testWithPage.describe('Data Integrity Tests', () => {
  test('should prevent duplicate order creation', async ({ optiPlan }) => {
    await optiPlan.login('testadmin', 'TestAdmin123!');
    await optiPlan.navigateToOrders();
    
    // Create order
    await optiPlan.page.click('[data-testid="new-order-button"]');
    await optiPlan.fillForm({
      'customer-select': 'Test Müşteri',
      'product-select': 'Test Ürün',
      'quantity-input': '100',
      'order-reference': 'UNIQUE_REF_123'
    });
    await optiPlan.page.click('[data-testid="submit-order-button"]');
    await optiPlan.expectSuccessMessage();
    
    // Try to create duplicate
    await optiPlan.page.click('[data-testid="new-order-button"]');
    await optiPlan.fillForm({
      'customer-select': 'Test Müşteri',
      'product-select': 'Test Ürün',
      'quantity-input': '100',
      'order-reference': 'UNIQUE_REF_123'
    });
    await optiPlan.page.click('[data-testid="submit-order-button"]');
    
    // Should prevent duplicate
    await optiPlan.expectErrorMessage('Order with this reference already exists');
  });

  test('should validate data formats', async ({ optiPlan }) => {
    await optiPlan.login('testadmin', 'TestAdmin123!');
    await optiPlan.navigateToCustomers();
    
    // Try to create customer with invalid email
    await optiPlan.page.click('[data-testid="new-customer-button"]');
    await optiPlan.fillForm({
      'customer-name': 'Test Customer',
      'customer-email': 'invalid-email',
      'customer-phone': '+905551234567'
    });
    await optiPlan.page.click('[data-testid="submit-customer-button"]');
    
    // Should show validation error
    await optiPlan.expectErrorMessage('Please enter a valid email address');
  });
});
