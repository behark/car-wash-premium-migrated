import { GET } from '../route';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma-simple';

// Mock Prisma
jest.mock('@/lib/prisma-simple', () => ({
  prisma: {
    $queryRaw: jest.fn(),
  },
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('/api/health', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset process.uptime mock
    jest.spyOn(process, 'uptime').mockReturnValue(3600); // 1 hour

    // Mock memory usage
    jest.spyOn(process, 'memoryUsage').mockReturnValue({
      rss: 50 * 1024 * 1024,
      heapTotal: 40 * 1024 * 1024,
      heapUsed: 30 * 1024 * 1024,
      external: 5 * 1024 * 1024,
      arrayBuffers: 2 * 1024 * 1024,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('successful health checks', () => {
    it('returns healthy status when database is accessible', async () => {
      // Arrange
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      // Act
      const response = await GET();
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data).toEqual({
        status: 'healthy',
        timestamp: expect.any(String),
        uptime: 3600,
        checks: {
          database: {
            status: 'pass',
            message: 'Database connection successful',
          },
        },
        memory: {
          used: 30, // 30MB (heapUsed)
          total: 40, // 40MB (heapTotal)
          percentage: 75, // (30/40) * 100
        },
        version: '1.0.0',
      });

      expect(mockPrisma.$queryRaw).toHaveBeenCalledWith(expect.any(Array));
    });

    it('returns valid timestamp in ISO format', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const response = await GET();
      const data = await response.json();

      expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

      // Verify timestamp is recent (within last 5 seconds)
      const timestamp = new Date(data.timestamp);
      const now = new Date();
      const timeDiff = Math.abs(now.getTime() - timestamp.getTime());
      expect(timeDiff).toBeLessThan(5000);
    });

    it('calculates memory usage correctly', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      // Mock different memory values
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        rss: 100 * 1024 * 1024,
        heapTotal: 80 * 1024 * 1024, // 80MB
        heapUsed: 60 * 1024 * 1024,  // 60MB
        external: 10 * 1024 * 1024,
        arrayBuffers: 5 * 1024 * 1024,
      });

      const response = await GET();
      const data = await response.json();

      expect(data.memory).toEqual({
        used: 60,  // 60MB
        total: 80, // 80MB
        percentage: 75, // (60/80) * 100
      });
    });

    it('handles edge case memory calculations', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      // Test very small memory values
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        rss: 1024 * 1024,
        heapTotal: 2 * 1024 * 1024, // 2MB
        heapUsed: 1.5 * 1024 * 1024, // 1.5MB
        external: 0,
        arrayBuffers: 0,
      });

      const response = await GET();
      const data = await response.json();

      expect(data.memory).toEqual({
        used: 2,   // Rounded up from 1.5
        total: 2,  // 2MB
        percentage: 75, // (1.5/2) * 100 = 75
      });
    });
  });

  describe('database connection failures', () => {
    it('returns unhealthy status when database query fails', async () => {
      // Arrange
      const dbError = new Error('Connection timeout');
      mockPrisma.$queryRaw.mockRejectedValue(dbError);

      // Act
      const response = await GET();
      const data = await response.json();

      // Assert
      expect(response.status).toBe(503);
      expect(data).toEqual({
        status: 'unhealthy',
        timestamp: expect.any(String),
        error: 'Connection timeout',
        checks: {
          database: {
            status: 'fail',
            message: 'Database connection failed',
          },
        },
      });
    });

    it('handles non-Error database exceptions', async () => {
      // Test when error is not an Error object
      mockPrisma.$queryRaw.mockRejectedValue('String error');

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.error).toBe('String error');
    });

    it('handles database timeout errors', async () => {
      const timeoutError = new Error('connect ETIMEDOUT');
      mockPrisma.$queryRaw.mockRejectedValue(timeoutError);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.error).toBe('connect ETIMEDOUT');
      expect(data.checks.database.status).toBe('fail');
    });

    it('handles database authentication errors', async () => {
      const authError = new Error('password authentication failed');
      mockPrisma.$queryRaw.mockRejectedValue(authError);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.error).toBe('password authentication failed');
    });
  });

  describe('performance and reliability', () => {
    it('responds within reasonable time limit', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const startTime = Date.now();
      const response = await GET();
      const endTime = Date.now();

      const responseTime = endTime - startTime;
      expect(responseTime).toBeLessThan(5000); // Should respond within 5 seconds

      expect(response.status).toBe(200);
    });

    it('handles concurrent health check requests', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      // Make multiple concurrent requests
      const requests = Array.from({ length: 5 }, () => GET());
      const responses = await Promise.all(requests);

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Database should be queried for each request
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(5);
    });

    it('handles slow database responses', async () => {
      // Simulate slow database response
      mockPrisma.$queryRaw.mockImplementation(
        () => new Promise(resolve =>
          setTimeout(() => resolve([{ '?column?': 1 }]), 2000)
        )
      );

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
    });
  });

  describe('error edge cases', () => {
    it('handles null/undefined database response', async () => {
      mockPrisma.$queryRaw.mockResolvedValue(null);

      const response = await GET();
      const data = await response.json();

      // Should still be considered successful since no error was thrown
      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
    });

    it('handles empty database response', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
    });

    it('handles unexpected database response format', async () => {
      mockPrisma.$queryRaw.mockResolvedValue({ unexpected: 'format' });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
    });
  });

  describe('uptime tracking', () => {
    it('reports uptime correctly', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      // Mock different uptime values
      jest.spyOn(process, 'uptime').mockReturnValue(7200); // 2 hours

      const response = await GET();
      const data = await response.json();

      expect(data.uptime).toBe(7200);
    });

    it('handles zero uptime', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      jest.spyOn(process, 'uptime').mockReturnValue(0);

      const response = await GET();
      const data = await response.json();

      expect(data.uptime).toBe(0);
    });

    it('handles fractional uptime', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      jest.spyOn(process, 'uptime').mockReturnValue(123.456);

      const response = await GET();
      const data = await response.json();

      expect(data.uptime).toBe(123); // Should floor the value
    });
  });

  describe('response format validation', () => {
    it('includes all required fields in healthy response', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const response = await GET();
      const data = await response.json();

      // Check all required fields are present
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('uptime');
      expect(data).toHaveProperty('checks');
      expect(data).toHaveProperty('memory');
      expect(data).toHaveProperty('version');

      // Check nested structures
      expect(data.checks).toHaveProperty('database');
      expect(data.checks.database).toHaveProperty('status');
      expect(data.checks.database).toHaveProperty('message');

      expect(data.memory).toHaveProperty('used');
      expect(data.memory).toHaveProperty('total');
      expect(data.memory).toHaveProperty('percentage');
    });

    it('includes required fields in error response', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Test error'));

      const response = await GET();
      const data = await response.json();

      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('error');
      expect(data).toHaveProperty('checks');
      expect(data.checks).toHaveProperty('database');
    });

    it('validates status field values', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const response = await GET();
      const data = await response.json();

      expect(['healthy', 'unhealthy']).toContain(data.status);
    });

    it('validates database check status values', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const response = await GET();
      const data = await response.json();

      expect(['pass', 'fail']).toContain(data.checks.database.status);
    });
  });
});