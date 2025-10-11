/**
 * Redis Client Configuration for Production Deployment
 * Handles caching, session management, and real-time features
 */

import Redis from 'ioredis';

// Redis client configuration
const redisOptions = {
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxRetriesPerRequest: null,
  lazyConnect: true,
  connectTimeout: 10000,
  commandTimeout: 5000,
  ...(process.env.NODE_ENV === 'production' && {
    enableAutoPipelining: true,
    maxRetriesPerRequest: 3,
  }),
};

// Create Redis client instance
let redis: Redis | null = null;

export const getRedisClient = (): Redis | null => {
  if (!process.env.REDIS_URL) {
    console.log('Redis not configured - caching disabled');
    return null;
  }

  if (!redis) {
    try {
      redis = new Redis(process.env.REDIS_URL, redisOptions);

      redis.on('connect', () => {
        console.log('Redis connected successfully');
      });

      redis.on('error', (error) => {
        console.error('Redis connection error:', error.message);
      });

      redis.on('close', () => {
        console.log('Redis connection closed');
      });

    } catch (error) {
      console.error('Failed to initialize Redis:', error);
      return null;
    }
  }

  return redis;
};

// Cache utility functions
export class RedisCache {
  private client: Redis | null;
  private keyPrefix: string;
  private defaultTTL: number;
  private compressionEnabled: boolean;

  constructor() {
    this.client = getRedisClient();
    this.keyPrefix = process.env.REDIS_KEY_PREFIX || 'carwash:';
    this.defaultTTL = parseInt(process.env.REDIS_DEFAULT_TTL || '3600');
    this.compressionEnabled = process.env.REDIS_ENABLE_COMPRESSION === 'true';
  }

  private getKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.client) return null;

    try {
      const value = await this.client.get(this.getKey(key));
      if (!value) return null;

      // Handle compressed data if enabled
      const data = this.compressionEnabled ?
        JSON.parse(value) :
        JSON.parse(value);

      return data as T;
    } catch (error) {
      console.error('Redis GET error:', error);
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<boolean> {
    if (!this.client) return false;

    try {
      const serializedValue = JSON.stringify(value);
      const expirationTime = ttl || this.defaultTTL;

      if (expirationTime > 0) {
        await this.client.setex(this.getKey(key), expirationTime, serializedValue);
      } else {
        await this.client.set(this.getKey(key), serializedValue);
      }

      return true;
    } catch (error) {
      console.error('Redis SET error:', error);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    if (!this.client) return false;

    try {
      await this.client.del(this.getKey(key));
      return true;
    } catch (error) {
      console.error('Redis DEL error:', error);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.client) return false;

    try {
      const result = await this.client.exists(this.getKey(key));
      return result === 1;
    } catch (error) {
      console.error('Redis EXISTS error:', error);
      return false;
    }
  }

  async incr(key: string, ttl?: number): Promise<number | null> {
    if (!this.client) return null;

    try {
      const result = await this.client.incr(this.getKey(key));

      if (ttl && result === 1) {
        await this.client.expire(this.getKey(key), ttl);
      }

      return result;
    } catch (error) {
      console.error('Redis INCR error:', error);
      return null;
    }
  }

  async expire(key: string, ttl: number): Promise<boolean> {
    if (!this.client) return false;

    try {
      const result = await this.client.expire(this.getKey(key), ttl);
      return result === 1;
    } catch (error) {
      console.error('Redis EXPIRE error:', error);
      return false;
    }
  }

  async flushPattern(pattern: string): Promise<boolean> {
    if (!this.client) return false;

    try {
      const keys = await this.client.keys(this.getKey(pattern));
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
      return true;
    } catch (error) {
      console.error('Redis FLUSH PATTERN error:', error);
      return false;
    }
  }

  // Real-time booking specific methods
  async setBookingSlotCount(date: string, timeSlot: string, count: number): Promise<boolean> {
    const key = `booking:slots:${date}:${timeSlot}`;
    return this.set(key, count, 86400); // 24 hours TTL
  }

  async getBookingSlotCount(date: string, timeSlot: string): Promise<number | null> {
    const key = `booking:slots:${date}:${timeSlot}`;
    const result = await this.get<number>(key);
    return result ?? 0;
  }

  async incrementBookingSlot(date: string, timeSlot: string): Promise<number | null> {
    const key = `booking:slots:${date}:${timeSlot}`;
    return this.incr(key, 86400);
  }

  // Session management
  async setUserSession(userId: string, sessionData: any): Promise<boolean> {
    const key = `session:${userId}`;
    return this.set(key, sessionData, 3600); // 1 hour TTL
  }

  async getUserSession(userId: string): Promise<any | null> {
    const key = `session:${userId}`;
    return this.get(key);
  }

  // Rate limiting
  async checkRateLimit(identifier: string, limit: number, windowMs: number): Promise<{ allowed: boolean; remaining: number }> {
    if (!this.client) return { allowed: true, remaining: limit };

    const key = `ratelimit:${identifier}`;
    const windowSeconds = Math.floor(windowMs / 1000);

    try {
      const current = await this.incr(key, windowSeconds);
      if (current === null) return { allowed: true, remaining: limit };

      const remaining = Math.max(0, limit - current);
      const allowed = current <= limit;

      return { allowed, remaining };
    } catch (error) {
      console.error('Rate limit check error:', error);
      return { allowed: true, remaining: limit };
    }
  }

  // Health check
  async healthCheck(): Promise<{ status: 'pass' | 'fail'; responseTime: number; error?: string }> {
    const start = Date.now();

    if (!this.client) {
      return {
        status: 'fail',
        responseTime: 0,
        error: 'Redis client not initialized'
      };
    }

    try {
      await this.client.ping();
      const responseTime = Date.now() - start;

      return {
        status: 'pass',
        responseTime
      };
    } catch (error) {
      return {
        status: 'fail',
        responseTime: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Export singleton instance
export const cache = new RedisCache();

// Graceful shutdown
process.on('SIGTERM', () => {
  if (redis) {
    redis.disconnect();
  }
});

process.on('SIGINT', () => {
  if (redis) {
    redis.disconnect();
  }
});