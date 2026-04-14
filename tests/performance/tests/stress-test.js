import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const cpuUsage = new Rate('cpu_usage');
const memoryUsage = new Rate('memory_usage');

// Stress test configuration - extreme load
export const options = {
  stages: [
    { duration: '1m', target: 50 },    // Initial load
    { duration: '2m', target: 100 },   // Ramp up
    { duration: '3m', target: 200 },   // High load
    { duration: '2m', target: 300 },   // Peak load
    { duration: '3m', target: 400 },   // Stress point
    { duration: '2m', target: 500 },   // Maximum stress
    { duration: '3m', target: 400 },   // Sustain stress
    { duration: '2m', target: 200 },   // Ramp down
    { duration: '2m', target: 0 },     // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // More lenient for stress
    http_req_failed: ['rate<0.2'],     // Allow higher error rate
    errors: ['rate<0.2'],
    cpu_usage: ['rate<0.8'],           // CPU usage under 80%
    memory_usage: ['rate<0.8'],        // Memory usage under 80%
  },
};

const BASE_URL = 'http://localhost:8080/api/v1';

// Stress test scenarios
const stressScenarios = [
  {
    name: 'order_creation_burst',
    weight: 40,
    execute: (token) => {
      const orderData = {
        customer_id: Math.floor(Math.random() * 100) + 1,
        product_id: Math.floor(Math.random() * 50) + 1,
        quantity: Math.floor(Math.random() * 500) + 50,
        thickness: Math.floor(Math.random() * 30) + 10,
      };
      
      const response = http.post(`${BASE_URL}/orders`, JSON.stringify(orderData), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      check(response, {
        'stress order creation status': (r) => r.status < 500, // Accept 4xx as valid stress response
        'stress order creation time < 2000ms': (r) => r.timings.duration < 2000,
      });
      
      if (response.status >= 500) {
        errorRate.add(1);
      }
      
      return response;
    },
  },
  {
    name: 'concurrent_reads',
    weight: 30,
    execute: (token) => {
      const endpoints = [
        `${BASE_URL}/orders?limit=100`,
        `${BASE_URL}/customers?limit=100`,
        `${BASE_URL}/stock`,
        `${BASE_URL}/products`,
      ];
      
      const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
      const response = http.get(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      check(response, {
        'stress read status': (r) => r.status < 500,
        'stress read time < 1500ms': (r) => r.timings.duration < 1500,
      });
      
      if (response.status >= 500) {
        errorRate.add(1);
      }
      
      return response;
    },
  },
  {
    name: 'file_upload_stress',
    weight: 20,
    execute: (token) => {
      // Simulate OCR upload stress
      const formData = {
        file: http.file('tests/fixtures/test-order.pdf', 'test-order.pdf'),
      };
      
      const response = http.post(`${BASE_URL}/ocr/upload`, formData, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      check(response, {
        'stress upload status': (r) => r.status < 500,
        'stress upload time < 5000ms': (r) => r.timings.duration < 5000,
      });
      
      if (response.status >= 500) {
        errorRate.add(1);
      }
      
      return response;
    },
  },
  {
    name: 'export_operations',
    weight: 10,
    execute: (token) => {
      const exportData = {
        format: 'xlsx',
        filters: { status: 'pending', date_range: '30d' },
      };
      
      const response = http.post(`${BASE_URL}/export`, JSON.stringify(exportData), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      check(response, {
        'stress export status': (r) => r.status < 500,
        'stress export time < 3000ms': (r) => r.timings.duration < 3000,
      });
      
      if (response.status >= 500) {
        errorRate.add(1);
      }
      
      return response;
    },
  },
];

export function setup() {
  console.log('🔥 Setting up stress test environment...');
  
  // Create stress test user
  const stressUser = {
    username: `stresstest_${Date.now()}`,
    password: 'StressTest123!',
    email: `stress@test.com`,
  };
  
  const registerResponse = http.post(`${BASE_URL}/auth/register`, JSON.stringify(stressUser), {
    headers: { 'Content-Type': 'application/json' },
  });
  
  if (registerResponse.status === 201) {
    // Login to get token
    const loginResponse = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
      username: stressUser.username,
      password: stressUser.password,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (loginResponse.status === 200) {
      const token = JSON.parse(loginResponse.body).access_token;
      console.log('✅ Stress test user created and authenticated');
      return { token, userId: stressUser.username };
    }
  }
  
  throw new Error('Failed to setup stress test user');
}

export default function(data) {
  const headers = {
    'Authorization': `Bearer ${data.token}`,
    'Content-Type': 'application/json',
  };

  // System health check
  const healthResponse = http.get(`${BASE_URL}/health`, { headers });
  if (healthResponse.status !== 200) {
    console.log('❌ System health check failed during stress test');
    errorRate.add(1);
  }

  // Execute random stress scenarios based on weights
  const random = Math.random() * 100;
  let cumulativeWeight = 0;
  
  for (const scenario of stressScenarios) {
    cumulativeWeight += scenario.weight;
    if (random <= cumulativeWeight) {
      scenario.execute(data.token);
      break;
    }
  }

  // Monitor system resources (simplified)
  if (Math.random() < 0.1) { // 10% of iterations
    const metricsResponse = http.get(`${BASE_URL}/metrics`, { headers });
    if (metricsResponse.status === 200) {
      const metrics = JSON.parse(metricsResponse.body);
      
      // Simulate resource monitoring
      if (metrics.cpu_usage > 80) {
        cpuUsage.add(1);
      }
      
      if (metrics.memory_usage > 80) {
        memoryUsage.add(1);
      }
    }
  }

  sleep(0.1); // Very short sleep for high frequency
}

export function teardown(data) {
  console.log('🧹 Cleaning up stress test environment...');
  
  // Clean up stress test user and data
  const cleanupResponse = http.del(`${BASE_URL}/test/stress-cleanup`, JSON.stringify({
    userId: data.userId,
  }), {
    headers: {
      'Authorization': `Bearer ${data.token}`,
      'Content-Type': 'application/json',
    },
  });
  
  if (cleanupResponse.status === 200) {
    console.log('✅ Stress test cleanup completed');
  } else {
    console.log('⚠️ Stress test cleanup failed');
  }
}

export function handleSummary(data) {
  return {
    'Stress Test Summary': {
      'Total Requests': data.metrics.http_reqs.count,
      'Failed Requests': data.metrics.http_req_failed.count,
      'Peak Request Rate (req/s)': data.metrics.http_reqs.rate,
      'Average Response Time (ms)': data.metrics.http_req_duration.avg,
      '95th Percentile Response Time (ms)': data.metrics.http_req_duration['p(95)'],
      '99th Percentile Response Time (ms)': data.metrics.http_req_duration['p(99)'],
      'Error Rate (%)': (data.metrics.http_req_failed.rate * 100).toFixed(2),
      'CPU Usage Over 80% (%)': (cpuUsage.rate * 100).toFixed(2),
      'Memory Usage Over 80% (%)': (memoryUsage.rate * 100).toFixed(2),
    },
    'Stress Test Results': {
      'System Stability': data.metrics.http_req_failed.rate < 0.2 ? 'STABLE' : 'UNSTABLE',
      'Performance Degradation': data.metrics.http_req_duration['p(95)'] > 1000 ? 'SIGNIFICANT' : 'MINIMAL',
      'Resource Utilization': cpuUsage.rate > 0.8 || memoryUsage.rate > 0.8 ? 'HIGH' : 'NORMAL',
    },
  };
}
