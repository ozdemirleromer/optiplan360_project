import { chromium, FullConfig } from '@playwright/test';

/**
 * Global setup for E2E tests
 * Prepares test environment and test data
 */
async function globalSetup(config: FullConfig) {
  console.log('🚀 Setting up E2E test environment...');
  
  const browser = await chromium.launch();
  const context = await browser.newContext();
  
  try {
    // Setup test database
    await setupTestData();
    
    // Setup test users
    await setupTestUsers(context);
    
    // Verify backend is ready
    await verifyBackendHealth();
    
    console.log('✅ E2E test environment ready');
  } catch (error) {
    console.error('❌ E2E setup failed:', error);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

async function setupTestData() {
  // Create test data via API calls
  const testApiUrl = process.env.TEST_API_URL || 'http://localhost:8080/api/v1';
  
  // Create test customers
  await createTestCustomer(testApiUrl, {
    name: 'Test Müşteri',
    phone: '+905551234567',
    email: 'test@example.com'
  });
  
  // Create test products
  await createTestProduct(testApiUrl, {
    name: 'Test Ürün',
    ts_code: 'TEST001',
    thickness_mm: 18
  });
  
  console.log('📊 Test data created');
}

async function setupTestUsers(context: any) {
  // Create test admin user
  const page = await context.newPage();
  await page.goto('/register');
  
  await page.fill('[data-testid="username"]', 'testadmin');
  await page.fill('[data-testid="email"]', 'testadmin@optiplan360.com');
  await page.fill('[data-testid="password"]', 'TestAdmin123!');
  await page.fill('[data-testid="confirmPassword"]', 'TestAdmin123!');
  
  await page.click('[data-testid="register-button"]');
  
  // Wait for registration success
  await page.waitForSelector('[data-testid="registration-success"]');
  
  await page.close();
  console.log('👤 Test users created');
}

async function verifyBackendHealth() {
  const response = await fetch('http://localhost:8080/health');
  if (!response.ok) {
    throw new Error(`Backend health check failed: ${response.status}`);
  }
  console.log('🏥 Backend health verified');
}

async function createTestCustomer(apiUrl: string, customerData: any) {
  const response = await fetch(`${apiUrl}/customers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(customerData)
  });
  
  if (!response.ok) {
    console.warn('Test customer creation failed, may already exist');
  }
}

async function createTestProduct(apiUrl: string, productData: any) {
  const response = await fetch(`${apiUrl}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(productData)
  });
  
  if (!response.ok) {
    console.warn('Test product creation failed, may already exist');
  }
}

export default globalSetup;
