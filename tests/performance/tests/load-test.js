import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 10 },   // Warm up
    { duration: '5m', target: 50 },   // Load
    { duration: '2m', target: 100 },  // Peak
    { duration: '5m', target: 50 },   // Sustained
    { duration: '2m', target: 0 },    // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.1'],    // Error rate under 10%
    errors: ['rate<0.1'],             // Custom error rate under 10%
  },
};

const BASE_URL = 'http://localhost:8080/api/v1';
const FRONTEND_URL = 'http://localhost:5173';

// Test data
const testUsers = [
  { username: 'testuser1', password: 'TestPass123!' },
  { username: 'testuser2', password: 'TestPass123!' },
  { username: 'testuser3', password: 'TestPass123!' },
];

const testOrders = [
  { customer_id: 1, product_id: 1, quantity: 100, thickness: 18 },
  { customer_id: 2, product_id: 2, quantity: 200, thickness: 22 },
  { customer_id: 3, product_id: 3, quantity: 150, thickness: 25 },
];

export function setup() {
  // Create test users and data
  console.log('🚀 Setting up performance test environment...');
  
  // Setup test authentication tokens
  const tokens = [];
  for (const user of testUsers) {
    const loginResponse = http.post(`${BASE_URL}/auth/login`, JSON.stringify(user), {
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (loginResponse.status === 200) {
      const token = JSON.parse(loginResponse.body).access_token;
      tokens.push(token);
    }
  }
  
  return { tokens };
}

export default function(data) {
  const token = data.tokens[Math.floor(Math.random() * data.tokens.length)];
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // Test 1: API Health Check
  const healthResponse = http.get(`${BASE_URL}/health`, { headers });
  const healthOk = check(healthResponse, {
    'health check status is 200': (r) => r.status === 200,
    'health check response time < 100ms': (r) => r.timings.duration < 100,
  });
  
  if (!healthOk) {
    errorRate.add(1);
  }

  // Test 2: Get Orders List
  const ordersResponse = http.get(`${BASE_URL}/orders?limit=50`, { headers });
  const ordersOk = check(ordersResponse, {
    'orders list status is 200': (r) => r.status === 200,
    'orders list response time < 300ms': (r) => r.timings.duration < 300,
    'orders list has data': (r) => JSON.parse(r.body).data.length > 0,
  });
  
  if (!ordersOk) {
    errorRate.add(1);
  }

  // Test 3: Get Customers List
  const customersResponse = http.get(`${BASE_URL}/customers?limit=50`, { headers });
  const customersOk = check(customersResponse, {
    'customers list status is 200': (r) => r.status === 200,
    'customers list response time < 300ms': (r) => r.timings.duration < 300,
    'customers list has data': (r) => JSON.parse(r.body).length > 0,
  });
  
  if (!customersOk) {
    errorRate.add(1);
  }

  // Test 4: Create New Order (30% probability)
  if (Math.random() < 0.3) {
    const testOrder = testOrders[Math.floor(Math.random() * testOrders.length)];
    const createResponse = http.post(`${BASE_URL}/orders`, JSON.stringify(testOrder), { headers });
    
    const createOk = check(createResponse, {
      'create order status is 201': (r) => r.status === 201,
      'create order response time < 1000ms': (r) => r.timings.duration < 1000,
      'create order returns order ID': (r) => JSON.parse(r.body).id !== undefined,
    });
    
    if (!createOk) {
      errorRate.add(1);
    }
  }

  // Test 5: Get Stock Data
  const stockResponse = http.get(`${BASE_URL}/stock`, { headers });
  const stockOk = check(stockResponse, {
    'stock data status is 200': (r) => r.status === 200,
    'stock data response time < 400ms': (r) => r.timings.duration < 400,
    'stock data has products': (r) => JSON.parse(r.body).length > 0,
  });
  
  if (!stockOk) {
    errorRate.add(1);
  }

  // Test 6: Search Orders (20% probability)
  if (Math.random() < 0.2) {
    const searchResponse = http.get(`${BASE_URL}/orders?search=test&limit=20`, { headers });
    const searchOk = check(searchResponse, {
      'search orders status is 200': (r) => r.status === 200,
      'search orders response time < 500ms': (r) => r.timings.duration < 500,
    });
    
    if (!searchOk) {
      errorRate.add(1);
    }
  }

  sleep(1); // Wait 1 second between iterations
}

export function teardown(data) {
  console.log('🧹 Cleaning up performance test environment...');
  
  // Clean up test data if needed
  const cleanupResponse = http.del(`${BASE_URL}/test/cleanup`, null, {
    headers: { 'Authorization': `Bearer ${data.tokens[0]}` },
  });
  
  if (cleanupResponse.status === 200) {
    console.log('✅ Test data cleaned up successfully');
  } else {
    console.log('⚠️ Test data cleanup failed');
  }
}

export function handleSummary(data) {
  return {
    'Performance Test Summary': {
      'Total Requests': data.metrics.http_reqs.count,
      'Failed Requests': data.metrics.http_req_failed.count,
      'Request Rate (req/s)': data.metrics.http_reqs.rate,
      'Average Response Time (ms)': data.metrics.http_req_duration.avg,
      '95th Percentile Response Time (ms)': data.metrics.http_req_duration['p(95)'],
      '99th Percentile Response Time (ms)': data.metrics.http_req_duration['p(99)'],
      'Error Rate (%)': (data.metrics.http_req_failed.rate * 100).toFixed(2),
      'Custom Error Rate (%)': (errorRate.rate * 100).toFixed(2),
    },
    'Threshold Status': {
      'Response Time < 500ms (95%)': data.metrics.http_req_duration['p(95)'] < 500 ? 'PASS' : 'FAIL',
      'Error Rate < 10%': data.metrics.http_req_failed.rate < 0.1 ? 'PASS' : 'FAIL',
      'Custom Error Rate < 10%': errorRate.rate < 0.1 ? 'PASS' : 'FAIL',
    },
  };
}
