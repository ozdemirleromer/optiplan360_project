import { FullConfig } from '@playwright/test';

/**
 * Global teardown for E2E tests
 * Cleans up test environment and test data
 */
async function globalTeardown(config: FullConfig) {
  console.log('🧹 Cleaning up E2E test environment...');
  
  try {
    // Clean up test data
    await cleanupTestData();
    
    // Clean up test users
    await cleanupTestUsers();
    
    // Generate test reports
    await generateTestReports();
    
    console.log('✅ E2E test environment cleaned up');
  } catch (error) {
    console.error('❌ E2E teardown failed:', error);
  }
}

async function cleanupTestData() {
  // Clean up test data via API calls
  const testApiUrl = process.env.TEST_API_URL || 'http://localhost:8080/api/v1';
  
  try {
    // Delete test customers
    await fetch(`${testApiUrl}/customers/test/cleanup`, {
      method: 'DELETE'
    });
    
    // Delete test products
    await fetch(`${testApiUrl}/products/test/cleanup`, {
      method: 'DELETE'
    });
    
    // Delete test orders
    await fetch(`${testApiUrl}/orders/test/cleanup`, {
      method: 'DELETE'
    });
    
    console.log('🗑️ Test data cleaned up');
  } catch (error) {
    console.warn('Test data cleanup failed:', error);
  }
}

async function cleanupTestUsers() {
  // Clean up test users
  const testApiUrl = process.env.TEST_API_URL || 'http://localhost:8080/api/v1';
  
  try {
    await fetch(`${testApiUrl}/users/test/cleanup`, {
      method: 'DELETE'
    });
    
    console.log('👤 Test users cleaned up');
  } catch (error) {
    console.warn('Test users cleanup failed:', error);
  }
}

async function generateTestReports() {
  // Generate comprehensive test reports
  console.log('📊 Generating test reports...');
  
  // This would integrate with your reporting system
  // For now, just log completion
}

export default globalTeardown;
