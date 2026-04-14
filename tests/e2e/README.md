# OptiPlan360 E2E Test Suite

Comprehensive end-to-end testing for OptiPlan360 using Playwright.

## 🚀 Quick Start

### Installation
```bash
cd tests/e2e
npm install
npm run test:e2e:install
```

### Running Tests
```bash
# Run all tests
npm run test:e2e

# Run tests with UI (recommended for development)
npm run test:e2e:ui

# Run tests in headed mode
npm run test:e2e:headed

# Debug tests
npm run test:e2e:debug

# Generate test code
npm run test:e2e:codegen
```

### Viewing Results
```bash
# View HTML report
npm run test:e2e:report

# View test traces
open test-results/*/trace.zip
```

## 📁 Test Structure

```
tests/e2e/
├── tests/
│   ├── optiplan360.spec.ts      # Core functionality tests
│   └── integration.spec.ts       # Integration and performance tests
├── utils/
│   └── optiplan-page.ts         # Page object model
├── fixtures/                   # Test data files
├── playwright.config.ts         # Playwright configuration
├── global-setup.ts            # Test environment setup
├── global-teardown.ts         # Test environment cleanup
└── package.json
```

## 🧪 Test Categories

### Core Functionality
- **Authentication**: Login, logout, session management
- **Dashboard**: Main dashboard functionality and metrics
- **Order Management**: CRUD operations, validation, filtering
- **Customer Management**: Customer creation, search, management
- **Stock Management**: Stock updates, inventory tracking
- **OCR Processing**: Document upload, processing, confidence validation
- **Export Functionality**: XLSX export, validation, error handling

### Integration Tests
- **Performance**: Load times, responsiveness, large data handling
- **Accessibility**: WCAG compliance, keyboard navigation, screen readers
- **Error Handling**: Network errors, server errors, timeouts
- **Responsive Design**: Mobile, tablet, desktop compatibility
- **Data Integrity**: Duplicate prevention, validation, data consistency

## 🔧 Configuration

### Environment Variables
```bash
BASE_URL=http://localhost:5173          # Frontend URL
TEST_API_URL=http://localhost:8080       # Backend API URL
CI=true                                 # CI/CD mode
DEBUG=true                              # Debug mode
```

### Playwright Config
- **Browsers**: Chromium, Firefox, WebKit
- **Devices**: Desktop, Mobile, Tablet
- **Timeouts**: 30s test, 5s expect, 10s action
- **Reporting**: HTML, JSON, JUnit
- **Tracing**: On first retry
- **Screenshots**: On failure
- **Video**: Retain on failure

## 📊 Test Data

### Fixtures
- `test-order.pdf`: Sample order document
- `low-quality.pdf`: Low quality document for testing confidence validation

### Test Users
- `testadmin`: Admin user with full permissions
- `testuser`: Regular user with limited permissions

### Test Data
- Test customers, products, orders created via API
- Automatically cleaned up after tests

## 🎯 Test Scenarios

### Happy Path Tests
1. **User Authentication**
   - Valid login → Dashboard
   - Logout → Login page
   - Session persistence

2. **Order Creation Flow**
   - Navigate to Orders → New Order
   - Fill valid form → Success
   - Order appears in list

3. **OCR Processing**
   - Upload document → Processing
   - High confidence → Auto-approval
   - Low confidence → Operator review

### Edge Case Tests
1. **Validation Errors**
   - Empty forms → Error messages
   - Invalid formats → Validation
   - Required fields → Errors

2. **Network Issues**
   - Connection loss → Error handling
   - Timeout → Graceful degradation
   - Server errors → User feedback

3. **Performance Scenarios**
   - Large data sets → Pagination
   - Slow connections → Loading states
   - Concurrent users → No conflicts

## 📈 Performance Benchmarks

### Load Time Targets
- Dashboard: < 3 seconds
- Order list: < 5 seconds
- Form submission: < 2 seconds
- File upload: < 10 seconds

### Accessibility Standards
- WCAG 2.1 AA compliance
- Keyboard navigation support
- Screen reader compatibility
- Color contrast ratios > 4.5:1

## 🐛 Debugging

### Debug Mode
```bash
npm run test:e2e:debug
```
- Runs tests with visible browser
- Pauses on failures
- Enables browser dev tools

### Test Traces
- Automatically captured on failures
- Includes network requests, console logs, screenshots
- View with Playwright trace viewer

### Screenshots & Videos
- Captured on test failures
- Stored in `test-results/`
- Include in CI/CD artifacts

## 🔄 CI/CD Integration

### GitHub Actions
```yaml
- name: Run E2E Tests
  run: |
    cd tests/e2e
    npm ci
    npm run test:e2e:install
    npm run test:e2e
```

### Docker Support
```bash
docker run -it --rm \
  -v $(pwd):/work \
  -w /work \
  mcr.microsoft.com/playwright:v1.40.0 \
  npm run test:e2e
```

## 📝 Best Practices

### Test Writing
1. **Use Page Object Model**: Centralize element locators and actions
2. **Data-Driven Tests**: Use fixtures for test data
3. **Independent Tests**: Each test should work in isolation
4. **Clear Assertions**: Use descriptive expect statements
5. **Error Scenarios**: Test both success and failure cases

### Maintenance
1. **Regular Updates**: Keep Playwright and browsers updated
2. **Test Review**: Remove flaky tests, update broken ones
3. **Coverage Reports**: Track test coverage metrics
4. **Performance Monitoring**: Watch for performance regressions

## 🚨 Troubleshooting

### Common Issues
1. **Timeout Errors**: Increase timeout values or check network
2. **Element Not Found**: Update selectors or wait for elements
3. **Flaky Tests**: Add proper waits or fix race conditions
4. **Browser Issues**: Update browsers or clear cache

### Debug Commands
```bash
# Run specific test
npm run test:e2e -- tests/optiplan360.spec.ts

# Run with specific browser
npm run test:e2e -- --project=chromium

# Run with grep filter
npm run test:e2e -- --grep="Authentication"
```

## 📚 Resources

- [Playwright Documentation](https://playwright.dev/)
- [Page Object Model Guide](https://playwright.dev/docs/pom)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Test Reporting](https://playwright.dev/docs/test-reporters)
