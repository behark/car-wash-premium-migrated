/**
 * Enhanced Prisma Client with Enterprise Connection Pool
 * Now uses the enterprise-grade connection pool for all database operations
 */

import { PrismaClient } from '@prisma/client';
import { getConnectionPool, executeWithPool, executeTransaction, executeReadOnly } from './database/connection-pool';
import { logger } from './logger';

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  connectionPool?: ReturnType<typeof getConnectionPool>;
};

/**
 * Legacy Prisma client for backward compatibility
 * @deprecated Use connection pool methods instead
 */
function createLegacyPrismaClient(): PrismaClient {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  // Validate database URL format
  if (isProduction && process.env.DATABASE_URL.includes('file:')) {
    throw new Error('SQLite database not allowed in production. Use PostgreSQL.');
  }

  const client = new PrismaClient({
    log: isProduction
      ? [{ emit: 'event', level: 'error' }]
      : [
          { emit: 'event', level: 'query' },
          { emit: 'event', level: 'error' },
          { emit: 'event', level: 'warn' }
        ],
    errorFormat: isProduction ? 'minimal' : 'pretty',
  });

  // Add logging listeners
  if (isProduction) {
    client.$on('error', (e) => {
      logger.error('Database error (legacy client)', {
        target: e.target,
        timestamp: e.timestamp,
        message: e.message
      });
    });
  } else {
    client.$on('query', (e) => {
      logger.debug('Database query (legacy client)', {
        query: e.query,
        duration: `${e.duration}ms`,
        timestamp: e.timestamp
      });
    });

    client.$on('error', (e) => {
      logger.error('Database error (legacy client)', e);
    });

    client.$on('warn', (e) => {
      logger.warn('Database warning (legacy client)', e);
    });
  }

  return client;
}

// Legacy client for backward compatibility
export const prisma = globalForPrisma.prisma ?? createLegacyPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Enterprise Database Operations
 * Use these methods for all new database operations
 */

/**
 * Execute a database operation with enterprise connection pool
 * @param operation Database operation to execute
 * @param operationName Name of the operation for logging
 */
export async function executeDbOperation<T>(
  operation: (client: PrismaClient) => Promise<T>,
  operationName?: string
): Promise<T> {
  return executeWithPool(operation, operationName);
}

/**
 * Execute multiple operations in a database transaction
 * @param operations Operations to execute in transaction
 * @param operationName Name of the transaction for logging
 */
export async function executeDbTransaction<T>(
  operations: (client: PrismaClient) => Promise<T>,
  operationName?: string
): Promise<T> {
  return executeTransaction(operations, operationName);
}

/**
 * Execute read-only operation (will use read replicas when available)
 * @param operation Read operation to execute
 * @param operationName Name of the operation for logging
 */
export async function executeDbRead<T>(
  operation: (client: PrismaClient) => Promise<T>,
  operationName?: string
): Promise<T> {
  return executeReadOnly(operation, operationName);
}

/**
 * Get connection pool metrics for monitoring
 */
export function getDbMetrics() {
  const pool = getConnectionPool();
  return pool.getMetrics();
}

/**
 * Check database health
 */
export function isDbHealthy(): boolean {
  const pool = getConnectionPool();
  return pool.isPoolHealthy();
}

/**
 * Get raw connection pool instance (use with caution)
 */
export function getDbConnectionPool() {
  return getConnectionPool();
}

// Graceful shutdown (Node.js runtime only)
if (typeof process !== 'undefined' && process.on) {
  try {
    process.on('beforeExit', async () => {
      logger.info('Closing database connections...');

      try {
        // Close connection pool
        const pool = getConnectionPool();
        await pool.shutdown();

        // Close legacy client
        await prisma.$disconnect();

        logger.info('All database connections closed successfully');
      } catch (error) {
        logger.error('Error closing database connections', { error });
      }
    });
  } catch (error) {
    // Graceful degradation for Edge Runtime
    console.warn('Database shutdown handlers not available in this runtime environment');
  }
}

// Export additional utilities
export {
  executeWithPool,
  executeTransaction,
  executeReadOnly,
  getConnectionPool
} from './database/connection-pool';

export {
  transactionManager,
  createBookingSaga,
  type TransactionStep,
  type SagaDefinition,
  type TransactionResult,
  type TransactionContext
} from './database/transaction-manager';