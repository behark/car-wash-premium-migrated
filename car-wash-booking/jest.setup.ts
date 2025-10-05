/**
 * Jest Setup Configuration
 * Enterprise-grade testing environment setup
 */

import '@testing-library/jest-dom';
import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';

// Load test environment variables
config({ path: '.env.test' });

// Mock Prisma for unit tests
jest.mock('./src/lib/prisma', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter() {
    return {
      route: '/',
      pathname: '/',
      query: '',
      asPath: '/',
      push: jest.fn(),
      pop: jest.fn(),
      reload: jest.fn(),
      back: jest.fn(),
      prefetch: jest.fn().mockResolvedValue(undefined),
      beforePopState: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      },
      isFallback: false,
    };
  },
}));

// Mock Next.js navigation (App Router)
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      refresh: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      prefetch: jest.fn(),
    };
  },
  useSearchParams() {
    return new URLSearchParams();
  },
  usePathname() {
    return '/';
  },
}));

// Mock environment variables for tests
(process.env as any).NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.NEXTAUTH_SECRET = 'test-secret-key-for-testing-purposes-only';
process.env.NEXTAUTH_URL = 'http://localhost:3000';
process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';

// Global test utilities
declare global {
  var __MOCK_PRISMA__: DeepMockProxy<PrismaClient>;
}

// Make mock Prisma available globally for tests
global.__MOCK_PRISMA__ = mockDeep<PrismaClient>();

// Reset all mocks before each test
beforeEach(() => {
  mockReset(global.__MOCK_PRISMA__);
});

// Global test setup
beforeAll(async () => {
  // Suppress console logs in tests unless explicitly enabled
  if (!process.env.ENABLE_TEST_LOGS) {
    console.log = jest.fn();
    console.info = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  }
});

// Global test cleanup
afterAll(async () => {
  // Clean up any test resources
  await new Promise(resolve => setTimeout(resolve, 100));
});

// Custom matchers for better test assertions
expect.extend({
  toBeValidDate(received: any) {
    const pass = received instanceof Date && !isNaN(received.getTime());
    if (pass) {
      return {
        message: () => `Expected ${received} not to be a valid date`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected ${received} to be a valid date`,
        pass: false,
      };
    }
  },

  toBeValidEmail(received: string) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pass = typeof received === 'string' && emailRegex.test(received);
    if (pass) {
      return {
        message: () => `Expected ${received} not to be a valid email`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected ${received} to be a valid email`,
        pass: false,
      };
    }
  },

  toHaveValidationError(received: any, field: string) {
    const pass = received?.errors?.some((error: any) =>
      error.path.includes(field)
    );
    if (pass) {
      return {
        message: () => `Expected validation errors not to include field ${field}`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected validation errors to include field ${field}`,
        pass: false,
      };
    }
  },
});

// Extend Jest matchers type definitions
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidDate(): R;
      toBeValidEmail(): R;
      toHaveValidationError(field: string): R;
    }
  }
}