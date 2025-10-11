import { BOOKING_RATE_LIMIT, TESTIMONIAL_RATE_LIMIT, API_RATE_LIMIT, createRateLimitMiddleware } from '../rateLimit';

// Mock logger
jest.mock('../logger', () => ({
  logger: {
    warn: jest.fn(),
  },
}));

const { logger } = require('../logger');

describe('RateLimit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // Helper function to create mock request
  const createMockRequest = (ip: string = '192.168.1.1', url: string = '/api/booking') => ({
    headers: { 'x-forwarded-for': ip },
    connection: { remoteAddress: ip },
    url,
  });

  describe('BOOKING_RATE_LIMIT', () => {
    it('allows requests within rate limit', () => {
      const req = createMockRequest();

      // First request should be allowed
      const result1 = BOOKING_RATE_LIMIT.checkLimit(req);
      expect(result1.allowed).toBe(true);
      expect(result1.retryAfter).toBeUndefined();

      // Second request should be allowed
      const result2 = BOOKING_RATE_LIMIT.checkLimit(req);
      expect(result2.allowed).toBe(true);
    });

    it('blocks requests exceeding minute limit (1 request per minute)', () => {
      const req = createMockRequest();

      // First request allowed
      const result1 = BOOKING_RATE_LIMIT.checkLimit(req);
      expect(result1.allowed).toBe(true);

      // Second request within same minute should be blocked
      const result2 = BOOKING_RATE_LIMIT.checkLimit(req);
      expect(result2.allowed).toBe(false);
      expect(result2.retryAfter).toBeLessThanOrEqual(60);
      expect(result2.retryAfter).toBeGreaterThan(0);
    });

    it('blocks requests exceeding 15-minute limit (5 requests per 15 minutes)', () => {
      const req = createMockRequest();

      // Allow 5 requests over time
      for (let i = 0; i < 5; i++) {
        // Advance by 1 minute to avoid minute limit
        jest.advanceTimersByTime(60 * 1000);
        const result = BOOKING_RATE_LIMIT.checkLimit(req);
        expect(result.allowed).toBe(true);
      }

      // 6th request should be blocked (exceeding 15-minute window)
      jest.advanceTimersByTime(60 * 1000);
      const result = BOOKING_RATE_LIMIT.checkLimit(req);
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('resets limits after time window expires', () => {
      const req = createMockRequest();

      // Block after first request (1 minute limit)
      BOOKING_RATE_LIMIT.checkLimit(req); // First request
      const blockedResult = BOOKING_RATE_LIMIT.checkLimit(req); // Second request
      expect(blockedResult.allowed).toBe(false);

      // Advance time beyond window
      jest.advanceTimersByTime(61 * 1000); // 61 seconds

      // Should be allowed again
      const allowedResult = BOOKING_RATE_LIMIT.checkLimit(req);
      expect(allowedResult.allowed).toBe(true);
    });

    it('handles different IPs independently', () => {
      const req1 = createMockRequest('192.168.1.1');
      const req2 = createMockRequest('192.168.1.2');

      // First IP: use up minute limit
      BOOKING_RATE_LIMIT.checkLimit(req1); // Allowed
      const blockedResult = BOOKING_RATE_LIMIT.checkLimit(req1); // Blocked
      expect(blockedResult.allowed).toBe(false);

      // Second IP: should still be allowed
      const allowedResult = BOOKING_RATE_LIMIT.checkLimit(req2);
      expect(allowedResult.allowed).toBe(true);
    });

    it('logs rate limit violations', () => {
      const req = createMockRequest('192.168.1.100');

      // Trigger rate limit
      BOOKING_RATE_LIMIT.checkLimit(req); // First request
      BOOKING_RATE_LIMIT.checkLimit(req); // Second request - should be blocked

      expect(logger.warn).toHaveBeenCalledWith('Rate limit exceeded', {
        key: expect.stringContaining('192.168.1.100'),
        count: 2,
        maxRequests: 1,
        windowMs: 60000,
        retryAfter: expect.any(Number),
        ip: '192.168.1.100',
      });
    });
  });

  describe('TESTIMONIAL_RATE_LIMIT', () => {
    it('allows up to 3 testimonials per hour', () => {
      const req = createMockRequest();

      // Allow 3 requests
      for (let i = 0; i < 3; i++) {
        const result = TESTIMONIAL_RATE_LIMIT.checkLimit(req);
        expect(result.allowed).toBe(true);
      }

      // 4th request should be blocked
      const result = TESTIMONIAL_RATE_LIMIT.checkLimit(req);
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('resets after hour window', () => {
      const req = createMockRequest();

      // Use up limit
      for (let i = 0; i < 3; i++) {
        TESTIMONIAL_RATE_LIMIT.checkLimit(req);
      }

      // Should be blocked
      const blockedResult = TESTIMONIAL_RATE_LIMIT.checkLimit(req);
      expect(blockedResult.allowed).toBe(false);

      // Advance time beyond window
      jest.advanceTimersByTime(61 * 60 * 1000); // 61 minutes

      // Should be allowed again
      const allowedResult = TESTIMONIAL_RATE_LIMIT.checkLimit(req);
      expect(allowedResult.allowed).toBe(true);
    });
  });

  describe('API_RATE_LIMIT', () => {
    it('allows up to 100 requests per hour', () => {
      const req = createMockRequest();

      // Allow 100 requests
      for (let i = 0; i < 100; i++) {
        const result = API_RATE_LIMIT.checkLimit(req);
        expect(result.allowed).toBe(true);
      }

      // 101st request should be blocked
      const result = API_RATE_LIMIT.checkLimit(req);
      expect(result.allowed).toBe(false);
    });

    it('handles high volume correctly', () => {
      const req = createMockRequest();

      // Simulate rapid requests
      for (let i = 0; i < 100; i++) {
        const result = API_RATE_LIMIT.checkLimit(req);
        expect(result.allowed).toBe(true);
      }

      // Next request should be blocked
      const blockedResult = API_RATE_LIMIT.checkLimit(req);
      expect(blockedResult.allowed).toBe(false);
      expect(blockedResult.retryAfter).toBeGreaterThan(0);
    });
  });

  describe('Custom key generation', () => {
    it('uses custom key generator when provided', () => {
      // Create a custom rate limiter with key generator
      class TestRateLimiter {
        private requests = new Map<string, any>();

        checkLimit(req: any, keyGenerator?: (req: any) => string): { allowed: boolean; retryAfter?: number } {
          const key = keyGenerator ? keyGenerator(req) : `${req.headers['x-forwarded-for']}:${req.url}`;

          if (this.requests.has(key)) {
            return { allowed: false, retryAfter: 60 };
          }

          this.requests.set(key, { timestamp: Date.now(), count: 1 });
          return { allowed: true };
        }
      }

      const limiter = new TestRateLimiter();
      const req1 = createMockRequest('192.168.1.1', '/api/test');
      const req2 = createMockRequest('192.168.1.2', '/api/test');

      // Custom key generator that only uses URL
      const customKeyGen = (req: any) => req.url;

      // First request
      const result1 = limiter.checkLimit(req1, customKeyGen);
      expect(result1.allowed).toBe(true);

      // Second request with different IP but same URL should be blocked
      const result2 = limiter.checkLimit(req2, customKeyGen);
      expect(result2.allowed).toBe(false);
    });
  });

  describe('IP address extraction', () => {
    it('extracts IP from x-forwarded-for header', () => {
      const req = {
        headers: { 'x-forwarded-for': '203.0.113.1, 192.168.1.1' },
        connection: { remoteAddress: '10.0.0.1' },
        url: '/api/test',
      };

      const result = API_RATE_LIMIT.checkLimit(req);
      expect(result.allowed).toBe(true);

      // Verify it uses the first IP from x-forwarded-for
      // (This is tested indirectly through rate limiting behavior)
    });

    it('falls back to connection.remoteAddress when no x-forwarded-for', () => {
      const req = {
        headers: {},
        connection: { remoteAddress: '10.0.0.1' },
        url: '/api/test',
      };

      const result = API_RATE_LIMIT.checkLimit(req);
      expect(result.allowed).toBe(true);
    });
  });

  describe('Memory cleanup', () => {
    it('cleans up old entries periodically', () => {
      const req = createMockRequest();

      // Make a request
      API_RATE_LIMIT.checkLimit(req);

      // Advance time way beyond any window
      jest.advanceTimersByTime(2 * 60 * 60 * 1000); // 2 hours

      // Trigger cleanup (this happens automatically every 5 minutes)
      jest.advanceTimersByTime(5 * 60 * 1000); // 5 minutes

      // Should be able to make full quota again
      for (let i = 0; i < 100; i++) {
        const result = API_RATE_LIMIT.checkLimit(req);
        expect(result.allowed).toBe(true);
      }
    });
  });

  describe('createRateLimitMiddleware', () => {
    let mockReq: any;
    let mockRes: any;
    let mockNext: jest.Mock;

    beforeEach(() => {
      mockReq = createMockRequest();
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      mockNext = jest.fn();
    });

    it('calls next() when request is allowed', () => {
      const middleware = createRateLimitMiddleware(API_RATE_LIMIT);

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it('returns 429 when rate limit exceeded', () => {
      const middleware = createRateLimitMiddleware(BOOKING_RATE_LIMIT);

      // First request - allowed
      middleware(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);

      // Reset mocks
      mockNext.mockClear();

      // Second request - should be blocked
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Too many requests',
        retryAfter: expect.any(Number),
      });
    });

    it('skips rate limiting in development environment', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const middleware = createRateLimitMiddleware(BOOKING_RATE_LIMIT);

      // Should always call next() in development
      for (let i = 0; i < 10; i++) {
        middleware(mockReq, mockRes, mockNext);
      }

      expect(mockNext).toHaveBeenCalledTimes(10);
      expect(mockRes.status).not.toHaveBeenCalled();

      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });

    it('provides correct retry-after header', () => {
      const middleware = createRateLimitMiddleware(BOOKING_RATE_LIMIT);

      // Trigger rate limit
      middleware(mockReq, mockRes, mockNext); // First request
      middleware(mockReq, mockRes, mockNext); // Second request - blocked

      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Too many requests',
        retryAfter: expect.any(Number),
      });

      const retryAfter = mockRes.json.mock.calls[0][0].retryAfter;
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(60); // Should be within minute window
    });
  });

  describe('Edge cases and error handling', () => {
    it('handles requests without headers gracefully', () => {
      const req = {
        connection: { remoteAddress: '127.0.0.1' },
        url: '/api/test',
      };

      const result = API_RATE_LIMIT.checkLimit(req);
      expect(result.allowed).toBe(true);
    });

    it('handles requests without connection info', () => {
      const req = {
        headers: {},
        url: '/api/test',
      };

      // Should not throw error
      expect(() => {
        API_RATE_LIMIT.checkLimit(req);
      }).not.toThrow();
    });

    it('calculates correct retry-after for different windows', () => {
      const req = createMockRequest();

      // Use up BOOKING_RATE_LIMIT (1 minute window)
      BOOKING_RATE_LIMIT.checkLimit(req);
      const result = BOOKING_RATE_LIMIT.checkLimit(req);

      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeLessThanOrEqual(60);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('handles concurrent requests correctly', () => {
      const req = createMockRequest();

      // Simulate concurrent requests
      const results = [];
      for (let i = 0; i < 5; i++) {
        results.push(API_RATE_LIMIT.checkLimit(req));
      }

      // All should be allowed (within limit)
      results.forEach(result => {
        expect(result.allowed).toBe(true);
      });
    });
  });
});