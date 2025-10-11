# Car Wash Booking System - Testing Guide

This comprehensive testing suite ensures the reliability and quality of the car wash booking system.

## 🧪 Test Structure

```
├── __tests__/
│   └── integration/
│       └── booking-flow.test.tsx     # End-to-end booking workflow
├── src/
│   ├── components/
│   │   └── __tests__/
│   │       ├── RealTimeBooking.test.tsx
│   │       └── ServicesGrid.test.tsx
│   └── app/api/
│       └── health/
│           └── __tests__/
│               └── route.test.ts
└── jest.config.js                   # Jest configuration
└── jest.setup.ts                    # Test setup and globals
```

## 🎯 Test Categories

### Unit Tests
- **Component Tests**: Individual React components in isolation
- **API Route Tests**: Backend endpoints and business logic
- **Utility Function Tests**: Helper functions and validation logic

### Integration Tests
- **Booking Flow**: Complete user journey from service selection to confirmation
- **Real-time Features**: WebSocket connections and live updates
- **Payment Processing**: End-to-end payment workflows

### Performance Tests
- **Load Testing**: API endpoints under stress
- **Memory Testing**: Component memory leaks
- **Rendering Performance**: Large dataset rendering

## 🚀 Available Test Scripts

### Basic Testing
```bash
# Run all tests
npm test

# Watch mode for development
npm run test:watch

# Generate coverage report
npm run test:coverage

# CI/CD optimized run
npm run test:ci
```

### Specific Test Categories
```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Component tests only
npm run test:components

# API tests only
npm run test:api

# All tests (unit + integration)
npm run test:all
```

### Individual Test Files
```bash
# Booking flow integration
npm run test:booking-flow

# Real-time booking component
npm run test:real-time

# Services grid component
npm run test:services

# Health API endpoint
npm run test:health
```

### Development & Debugging
```bash
# Debug mode with Node inspector
npm run test:debug

# Update snapshots
npm run test:update-snapshots

# Silent output
npm run test:silent

# Verbose output
npm run test:verbose

# Stop on first failure
npm run test:bail
```

## 📋 Test Coverage

### Components Tested

#### RealTimeBooking Component
- ✅ WebSocket connection management
- ✅ Real-time availability updates
- ✅ Time slot selection and booking holds
- ✅ Conflict detection and error handling
- ✅ Connection status indicators
- ✅ Mobile touch interactions

#### ServicesGrid Component
- ✅ Service card rendering
- ✅ Pricing display and formatting
- ✅ Image handling and fallbacks
- ✅ Luxury service badges
- ✅ Responsive grid layout
- ✅ Animation staggering

#### API Routes
- ✅ Health check endpoint
- ✅ Database connectivity testing
- ✅ Memory usage reporting
- ✅ Error handling and status codes
- ✅ Performance monitoring

### Integration Scenarios
- ✅ Complete booking workflow (6 steps)
- ✅ Form validation and error states
- ✅ Payment processing simulation
- ✅ Data persistence between steps
- ✅ Navigation and back/forward flow
- ✅ Responsive design testing

## 🛠 Test Configuration

### Jest Configuration
The project uses a comprehensive Jest setup with:
- **TypeScript Support**: Full TS/TSX compilation
- **Module Mapping**: Path aliases from tsconfig.json
- **Coverage Thresholds**: 80% minimum across metrics
- **Environment**: jsdom for React component testing
- **Mocking**: Automatic mocking for Next.js components

### Key Features
- **Next.js Integration**: Proper handling of Next.js components and routing
- **Real-time Testing**: WebSocket mocking and event simulation
- **Async Testing**: Proper handling of async operations and timers
- **Accessibility Testing**: Focus management and screen reader compatibility
- **Performance Testing**: Memory usage and rendering performance

## 🧩 Mock Strategy

### External Dependencies
```javascript
// WebSocket connections
jest.mock('socket.io-client')

// Next.js components
jest.mock('next/link')
jest.mock('next/image')
jest.mock('next/router')

// Database connections
jest.mock('@/lib/prisma-simple')

// Payment processing
jest.mock('stripe')
```

### Test Data
- **Mock Services**: Realistic car wash service data
- **Test Users**: Various customer profiles
- **Payment Scenarios**: Success, failure, and edge cases
- **Time Slots**: Different availability patterns

## 📊 Coverage Reports

Coverage reports are generated in multiple formats:
- **Terminal Output**: Real-time feedback during development
- **HTML Report**: Detailed coverage browser interface
- **LCOV Format**: CI/CD integration
- **JSON Summary**: Programmatic access to metrics

### Coverage Thresholds
- **Branches**: 80%
- **Functions**: 80%
- **Lines**: 80%
- **Statements**: 80%

## 🔍 Testing Best Practices

### Component Testing
```typescript
// Test user interactions, not implementation
await user.click(screen.getByRole('button', { name: /book now/i }))

// Use semantic queries
screen.getByLabelText('Service selection')
screen.getByRole('combobox', { name: /time slot/i })

// Test accessibility
expect(screen.getByText('Loading...')).toBeInTheDocument()
```

### API Testing
```typescript
// Test both success and error scenarios
expect(response.status).toBe(200)
expect(data).toHaveProperty('status', 'healthy')

// Verify error handling
mockPrisma.$queryRaw.mockRejectedValue(new Error('DB Error'))
expect(response.status).toBe(503)
```

### Integration Testing
```typescript
// Test complete user workflows
const user = userEvent.setup()
await user.click(screen.getByTestId('service-1'))
await user.type(screen.getByTestId('date-input'), '2024-12-25')
await user.click(screen.getByTestId('continue-button'))
```

## 🚨 Common Test Scenarios

### Error Handling
- Network connection failures
- Database timeout errors
- Payment processing failures
- Invalid form data submission
- Session expiration

### Edge Cases
- Very long service descriptions
- Missing images or data
- Concurrent booking attempts
- Browser compatibility issues
- Mobile device interactions

### Performance Scenarios
- Large service catalogs
- Multiple simultaneous users
- Memory leak detection
- Rendering optimization
- Bundle size validation

## 🔧 Debugging Tests

### Debug Mode
```bash
npm run test:debug
```

### VS Code Integration
Add to `.vscode/launch.json`:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Jest Tests",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand"],
  "console": "integratedTerminal"
}
```

### Common Debug Scenarios
- **Test Timeouts**: Increase timeout for async operations
- **Mock Issues**: Verify mock implementations
- **State Persistence**: Check component state between interactions
- **Event Handling**: Ensure proper event simulation

## 📈 Continuous Integration

### CI/CD Pipeline
```bash
# Production testing command
npm run test:ci
```

### Quality Gates
- All tests must pass
- Coverage thresholds must be met
- No security vulnerabilities
- Performance benchmarks satisfied

### Automated Testing
- **Pre-commit Hooks**: Run tests before commits
- **Pull Request Validation**: Full test suite execution
- **Deployment Gates**: Production readiness checks

## 🎨 Test Data Management

### Realistic Test Data
- Finnish service names and descriptions
- European pricing (EUR) and formatting
- Realistic time slots and availability
- Common car makes/models
- Valid payment card formats

### Data Fixtures
```typescript
const mockBookingData = {
  service: { id: 1, titleFi: 'Peruspesu', priceCents: 1500 },
  customer: { firstName: 'Matti', lastName: 'Virtanen' },
  vehicle: { make: 'Volvo', model: 'V70', year: 2018 }
}
```

## 🌐 Localization Testing

### Finnish Language Support
- Service names and descriptions in Finnish
- Date/time formatting for Finnish locale
- Currency formatting (EUR)
- Error messages in Finnish
- Form validation text

### Accessibility
- Screen reader compatibility
- Keyboard navigation
- High contrast support
- Mobile accessibility
- WCAG 2.1 AA compliance

## 🔒 Security Testing

### Input Validation
- SQL injection prevention
- XSS attack protection
- CSRF token validation
- Rate limiting verification
- Data sanitization

### Authentication & Authorization
- Session management
- Role-based access control
- API endpoint protection
- Payment data security
- PCI compliance testing

## 📱 Mobile Testing

### Responsive Design
- Touch interactions
- Swipe gestures
- Mobile form validation
- Viewport adaptations
- Performance on mobile devices

### PWA Features
- Offline functionality
- Push notifications
- Service worker testing
- App installation
- Cache management

This comprehensive testing suite ensures the car wash booking system is reliable, performant, and user-friendly across all scenarios and devices.