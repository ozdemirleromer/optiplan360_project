# OptiPlan360 Performance and Load Testing Suite

Comprehensive performance testing for OptiPlan360 using k6 and Artillery.

## 🚀 Quick Start

### Installation
```bash
cd tests/performance
npm install
```

### Running Tests
```bash
# Load test (gradual ramp-up)
npm run test:load

# Stress test (extreme load)
npm run test:stress

# Spike test (sudden load bursts)
npm run test:spike

# Soak test (sustained load)
npm run test:soak

# Artillery load test
npm run test:artillery

# Run all performance tests
npm run test:performance
```

### Generating Reports
```bash
# HTML report
npm run report:html

# JSON report
npm run report:json
```

## 📊 Test Types

### Load Testing
- **Purpose**: Normal load patterns
- **Duration**: 16 minutes
- **Users**: 10 → 50 → 100 → 50 → 0
- **Focus**: API performance under normal usage

### Stress Testing
- **Purpose**: System breaking point
- **Duration**: 17 minutes
- **Users**: 50 → 100 → 200 → 300 → 400 → 500
- **Focus**: Maximum capacity and failure modes

### Spike Testing
- **Purpose**: Sudden load bursts
- **Duration**: 10.5 minutes
- **Users**: 10 → 500 → 10 → 800 → 10 → 1000 → 10
- **Focus**: System resilience and recovery

### Soak Testing
- **Purpose**: Long-term stability
- **Duration**: 4+ hours
- **Users**: Sustained moderate load
- **Focus**: Memory leaks, performance degradation

## 🎯 Test Scenarios

### API Endpoints Tested
1. **Authentication**: Login, user management
2. **Order Management**: CRUD operations, filtering
3. **Customer Management**: Search, creation, updates
4. **Stock Management**: Inventory operations
5. **Export Operations**: XLSX generation
6. **Health Checks**: System monitoring

### Performance Metrics
- **Response Time**: Average, P95, P99
- **Throughput**: Requests per second
- **Error Rate**: Failed requests percentage
- **Resource Usage**: CPU, memory consumption
- **System Stability**: Uptime, recovery time

## 📈 Performance Benchmarks

### Response Time Targets
- **P95**: < 500ms (normal), < 1000ms (stress), < 2000ms (spike)
- **P99**: < 1000ms (normal), < 2000ms (stress), < 3000ms (spike)
- **Average**: < 200ms (normal), < 500ms (stress)

### Error Rate Targets
- **Normal Load**: < 1%
- **Stress Load**: < 10%
- **Spike Load**: < 20%

### Throughput Targets
- **API**: 100+ req/s
- **Peak**: 500+ req/s
- **Maximum**: 1000+ req/s

## 🔧 Configuration

### Environment Variables
```bash
K6_PROMETHEUS_RW_SERVER_URL=http://localhost:9090/api/v1/write
K6_CLOUD_TOKEN=your_k6_cloud_token
ARTILLERY_TOKEN=your_artillery_token
```

### k6 Configuration
```javascript
export const options = {
  stages: [
    { duration: '2m', target: 10 },
    { duration: '5m', target: 50 },
    // ... more stages
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.1'],
  },
};
```

### Artillery Configuration
```yaml
config:
  target: 'http://localhost:8080'
  phases:
    - duration: 60
      arrivalRate: 5
```

## 📊 Custom Metrics

### k6 Metrics
```javascript
const errorRate = new Rate('errors');
const cpuUsage = new Rate('cpu_usage');
const memoryUsage = new Rate('memory_usage');
```

### Artillery Metrics
- Response time percentiles
- Request throughput
- Error rates by endpoint
- Custom business metrics

## 🎯 Test Scenarios Details

### Load Test Scenarios
1. **API Health Check** (10% weight)
   - GET /api/v1/health
   - Verify system availability

2. **Order Operations** (40% weight)
   - GET /api/v1/orders
   - POST /api/v1/orders
   - Search and filtering

3. **Customer Operations** (30% weight)
   - GET /api/v1/customers
   - Customer search
   - Data retrieval

4. **Stock Operations** (20% weight)
   - GET /api/v1/stock
   - Inventory checks
   - Stock updates

### Stress Test Scenarios
1. **Order Creation Burst** (40% weight)
   - High-frequency order creation
   - Database write stress

2. **Concurrent Reads** (30% weight)
   - Multiple endpoint access
   - Database read stress

3. **File Upload Stress** (20% weight)
   - OCR document uploads
   - File system stress

4. **Export Operations** (10% weight)
   - XLSX generation
   - CPU intensive operations

### Spike Test Scenarios
1. **Dashboard Load** - Metrics endpoint stress
2. **Order List Burst** - Large dataset queries
3. **Search Operations** - Text search stress
4. **API Health** - System monitoring under load

## 📈 Performance Analysis

### Response Time Analysis
- **P50**: Median response time
- **P95**: 95th percentile (95% of requests faster)
- **P99**: 99th percentile (99% of requests faster)

### Throughput Analysis
- **RPS**: Requests per second
- **Peak RPS**: Maximum throughput achieved
- **Sustained RPS**: Long-term throughput

### Error Analysis
- **HTTP Errors**: 4xx, 5xx responses
- **Timeout Errors**: Request timeouts
- **System Errors**: Application-level failures

## 🔍 Monitoring and Alerting

### Real-time Monitoring
```bash
# k6 with Prometheus output
k6 run --out prometheus=http://localhost:9090/api/v1/write load-test.js
```

### Grafana Dashboard
- Response time metrics
- Error rate alerts
- Throughput monitoring
- Resource usage tracking

### Alert Thresholds
- Response time > 1000ms (P95)
- Error rate > 5%
- CPU usage > 80%
- Memory usage > 80%

## 🐛 Troubleshooting

### Common Performance Issues
1. **Database Bottlenecks**
   - Slow queries
   - Connection pool exhaustion
   - Index optimization needed

2. **Memory Leaks**
   - Long-running processes
   - Garbage collection issues
   - Resource not released

3. **Network Issues**
   - Connection timeouts
   - Bandwidth limitations
   - DNS resolution delays

### Debug Commands
```bash
# Run specific test with debug
k6 run --vdebug stress-test.js

# Generate detailed report
k6 run --out json=report.json load-test.js

# Run with custom thresholds
k6 run --thresholds 'http_req_duration["p(95)"]<1000' load-test.js
```

## 📝 Best Practices

### Test Design
1. **Realistic Scenarios**: Mirror actual usage patterns
2. **Gradual Ramp-up**: Avoid shocking the system
3. **Sufficient Duration**: Test long-term stability
4. **Multiple Metrics**: Monitor various performance aspects

### Environment Setup
1. **Isolated Testing**: Dedicated test environment
2. **Consistent Configuration**: Same as production
3. **Monitoring Enabled**: Track system resources
4. **Data Preparation**: Sufficient test data

### Analysis
1. **Baseline Establishment**: Know normal performance
2. **Trend Analysis**: Track performance over time
3. **Bottleneck Identification**: Find limiting factors
4. **Capacity Planning**: Determine system limits

## 🔄 CI/CD Integration

### GitHub Actions
```yaml
- name: Performance Tests
  run: |
    cd tests/performance
    npm ci
    npm run test:load
    npm run test:stress
```

### Performance Gates
- Block deployment if P95 > 1000ms
- Block deployment if error rate > 5%
- Alert on performance degradation > 20%

## 📚 Resources

- [k6 Documentation](https://k6.io/docs/)
- [Artillery Documentation](https://artillery.io/docs/)
- [Performance Testing Best Practices](https://k6.io/docs/testing-guides/test-types/)
- [Load Testing Strategies](https://artillery.io/docs/guides/overview/)
