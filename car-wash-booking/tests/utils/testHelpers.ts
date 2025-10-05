/**
 * Test Helper Utilities
 * Comprehensive testing utilities for enterprise-grade tests
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { createMocks } from 'node-mocks-http';
import { PrismaClient } from '@prisma/client';
import { mockDeep } from 'jest-mock-extended';

/**
 * API Testing Utilities
 */
export const ApiTestUtils = {
  /**
   * Create mock Next.js API request/response objects
   */
  createMockApiContext(options: {
    method?: string;
    query?: Record<string, any>;
    body?: any;
    headers?: Record<string, string>;
    cookies?: Record<string, string>;
  } = {}) {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: options.method || 'GET',
      query: options.query || {},
      body: options.body || {},
      headers: options.headers || {},
      cookies: options.cookies || {},
    });

    return { req, res };
  },

  /**
   * Execute API handler and return response data
   */
  async executeApiHandler(
    handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>,
    options: Parameters<typeof ApiTestUtils.createMockApiContext>[0] = {}
  ) {
    const { req, res } = this.createMockApiContext(options);

    await handler(req, res);

    return {
      status: res._getStatusCode(),
      data: res._isJSON() ? res._getJSONData() : res._getData(),
      headers: res.getHeaders(),
    };
  },

  /**
   * Create authenticated request context
   */
  createAuthenticatedContext(
    user: { id: number; email: string; role?: string },
    options: Parameters<typeof ApiTestUtils.createMockApiContext>[0] = {}
  ) {
    const token = Buffer.from(JSON.stringify(user)).toString('base64');

    return this.createMockApiContext({
      ...options,
      headers: {
        ...options.headers,
        authorization: `Bearer ${token}`,
        cookie: `next-auth.session-token=${token}`,
      },
    });
  },
};

/**
 * Database Testing Utilities
 */
export const DatabaseTestUtils = {
  /**
   * Get mocked Prisma client
   */
  getMockPrisma(): ReturnType<typeof mockDeep<PrismaClient>> {
    return global.__MOCK_PRISMA__;
  },

  /**
   * Setup common Prisma mock responses
   */
  setupMockResponses(mockPrisma: ReturnType<typeof mockDeep<PrismaClient>>) {
    // Mock common queries with realistic responses
    mockPrisma.service.findMany.mockResolvedValue([]);
    mockPrisma.service.findUnique.mockResolvedValue(null);
    mockPrisma.booking.findMany.mockResolvedValue([]);
    mockPrisma.booking.findUnique.mockResolvedValue(null);
    mockPrisma.booking.create.mockResolvedValue({} as any);
    mockPrisma.booking.update.mockResolvedValue({} as any);
    mockPrisma.user.findUnique.mockResolvedValue(null);
  },

  /**
   * Create database transaction mock
   */
  mockTransaction<T>(callback: (tx: any) => Promise<T>, result: T) {
    const mockPrisma = this.getMockPrisma();
    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      if (typeof fn === 'function') {
        return await fn(mockPrisma);
      }
      return result;
    });
  },

  /**
   * Mock database error
   */
  mockDatabaseError(operation: string, error: Error) {
    const mockPrisma = this.getMockPrisma();
    (mockPrisma as any)[operation].mockRejectedValue(error);
  },
};

/**
 * Async Testing Utilities
 */
export const AsyncTestUtils = {
  /**
   * Wait for a specified amount of time
   */
  sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Wait for a condition to be true
   */
  async waitFor(
    condition: () => boolean | Promise<boolean>,
    timeout = 5000,
    interval = 100
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const result = await condition();
      if (result) {
        return;
      }
      await this.sleep(interval);
    }

    throw new Error(`Condition not met within ${timeout}ms`);
  },

  /**
   * Test function with timeout
   */
  async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutMessage = 'Operation timed out'
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
    );

    return Promise.race([promise, timeoutPromise]);
  },
};

/**
 * Error Testing Utilities
 */
export const ErrorTestUtils = {
  /**
   * Expect async function to throw specific error
   */
  async expectToThrow(
    fn: () => Promise<any>,
    expectedError?: string | RegExp | Error
  ) {
    let error: Error | undefined;

    try {
      await fn();
    } catch (e) {
      error = e as Error;
    }

    expect(error).toBeDefined();

    if (expectedError) {
      if (typeof expectedError === 'string') {
        expect(error!.message).toContain(expectedError);
      } else if (expectedError instanceof RegExp) {
        expect(error!.message).toMatch(expectedError);
      } else if (expectedError instanceof Error) {
        expect(error!.message).toBe(expectedError.message);
        expect(error!.constructor).toBe(expectedError.constructor);
      }
    }

    return error!;
  },

  /**
   * Create mock error for testing
   */
  createMockError(message: string, code?: string, statusCode?: number) {
    const error = new Error(message) as Error & {
      code?: string;
      statusCode?: number;
    };

    if (code) error.code = code;
    if (statusCode) error.statusCode = statusCode;

    return error;
  },
};

/**
 * Date Testing Utilities
 */
export const DateTestUtils = {
  /**
   * Create date string in YYYY-MM-DD format
   */
  formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  },

  /**
   * Create date for testing (tomorrow by default)
   */
  createTestDate(daysFromNow = 1): Date {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    date.setHours(10, 0, 0, 0); // Set to 10:00 AM
    return date;
  },

  /**
   * Check if two dates are on the same day
   */
  isSameDay(date1: Date, date2: Date): boolean {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  },

  /**
   * Add business days to a date (skip weekends)
   */
  addBusinessDays(date: Date, days: number): Date {
    const result = new Date(date);
    let addedDays = 0;

    while (addedDays < days) {
      result.setDate(result.getDate() + 1);
      // Skip weekends (Saturday = 6, Sunday = 0)
      if (result.getDay() !== 0 && result.getDay() !== 6) {
        addedDays++;
      }
    }

    return result;
  },
};

/**
 * Validation Testing Utilities
 */
export const ValidationTestUtils = {
  /**
   * Test Zod schema validation
   */
  testZodSchema(schema: any, validData: any, invalidData: any[]) {
    // Test valid data
    expect(() => schema.parse(validData)).not.toThrow();

    // Test invalid data
    invalidData.forEach((data) => {
      expect(() => schema.parse(data)).toThrow();
    });
  },

  /**
   * Generate invalid email formats for testing
   */
  getInvalidEmails(): string[] {
    return [
      'invalid-email',
      '@domain.com',
      'user@',
      'user@.com',
      'user..name@domain.com',
      'user name@domain.com',
      '',
    ];
  },

  /**
   * Generate invalid phone numbers for testing
   */
  getInvalidPhones(): string[] {
    return [
      '123',
      'invalid-phone',
      '+358abc123456',
      '358401234567', // Missing +
      '+358 40 123 4567', // Spaces
      '',
    ];
  },
};

/**
 * Performance Testing Utilities
 */
export const PerformanceTestUtils = {
  /**
   * Measure execution time of a function
   */
  async measureExecutionTime<T>(fn: () => Promise<T>): Promise<{
    result: T;
    executionTime: number;
  }> {
    const startTime = performance.now();
    const result = await fn();
    const endTime = performance.now();

    return {
      result,
      executionTime: endTime - startTime,
    };
  },

  /**
   * Assert function executes within time limit
   */
  async expectExecutionTime<T>(
    fn: () => Promise<T>,
    maxExecutionTime: number
  ): Promise<T> {
    const { result, executionTime } = await this.measureExecutionTime(fn);

    expect(executionTime).toBeLessThan(maxExecutionTime);

    return result;
  },

  /**
   * Run performance benchmark
   */
  async benchmark(
    name: string,
    fn: () => Promise<any>,
    iterations = 100
  ): Promise<{
    name: string;
    iterations: number;
    totalTime: number;
    averageTime: number;
    minTime: number;
    maxTime: number;
  }> {
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const { executionTime } = await this.measureExecutionTime(fn);
      times.push(executionTime);
    }

    const totalTime = times.reduce((sum, time) => sum + time, 0);
    const averageTime = totalTime / iterations;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    return {
      name,
      iterations,
      totalTime,
      averageTime,
      minTime,
      maxTime,
    };
  },
};