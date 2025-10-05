/**
 * Enterprise Redis Client Manager
 * Advanced caching with connection pooling, clustering, and monitoring
 */

import IORedis, { Redis, Cluster, ClusterOptions, RedisOptions } from 'ioredis';
import { logger } from '../logger';

export interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  connectionCount: number;
  lastOperation: Date;
  avgResponseTime: number;
}

export interface CacheConfig {
  redis?: {
    host?: string;
    port?: number;
    password?: string;
    db?: number;
    keyPrefix?: string;
    retryDelayOnFailover?: number;
    enableReadyCheck?: boolean;
    maxRetriesPerRequest?: number;
    lazyConnect?: boolean;
    connectTimeout?: number;
    commandTimeout?: number;
  };
  cluster?: {
    nodes: Array<{ host: string; port: number }>;
    options?: ClusterOptions;
  };
  defaultTTL?: number;
  enableMetrics?: boolean;
  enableCompression?: boolean;
  maxMemoryPolicy?: string;
}

export interface CacheOperation {
  key: string;
  operation: 'get' | 'set' | 'del' | 'exists' | 'expire';
  startTime: number;
  endTime?: number;
  success?: boolean;
  error?: string;
}

class RedisClientManager {
  private client: Redis | Cluster | null = null;
  private config: CacheConfig;
  private metrics: CacheMetrics;
  private operations: CacheOperation[] = [];
  private maxOperationHistory = 1000;
  private isConnected = false;
  private reconnectTimer?: NodeJS.Timeout;

  constructor(config: CacheConfig = {}) {
    this.config = {
      defaultTTL: 3600, // 1 hour
      enableMetrics: true,
      enableCompression: false,
      maxMemoryPolicy: 'allkeys-lru',
      ...config,
    };

    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      connectionCount: 0,
      lastOperation: new Date(),
      avgResponseTime: 0,
    };

    this.initializeClient();
  }

  private initializeClient(): void {
    try {
      if (this.config.cluster) {
        // Cluster mode
        this.client = new IORedis.Cluster(
          this.config.cluster.nodes,
          {
            enableReadyCheck: false,
            retryDelayOnFailover: 100,
            retryDelayOnClusterDown: 300,
            retryDelayOnReconnect: 100,
            slotsRefreshTimeout: 10000,
            slotsRefreshInterval: 5000,
            maxRetriesPerRequest: 3,
            ...this.config.cluster.options,
          }
        );
      } else {
        // Single node mode
        const redisUrl = process.env.REDIS_URL;

        if (redisUrl) {
          this.client = new IORedis(redisUrl, {
            enableReadyCheck: true,
            retryDelayOnFailover: 100,
            retryDelayOnReconnect: 100,
            maxRetriesPerRequest: 3,
            lazyConnect: true,
            connectTimeout: 10000,
            commandTimeout: 5000,
            ...this.config.redis,
          });
        } else {
          this.client = new IORedis({
            host: this.config.redis?.host || 'localhost',
            port: this.config.redis?.port || 6379,
            password: this.config.redis?.password,
            db: this.config.redis?.db || 0,
            keyPrefix: this.config.redis?.keyPrefix || 'carwash:',
            enableReadyCheck: true,
            retryDelayOnFailover: 100,
            retryDelayOnReconnect: 100,
            maxRetriesPerRequest: 3,
            lazyConnect: true,
            connectTimeout: 10000,
            commandTimeout: 5000,
            ...this.config.redis,
          });
        }
      }

      this.setupEventListeners();
      this.connect();

      logger.info('Redis client initialized', {
        type: this.config.cluster ? 'cluster' : 'single',
        keyPrefix: this.config.redis?.keyPrefix,
      });
    } catch (error) {
      logger.error('Failed to initialize Redis client', { error });
      throw error;
    }
  }

  private setupEventListeners(): void {
    if (!this.client) return;

    this.client.on('connect', () => {
      this.isConnected = true;
      this.metrics.connectionCount++;
      logger.info('Redis connected');

      if (this.reconnectTimer) {
        clearInterval(this.reconnectTimer);
        this.reconnectTimer = undefined;
      }
    });

    this.client.on('ready', () => {
      logger.info('Redis ready');
    });

    this.client.on('error', (error) => {
      this.isConnected = false;
      this.metrics.errors++;
      logger.error('Redis error', { error: error.message });

      if (!this.reconnectTimer) {
        this.startReconnectTimer();
      }
    });

    this.client.on('close', () => {
      this.isConnected = false;
      logger.warn('Redis connection closed');

      if (!this.reconnectTimer) {
        this.startReconnectTimer();
      }
    });

    this.client.on('reconnecting', () => {
      logger.info('Redis reconnecting...');
    });

    if (this.client instanceof IORedis.Cluster) {
      this.client.on('node error', (error, node) => {
        logger.error('Redis cluster node error', {
          error: error.message,
          node: `${node.options.host}:${node.options.port}`,
        });
      });
    }
  }

  private startReconnectTimer(): void {
    this.reconnectTimer = setInterval(() => {
      if (!this.isConnected) {
        logger.info('Attempting Redis reconnection...');
        this.connect().catch(error => {
          logger.error('Redis reconnection failed', { error: error.message });
        });
      }
    }, 5000);
  }

  private async connect(): Promise<void> {
    if (!this.client) return;

    try {
      await this.client.connect();
    } catch (error) {
      logger.error('Redis connection failed', { error });
    }
  }

  private trackOperation(operation: CacheOperation): void {
    if (this.config.enableMetrics) {
      this.operations.push(operation);

      if (this.operations.length > this.maxOperationHistory) {
        this.operations.shift();
      }

      this.metrics.lastOperation = new Date();

      if (operation.endTime && operation.startTime) {
        const responseTime = operation.endTime - operation.startTime;
        const totalOps = this.operations.length;
        this.metrics.avgResponseTime =
          (this.metrics.avgResponseTime * (totalOps - 1) + responseTime) / totalOps;
      }
    }
  }

  /**
   * Get value from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    const operation: CacheOperation = {
      key,
      operation: 'get',
      startTime: Date.now(),
    };

    try {
      if (!this.isConnected || !this.client) {
        operation.success = false;
        operation.error = 'Redis not connected';
        this.trackOperation(operation);
        return null;
      }

      const value = await this.client.get(key);

      operation.endTime = Date.now();
      operation.success = true;
      this.trackOperation(operation);

      if (value === null) {
        this.metrics.misses++;
        return null;
      }

      this.metrics.hits++;

      try {
        return this.deserializeValue<T>(value);
      } catch (parseError) {
        logger.warn('Failed to parse cached value', {
          key,
          error: (parseError as Error).message,
        });
        return null;
      }
    } catch (error) {
      operation.endTime = Date.now();
      operation.success = false;
      operation.error = (error as Error).message;
      this.trackOperation(operation);
      this.metrics.errors++;

      logger.error('Cache get error', {
        key,
        error: (error as Error).message,
      });

      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T = any>(
    key: string,
    value: T,
    ttl?: number
  ): Promise<boolean> {
    const operation: CacheOperation = {
      key,
      operation: 'set',
      startTime: Date.now(),
    };

    try {
      if (!this.isConnected || !this.client) {
        operation.success = false;
        operation.error = 'Redis not connected';
        this.trackOperation(operation);
        return false;
      }

      const serializedValue = this.serializeValue(value);
      const effectiveTTL = ttl ?? this.config.defaultTTL;

      let result: string;
      if (effectiveTTL && effectiveTTL > 0) {
        result = await this.client.setex(key, effectiveTTL, serializedValue);
      } else {
        result = await this.client.set(key, serializedValue);
      }

      operation.endTime = Date.now();
      operation.success = result === 'OK';
      this.trackOperation(operation);

      if (operation.success) {
        this.metrics.sets++;
      } else {
        this.metrics.errors++;
      }

      return operation.success;
    } catch (error) {
      operation.endTime = Date.now();
      operation.success = false;
      operation.error = (error as Error).message;
      this.trackOperation(operation);
      this.metrics.errors++;

      logger.error('Cache set error', {
        key,
        error: (error as Error).message,
      });

      return false;
    }
  }

  /**
   * Delete key from cache
   */
  async del(key: string | string[]): Promise<number> {
    const keys = Array.isArray(key) ? key : [key];
    const operation: CacheOperation = {
      key: Array.isArray(key) ? key.join(',') : key,
      operation: 'del',
      startTime: Date.now(),
    };

    try {
      if (!this.isConnected || !this.client) {
        operation.success = false;
        operation.error = 'Redis not connected';
        this.trackOperation(operation);
        return 0;
      }

      const result = await this.client.del(...keys);

      operation.endTime = Date.now();
      operation.success = true;
      this.trackOperation(operation);
      this.metrics.deletes += result;

      return result;
    } catch (error) {
      operation.endTime = Date.now();
      operation.success = false;
      operation.error = (error as Error).message;
      this.trackOperation(operation);
      this.metrics.errors++;

      logger.error('Cache delete error', {
        keys,
        error: (error as Error).message,
      });

      return 0;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    const operation: CacheOperation = {
      key,
      operation: 'exists',
      startTime: Date.now(),
    };

    try {
      if (!this.isConnected || !this.client) {
        operation.success = false;
        operation.error = 'Redis not connected';
        this.trackOperation(operation);
        return false;
      }

      const result = await this.client.exists(key);

      operation.endTime = Date.now();
      operation.success = true;
      this.trackOperation(operation);

      return result === 1;
    } catch (error) {
      operation.endTime = Date.now();
      operation.success = false;
      operation.error = (error as Error).message;
      this.trackOperation(operation);
      this.metrics.errors++;

      logger.error('Cache exists error', {
        key,
        error: (error as Error).message,
      });

      return false;
    }
  }

  /**
   * Set expiration for key
   */
  async expire(key: string, ttl: number): Promise<boolean> {
    const operation: CacheOperation = {
      key,
      operation: 'expire',
      startTime: Date.now(),
    };

    try {
      if (!this.isConnected || !this.client) {
        operation.success = false;
        operation.error = 'Redis not connected';
        this.trackOperation(operation);
        return false;
      }

      const result = await this.client.expire(key, ttl);

      operation.endTime = Date.now();
      operation.success = result === 1;
      this.trackOperation(operation);

      return operation.success;
    } catch (error) {
      operation.endTime = Date.now();
      operation.success = false;
      operation.error = (error as Error).message;
      this.trackOperation(operation);
      this.metrics.errors++;

      logger.error('Cache expire error', {
        key,
        ttl,
        error: (error as Error).message,
      });

      return false;
    }
  }

  /**
   * Increment counter
   */
  async incr(key: string): Promise<number> {
    try {
      if (!this.isConnected || !this.client) {
        return 0;
      }

      return await this.client.incr(key);
    } catch (error) {
      logger.error('Cache increment error', {
        key,
        error: (error as Error).message,
      });
      return 0;
    }
  }

  /**
   * Get multiple keys
   */
  async mget<T = any>(keys: string[]): Promise<(T | null)[]> {
    try {
      if (!this.isConnected || !this.client || keys.length === 0) {
        return keys.map(() => null);
      }

      const values = await this.client.mget(...keys);

      return values.map(value => {
        if (value === null) {
          this.metrics.misses++;
          return null;
        }

        this.metrics.hits++;
        try {
          return this.deserializeValue<T>(value);
        } catch (error) {
          return null;
        }
      });
    } catch (error) {
      this.metrics.errors++;
      logger.error('Cache mget error', {
        keys,
        error: (error as Error).message,
      });
      return keys.map(() => null);
    }
  }

  /**
   * Delete keys by pattern
   */
  async delPattern(pattern: string): Promise<number> {
    try {
      if (!this.isConnected || !this.client) {
        return 0;
      }

      const keys = await this.client.keys(pattern);
      if (keys.length === 0) {
        return 0;
      }

      return await this.del(keys);
    } catch (error) {
      logger.error('Cache delete pattern error', {
        pattern,
        error: (error as Error).message,
      });
      return 0;
    }
  }

  /**
   * Get cache hit ratio
   */
  getHitRatio(): number {
    const total = this.metrics.hits + this.metrics.misses;
    return total > 0 ? this.metrics.hits / total : 0;
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  /**
   * Get connection status
   */
  isHealthy(): boolean {
    return this.isConnected;
  }

  /**
   * Flush all cache
   */
  async flushAll(): Promise<boolean> {
    try {
      if (!this.isConnected || !this.client) {
        return false;
      }

      await this.client.flushall();
      return true;
    } catch (error) {
      logger.error('Cache flush error', { error });
      return false;
    }
  }

  /**
   * Get raw Redis client
   */
  getRawClient(): Redis | Cluster | null {
    return this.client;
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearInterval(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    if (this.client) {
      try {
        await this.client.disconnect();
        this.isConnected = false;
        logger.info('Redis disconnected');
      } catch (error) {
        logger.error('Redis disconnect error', { error });
      }
    }
  }

  private serializeValue<T>(value: T): string {
    if (typeof value === 'string') {
      return value;
    }

    try {
      const serialized = JSON.stringify(value);

      if (this.config.enableCompression && serialized.length > 1024) {
        // Compression would be implemented here
        // For now, just return the serialized value
      }

      return serialized;
    } catch (error) {
      logger.error('Failed to serialize cache value', { error });
      throw error;
    }
  }

  private deserializeValue<T>(value: string): T {
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      // If parsing fails, return as string
      return value as unknown as T;
    }
  }
}

// Singleton instance
let redisClient: RedisClientManager | null = null;

/**
 * Get the singleton Redis client
 */
export function getRedisClient(): RedisClientManager {
  if (!redisClient) {
    const config: CacheConfig = {
      redis: {
        keyPrefix: process.env.REDIS_KEY_PREFIX || 'carwash:',
      },
      defaultTTL: process.env.REDIS_DEFAULT_TTL ?
        parseInt(process.env.REDIS_DEFAULT_TTL) : 3600,
      enableMetrics: true,
      enableCompression: process.env.REDIS_ENABLE_COMPRESSION === 'true',
    };

    redisClient = new RedisClientManager(config);
  }

  return redisClient;
}

// Graceful shutdown (Node.js runtime only)
if (typeof process !== 'undefined' && process.on) {
  try {
    process.on('SIGTERM', async () => {
      if (redisClient) {
        await redisClient.disconnect();
      }
    });

    process.on('SIGINT', async () => {
      if (redisClient) {
        await redisClient.disconnect();
      }
    });
  } catch (error) {
    // Graceful degradation for Edge Runtime
    console.warn('Redis shutdown handlers not available in this runtime environment');
  }
}

export { RedisClientManager, type CacheConfig, type CacheMetrics };