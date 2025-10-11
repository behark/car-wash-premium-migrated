/**
 * Prisma Client Singleton for Serverless Functions
 * Implements proper connection management to prevent memory leaks
 * and connection exhaustion in serverless environments
 */

import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var, no-unused-vars
  var __prisma: PrismaClient | undefined;
}

// Connection pool configuration optimized for serverless
const prismaClientConfig = {
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Optimize for serverless with connection pooling
  log: process.env.NODE_ENV === 'development'
    ? ['query' as const, 'error' as const, 'warn' as const]
    : ['error' as const],
};

// Connection pool settings via URL parameters
function getOptimizedDatabaseUrl(): string {
  const baseUrl = process.env.DATABASE_URL || '';

  // Parse existing URL
  const url = new URL(baseUrl);

  // Optimize connection pool for serverless
  // These settings prevent connection exhaustion
  url.searchParams.set('connection_limit', '5'); // Max connections per function instance
  url.searchParams.set('pool_timeout', '10'); // Wait max 10 seconds for a connection
  url.searchParams.set('connect_timeout', '10'); // Connection timeout
  url.searchParams.set('statement_cache_size', '0'); // Disable statement cache in serverless
  url.searchParams.set('pgbouncer', 'true'); // Enable PgBouncer mode if available

  return url.toString();
}

/**
 * Creates or retrieves the singleton Prisma Client instance
 * Implements connection reuse across function invocations
 */
function createPrismaClient(): PrismaClient {
  // In production, create new client for each request to avoid connection issues
  if (process.env.NODE_ENV === 'production') {
    return new PrismaClient({
      ...prismaClientConfig,
      datasources: {
        db: {
          url: getOptimizedDatabaseUrl(),
        },
      },
    });
  }

  // In development, use singleton to enable hot reload
  if (!global.__prisma) {
    global.__prisma = new PrismaClient({
      ...prismaClientConfig,
      datasources: {
        db: {
          url: getOptimizedDatabaseUrl(),
        },
      },
    });
  }

  return global.__prisma;
}

// Export singleton instance
export const prisma = createPrismaClient();

/**
 * Gracefully disconnects from the database
 * Should be called in finally blocks or error handlers
 */
export async function disconnectPrisma(): Promise<void> {
  try {
    // Only disconnect in production or if explicitly needed
    if (process.env.NODE_ENV === 'production') {
      await prisma.$disconnect();
    }
  } catch (error) {
    console.error('Error disconnecting from database:', error);
    // Don't throw - allow function to complete
  }
}

/**
 * Executes a database operation with proper connection management
 * Ensures connections are properly closed even on errors
 */
export async function withPrisma<T>(
  operation: (_prismaClient: PrismaClient) => Promise<T>
): Promise<T> {
  const client = createPrismaClient();

  try {
    // Connect explicitly for better control
    await client.$connect();

    // Execute the operation
    const result = await operation(client);

    return result;
  } catch (error) {
    console.error('Database operation failed:', error);
    throw error;
  } finally {
    // Always disconnect in production
    if (process.env.NODE_ENV === 'production') {
      await client.$disconnect().catch((err) => {
        console.error('Failed to disconnect:', err);
      });
    }
  }
}

/**
 * Health check for database connection
 * Returns true if database is accessible
 */
export async function checkDatabaseHealth(): Promise<{
  healthy: boolean;
  error?: string;
  latency?: number;
}> {
  const startTime = Date.now();

  try {
    // Simple query to check connection
    await prisma.$queryRaw`SELECT 1`;

    return {
      healthy: true,
      latency: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      healthy: false,
      error: error.message,
      latency: Date.now() - startTime,
    };
  }
}

/**
 * Retry wrapper for database operations
 * Implements exponential backoff for transient failures
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 100
): Promise<T> {
  let lastError: any;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      // Don't retry on client errors (4xx-like)
      if (error.code === 'P2002' || // Unique constraint
          error.code === 'P2025' || // Record not found
          error.code === 'P2003' || // Foreign key constraint
          error.code === 'P2000') { // Value too long
        throw error;
      }

      // Retry on connection errors
      if (i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i);
        console.log(`Retrying after ${delay}ms (attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

// Cleanup on process termination (for development)
if (process.env.NODE_ENV !== 'production') {
  process.on('beforeExit', async () => {
    await prisma.$disconnect();
  });
}