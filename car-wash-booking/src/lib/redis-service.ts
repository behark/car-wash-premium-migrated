/**
 * Production-Ready Redis Caching Service
 * Optimized for car wash booking system with fallback support
 */

import { Redis } from 'ioredis';
import { logger } from './logger';

interface CacheItem<T = any> {
  data: T;
  timestamp: number;
  ttl?: number;
}

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // For cache invalidation
}

class RedisService {
  private static instance: RedisService;
  private redis: Redis | null = null;
  private isConnected = false;
  private fallbackCache = new Map<string, CacheItem>();
  private readonly maxFallbackItems = 1000;

  // Cache TTL constants (in seconds)
  static readonly TTL = {
    SERVICES: 15 * 60, // 15 minutes
    AVAILABILITY: 2 * 60, // 2 minutes
    BOOKINGS: 5 * 60, // 5 minutes
    USER_SESSION: 24 * 60 * 60, // 24 hours
    TESTIMONIALS: 30 * 60, // 30 minutes
    SETTINGS: 60 * 60, // 1 hour
  };

  static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  private constructor() {
    this.initializeRedis();
  }

  private initializeRedis() {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      logger.warn('Redis URL not configured, using in-memory fallback cache');
      return;
    }

    try {
      this.redis = new Redis(redisUrl, {
        // Connection settings optimized for serverless
        lazyConnect: true,
        // retryDelayOnFailover is not a valid option, removed
        enableReadyCheck: false,
        maxRetriesPerRequest: 3,
        connectTimeout: 10000,
        commandTimeout: 5000,

        // Connection pool settings
        family: 4,
        keepAlive: 30000,

        // Reconnection strategy
        retryStrategy(times) {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
      });

      // Connection event handlers
      this.redis.on('connect', () => {
        logger.info('Redis connection established');
        this.isConnected = true;
      });

      this.redis.on('ready', () => {
        logger.info('Redis client ready');
      });

      this.redis.on('error', error => {
        logger.error('Redis connection error:', { error: error.message });
        this.isConnected = false;
      });

      this.redis.on('close', () => {
        logger.warn('Redis connection closed');
        this.isConnected = false;
      });

      this.redis.on('reconnecting', () => {
        logger.info('Redis reconnecting...');
      });
    } catch (error) {
      logger.error('Failed to initialize Redis:', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private cleanupFallbackCache() {
    if (this.fallbackCache.size <= this.maxFallbackItems) return;

    // Remove expired items first
    const now = Date.now();
    for (const [key, item] of this.fallbackCache.entries()) {
      if (item.ttl && now - item.timestamp > item.ttl * 1000) {
        this.fallbackCache.delete(key);
      }
    }

    // If still too many items, remove oldest
    if (this.fallbackCache.size > this.maxFallbackItems) {
      const entries = Array.from(this.fallbackCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

      const toDelete = entries.slice(0, entries.length - this.maxFallbackItems);
      toDelete.forEach(([key]) => this.fallbackCache.delete(key));
    }
  }

  async get<T = any>(key: string): Promise<T | null> {
    try {
      // Try Redis first
      if (this.redis && this.isConnected) {
        const result = await this.redis.get(key);
        if (result) {
          return JSON.parse(result);
        }
      }

      // Fallback to in-memory cache
      const fallbackItem = this.fallbackCache.get(key);
      if (fallbackItem) {
        // Check if expired
        if (fallbackItem.ttl) {
          const elapsed = (Date.now() - fallbackItem.timestamp) / 1000;
          if (elapsed > fallbackItem.ttl) {
            this.fallbackCache.delete(key);
            return null;
          }
        }
        return fallbackItem.data;
      }

      return null;
    } catch (error) {
      logger.error('Cache get error:', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async set<T = any>(key: string, value: T, options: CacheOptions = {}): Promise<boolean> {
    try {
      const ttl = options.ttl || RedisService.TTL.SETTINGS;

      // Try Redis first
      if (this.redis && this.isConnected) {
        await this.redis.setex(key, ttl, JSON.stringify(value));

        // Store tags for invalidation
        if (options.tags) {
          for (const tag of options.tags) {
            await this.redis.sadd(`tag:${tag}`, key);
            await this.redis.expire(`tag:${tag}`, ttl);
          }
        }

        return true;
      }

      // Fallback to in-memory cache
      this.fallbackCache.set(key, {
        data: value,
        timestamp: Date.now(),
        ttl,
      });

      this.cleanupFallbackCache();
      return true;
    } catch (error) {
      logger.error('Cache set error:', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      // Try Redis first
      if (this.redis && this.isConnected) {
        await this.redis.del(key);
      }

      // Also remove from fallback cache
      this.fallbackCache.delete(key);
      return true;
    } catch (error) {
      logger.error('Cache delete error:', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async invalidateByTag(tag: string): Promise<boolean> {
    try {
      if (this.redis && this.isConnected) {
        const keys = await this.redis.smembers(`tag:${tag}`);
        if (keys.length > 0) {
          await this.redis.del(...keys);
          await this.redis.del(`tag:${tag}`);
        }
        return true;
      }

      // For fallback cache, we'd need to implement tag tracking
      // For now, just clear all (not ideal but safe)
      this.fallbackCache.clear();
      return true;
    } catch (error) {
      logger.error('Cache invalidation error:', {
        tag,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async flush(): Promise<boolean> {
    try {
      if (this.redis && this.isConnected) {
        await this.redis.flushdb();
      }

      this.fallbackCache.clear();
      return true;
    } catch (error) {
      logger.error('Cache flush error:', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  // Booking-specific cache methods
  async cacheAvailability(date: string, data: any, ttl = RedisService.TTL.AVAILABILITY) {
    return this.set(`availability:${date}`, data, { ttl, tags: ['availability'] });
  }

  async getAvailability(date: string) {
    return this.get(`availability:${date}`);
  }

  async invalidateAvailability() {
    return this.invalidateByTag('availability');
  }

  async cacheServices(data: any, ttl = RedisService.TTL.SERVICES) {
    return this.set('services:active', data, { ttl, tags: ['services'] });
  }

  async getServices() {
    return this.get('services:active');
  }

  async invalidateServices() {
    return this.invalidateByTag('services');
  }

  async cacheBooking(bookingId: number, data: any, ttl = RedisService.TTL.BOOKINGS) {
    return this.set(`booking:${bookingId}`, data, { ttl, tags: ['bookings'] });
  }

  async getBooking(bookingId: number) {
    return this.get(`booking:${bookingId}`);
  }

  async invalidateBookings() {
    return this.invalidateByTag('bookings');
  }

  // Health check
  async isHealthy(): Promise<boolean> {
    try {
      if (this.redis && this.isConnected) {
        await this.redis.ping();
        return true;
      }

      // Fallback cache is always "healthy"
      return true;
    } catch {
      return false;
    }
  }

  // Get cache statistics
  getStats() {
    return {
      redisConnected: this.isConnected,
      fallbackCacheSize: this.fallbackCache.size,
      hasFallback: !this.redis || !this.isConnected,
    };
  }

  // Graceful shutdown
  async disconnect() {
    if (this.redis) {
      await this.redis.disconnect();
    }
  }
}

// Export singleton instance
export const redisService = RedisService.getInstance();

// Export class for testing
export { RedisService };

// Graceful shutdown handler
if (typeof process !== 'undefined') {
  process.on('beforeExit', () => redisService.disconnect());
  process.on('SIGINT', () => redisService.disconnect());
  process.on('SIGTERM', () => redisService.disconnect());
}

export default redisService;
