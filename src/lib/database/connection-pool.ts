/**
 * Enterprise Database Connection Pool Manager
 * Advanced connection pooling with monitoring and health checks
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../logger';

interface PoolMetrics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingConnections: number;
  createdConnections: number;
  destroyedConnections: number;
  connectionRequestsTotal: number;
  connectionRequestTimeouts: number;
  lastHealthCheck: Date;
  averageConnectionTime: number;
}

interface ConnectionPoolConfig {
  maxConnections?: number;
  minConnections?: number;
  connectionTimeoutMs?: number;
  idleTimeoutMs?: number;
  healthCheckIntervalMs?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
}

class DatabaseConnectionPool {
  private prismaClient: PrismaClient;
  private config: Required<ConnectionPoolConfig>;
  private metrics: PoolMetrics;
  private healthCheckInterval?: NodeJS.Timeout;
  private lastConnectionTimes: number[] = [];
  private isHealthy = true;

  constructor(config: ConnectionPoolConfig = {}) {
    this.config = {
      maxConnections: config.maxConnections || 10,
      minConnections: config.minConnections || 2,
      connectionTimeoutMs: config.connectionTimeoutMs || 10000,
      idleTimeoutMs: config.idleTimeoutMs || 300000, // 5 minutes
      healthCheckIntervalMs: config.healthCheckIntervalMs || 30000, // 30 seconds
      retryAttempts: config.retryAttempts || 3,
      retryDelayMs: config.retryDelayMs || 1000,
    };

    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingConnections: 0,
      createdConnections: 0,
      destroyedConnections: 0,
      connectionRequestsTotal: 0,
      connectionRequestTimeouts: 0,
      lastHealthCheck: new Date(),
      averageConnectionTime: 0,
    };

    this.initializePrismaClient();
    this.startHealthChecks();
  }

  private initializePrismaClient(): void {
    try {
      this.prismaClient = new PrismaClient({
        log: [
          { emit: 'event', level: 'query' },
          { emit: 'event', level: 'error' },
          { emit: 'event', level: 'warn' }
        ],
        datasources: {
          db: {
            url: this.buildConnectionUrl(),
          },
        },
      });

      // Add event listeners for monitoring
      this.prismaClient.$on('query', (e) => {
        this.trackQueryPerformance(e);
      });

      this.prismaClient.$on('error', (e) => {
        logger.error('Database error', {
          target: e.target,
          message: e.message,
          timestamp: e.timestamp,
        });
        this.metrics.connectionRequestTimeouts++;
      });

      logger.info('Database connection pool initialized', {
        config: this.config,
      });
    } catch (error) {
      logger.error('Failed to initialize database connection pool', { error });
      throw error;
    }
  }

  private buildConnectionUrl(): string {
    const baseUrl = process.env.DATABASE_URL;
    if (!baseUrl) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    // Add connection pool parameters to the URL
    const url = new URL(baseUrl);
    url.searchParams.set('connection_limit', this.config.maxConnections.toString());
    url.searchParams.set('pool_timeout', (this.config.connectionTimeoutMs / 1000).toString());

    // Add additional PostgreSQL-specific connection parameters
    if (url.protocol === 'postgresql:' || url.protocol === 'postgres:') {
      url.searchParams.set('statement_timeout', '60000'); // 60 seconds
      url.searchParams.set('query_timeout', '30000'); // 30 seconds
      url.searchParams.set('connect_timeout', '10'); // 10 seconds
      url.searchParams.set('application_name', 'car-wash-booking');
    }

    return url.toString();
  }

  private trackQueryPerformance(queryEvent: any): void {
    const connectionTime = queryEvent.duration;
    this.lastConnectionTimes.push(connectionTime);

    // Keep only last 100 connection times for rolling average
    if (this.lastConnectionTimes.length > 100) {
      this.lastConnectionTimes.shift();
    }

    this.metrics.averageConnectionTime =
      this.lastConnectionTimes.reduce((a, b) => a + b, 0) / this.lastConnectionTimes.length;

    // Log slow queries
    if (connectionTime > 1000) {
      logger.warn('Slow database query detected', {
        query: queryEvent.query.substring(0, 200) + '...',
        duration: connectionTime,
        params: queryEvent.params,
      });
    }
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(
      () => this.performHealthCheck(),
      this.config.healthCheckIntervalMs
    );
  }

  private async performHealthCheck(): Promise<void> {
    try {
      const start = Date.now();
      await this.prismaClient.$queryRaw`SELECT 1 as health_check`;
      const duration = Date.now() - start;

      this.isHealthy = duration < 5000; // Consider unhealthy if takes more than 5s
      this.metrics.lastHealthCheck = new Date();

      if (!this.isHealthy) {
        logger.warn('Database health check failed', {
          duration,
          metrics: this.metrics,
        });
      }

      logger.debug('Database health check completed', {
        duration,
        healthy: this.isHealthy,
      });
    } catch (error) {
      this.isHealthy = false;
      logger.error('Database health check error', { error });
    }
  }

  /**
   * Execute a database operation with automatic retry and connection management
   */
  async execute<T>(
    operation: (client: PrismaClient) => Promise<T>,
    operationName = 'database_operation'
  ): Promise<T> {
    const startTime = Date.now();
    this.metrics.connectionRequestsTotal++;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const result = await Promise.race([
          operation(this.prismaClient),
          this.createTimeoutPromise(),
        ]);

        const duration = Date.now() - startTime;
        logger.debug('Database operation completed', {
          operation: operationName,
          duration,
          attempt,
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        if (attempt === this.config.retryAttempts) {
          logger.error('Database operation failed after all retries', {
            operation: operationName,
            attempts: attempt,
            duration,
            error: error instanceof Error ? error.message : error,
          });
          throw error;
        }

        logger.warn('Database operation failed, retrying', {
          operation: operationName,
          attempt,
          error: error instanceof Error ? error.message : error,
        });

        // Wait before retry with exponential backoff
        await this.wait(this.config.retryDelayMs * Math.pow(2, attempt - 1));
      }
    }

    throw new Error('Database operation failed - should not reach here');
  }

  /**
   * Execute multiple operations in a database transaction
   */
  async executeTransaction<T>(
    operations: (client: PrismaClient) => Promise<T>,
    operationName = 'transaction'
  ): Promise<T> {
    return this.execute(
      async (client) => {
        return client.$transaction(async (tx) => {
          return operations(tx);
        });
      },
      operationName
    );
  }

  /**
   * Execute operations with read replica preference (if available)
   */
  async executeReadOnly<T>(
    operation: (client: PrismaClient) => Promise<T>,
    operationName = 'read_operation'
  ): Promise<T> {
    // For now, use the same client. In a full enterprise setup,
    // this would route to read replicas
    return this.execute(operation, operationName);
  }

  private createTimeoutPromise(): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        this.metrics.connectionRequestTimeouts++;
        reject(new Error(`Database operation timeout after ${this.config.connectionTimeoutMs}ms`));
      }, this.config.connectionTimeoutMs);
    });
  }

  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current pool metrics
   */
  getMetrics(): PoolMetrics {
    return { ...this.metrics };
  }

  /**
   * Get pool health status
   */
  isPoolHealthy(): boolean {
    return this.isHealthy;
  }

  /**
   * Get the raw Prisma client (use sparingly)
   */
  getRawClient(): PrismaClient {
    return this.prismaClient;
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down database connection pool...');

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    try {
      await this.prismaClient.$disconnect();
      logger.info('Database connection pool shut down successfully');
    } catch (error) {
      logger.error('Error during database connection pool shutdown', { error });
      throw error;
    }
  }

  /**
   * Force reconnection (for recovery scenarios)
   */
  async reconnect(): Promise<void> {
    logger.info('Forcing database reconnection...');

    try {
      await this.prismaClient.$disconnect();
      this.initializePrismaClient();
      await this.performHealthCheck();

      logger.info('Database reconnection completed', {
        healthy: this.isHealthy,
      });
    } catch (error) {
      logger.error('Database reconnection failed', { error });
      throw error;
    }
  }
}

// Singleton instance
let connectionPool: DatabaseConnectionPool | null = null;

/**
 * Get the singleton database connection pool
 */
export function getConnectionPool(): DatabaseConnectionPool {
  if (!connectionPool) {
    const config: ConnectionPoolConfig = {
      maxConnections: process.env.DB_MAX_CONNECTIONS ?
        parseInt(process.env.DB_MAX_CONNECTIONS) : undefined,
      connectionTimeoutMs: process.env.DB_POOL_TIMEOUT ?
        parseInt(process.env.DB_POOL_TIMEOUT) : undefined,
      idleTimeoutMs: process.env.DB_IDLE_TIMEOUT ?
        parseInt(process.env.DB_IDLE_TIMEOUT) : undefined,
    };

    connectionPool = new DatabaseConnectionPool(config);
  }

  return connectionPool;
}

/**
 * Execute database operation with connection pool
 */
export async function executeWithPool<T>(
  operation: (client: PrismaClient) => Promise<T>,
  operationName?: string
): Promise<T> {
  const pool = getConnectionPool();
  return pool.execute(operation, operationName);
}

/**
 * Execute database transaction with connection pool
 */
export async function executeTransaction<T>(
  operations: (client: PrismaClient) => Promise<T>,
  operationName?: string
): Promise<T> {
  const pool = getConnectionPool();
  return pool.executeTransaction(operations, operationName);
}

/**
 * Execute read-only operation with connection pool
 */
export async function executeReadOnly<T>(
  operation: (client: PrismaClient) => Promise<T>,
  operationName?: string
): Promise<T> {
  const pool = getConnectionPool();
  return pool.executeReadOnly(operation, operationName);
}

// Graceful shutdown handler (Node.js runtime only)
if (typeof process !== 'undefined' && process.on) {
  try {
    process.on('SIGTERM', async () => {
      if (connectionPool) {
        await connectionPool.shutdown();
      }
    });

    process.on('SIGINT', async () => {
      if (connectionPool) {
        await connectionPool.shutdown();
      }
    });
  } catch (error) {
    // Graceful degradation for Edge Runtime
    console.warn('Process shutdown handlers not available in this runtime environment');
  }
}

export { DatabaseConnectionPool, type ConnectionPoolConfig, type PoolMetrics };