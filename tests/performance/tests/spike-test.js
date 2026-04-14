import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const responseTimeP95 = new Rate('response_time_p95');

// Spike test configuration - sudden load spikes
export const options = {
  stages: [
    { duration: '2m', target: 10 },   // Baseline
    { duration: '30s', target: 500 }, // Spike 1
    { duration: '2m', target: 10 },   // Recovery
    { duration: '30s', target: 800 }, // Spike 2 (higher)
    { duration: '2m', target: 10 },   // Recovery
    { duration: '30s', target: 1000 }, // Spike 3 (maximum)
    { duration: '3m', target: 10 },   // Extended recovery
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // Very lenient for spikes
    http_req_failed: ['rate<0.3'],     // Allow higher error during spikes
    errors: ['rate<0.3'],
  },
};

const BASE_URL = 'http://localhost:8080/api/v1';

// Spike test scenarios - focus on critical paths
const spikeScenarios = [
  {
    name: 'dashboard_load',
    execute: (token) => {
      const response = http.get(`${BASE_URL}/dashboard/metrics`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      check(response, {
        'dashboard spike status': (r) => r.status < 500,
        'dashboard spike time < 3000ms': (r) => r.timings.duration < 3000,
      });
      
      if (response.status >= 500) {
        errorRate.add(1);
      }
      
      return response;
    },
  },
  {
    name: 'order_list_burst',
    execute: (token) => {
      const response = http.get(`${BASE_URL}/orders?limit=200&sort=created_at:desc`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      check(response, {
        'order list spike status': (r) => r.status < 500,
        'order list spike time < 2500ms': (r) => r.timings.duration < 2500,
      });
      
      if (response.status >= 500) {
        errorRate.add(1);
      }
      
      return response;
    },
  },
  {
    name: 'search_operations',
    execute: (token) => {
      const searchTerms = ['test', 'order', 'customer', 'product'];
      const term = searchTerms[Math.floor(Math.random() * searchTerms.length)];
      
      const response = http.get(`${BASE_URL}/search?q=${term}&limit=100`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      check(response, {
        'search spike status': (r) => r.status < 500,
        'search spike time < 2000ms': (r) => r.timings.duration < 2000,
      });
      
      if (response.status >= 500) {
        errorRate.add(1);
      }
      
      return response;
    },
  },
  {
    name: 'api_health',
    execute: (token) => {
      const response = http.get(`${BASE_URL}/health/detailed`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      check(response, {
        'health spike status': (r) => r.status < 500,
        'health spike time < 100ms': (r) => r.timings.duration < 100,
      });
      
      if (response.status >= 500) {
        errorRate.add(1);
      }
      
      return response;
    },
  },
];

export function setup() {
  console.log('⚡ Setting up spike test environment...');
  
  // Create spike test users
  const spikeUsers = [];
  for (let i = 0; i < 5; i++) {
    const userData = {
      username: `spikeuser_${i}_${Date.now()}`,
      password: 'SpikeTest123!',
      email: `spike${i}@test.com`,
    };
    
    const registerResponse = http.post(`${BASE_URL}/auth/register`, JSON.stringify(userData), {
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (registerResponse.status === 201) {
      const loginResponse = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
        username: userData.username,
        password: userData.password,
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (loginResponse.status === 200) {
        spikeUsers.push(JSON.parse(loginResponse.body).access_token);
      }
    }
  }
  
  if (spikeUsers.length === 0) {
    throw new Error('Failed to create spike test users');
  }
  
  console.log(`✅ Created ${spikeUsers.length} spike test users`);
  return { tokens: spikeUsers };
}

export default function(data) {
  const token = data.tokens[Math.floor(Math.random() * data.tokens.length)];
  
  // Execute spike scenarios rapidly during spike phases
  for (let i = 0; i < 3; i++) { // Multiple requests per iteration
    const scenario = spikeScenarios[Math.floor(Math.random() * spikeScenarios.length)];
    scenario.execute(token);
  }
  
  sleep(0.05); // Very short sleep for maximum load
}

export function teardown(data) {
  console.log('🧹 Cleaning up spike test environment...');
  
  // Clean up spike test users
  for (const token of data.tokens) {
    const cleanupResponse = http.del(`${BASE_URL}/test/spike-cleanup`, null, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
  }
  
  console.log('✅ Spike test cleanup completed');
}

export function handleSummary(data) {
  // Analyze spike recovery patterns
  const stages = [
    { name: 'Baseline 1', start: 0, end: 120 },
    { name: 'Spike 1', start: 120, end: 150 },
    { name: 'Recovery 1', start: 150, end: 270 },
    { name: 'Spike 2', start: 270, end: 300 },
    { name: 'Recovery 2', start: 300, end: 420 },
    { name: 'Spike 3', start: 420, end: 450 },
    { name: 'Recovery 3', start: 450, end: 630 },
  ];
  
  return {
    'Spike Test Summary': {
      'Total Requests': data.metrics.http_reqs.count,
      'Failed Requests': data.metrics.http_req_failed.count,
      'Peak Request Rate (req/s)': data.metrics.http_reqs.rate,
      'Average Response Time (ms)': data.metrics.http_req_duration.avg,
      '95th Percentile Response Time (ms)': data.metrics.http_req_duration['p(95)'],
      '99th Percentile Response Time (ms)': data.metrics.http_req_duration['p(99)'],
      'Error Rate (%)': (data.metrics.http_req_failed.rate * 100).toFixed(2),
    },
    'Spike Analysis': {
      'System Resilience': data.metrics.http_req_failed.rate < 0.3 ? 'RESILIENT' : 'FRAGILE',
      'Recovery Capability': 'ANALYZE_PER_STAGE', // Would need detailed stage analysis
      'Peak Load Handling': data.metrics.http_reqs.rate > 100 ? 'EXCELLENT' : 'NEEDS_IMPROVEMENT',
    },
    'Recommendations': {
      'Error Rate': data.metrics.http_req_failed.rate > 0.1 ? 'Implement rate limiting' : 'Within acceptable range',
      'Response Time': data.metrics.http_req_duration['p(95)'] > 2000 ? 'Optimize database queries' : 'Performance acceptable',
      'System Load': 'Monitor CPU and memory during spikes',
    },
  };
}
