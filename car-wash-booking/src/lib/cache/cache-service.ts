/**
 * Intelligent Cache Service
 * Advanced caching patterns with automatic invalidation and warming strategies
 */

import { getRedisClient } from './redis-client';
import { logger } from '../logger';

export interface CacheOptions {
  ttl?: number;
  tags?: string[];
  condition?: () => boolean;
  serialize?: (value: any) => string;
  deserialize?: (value: string) => any;
  skipCache?: boolean;
}

export interface CacheKey {
  prefix: string;
  id: string | number;
  suffix?: string;
  version?: string;
}

export interface WarmupOptions {
  batchSize?: number;
  concurrency?: number;
  onProgress?: (completed: number, total: number) => void;
  onError?: (error: Error, key: string) => void;
}

export interface CachePattern {
  name: string;
  keyPattern: string;
  ttl: number;
  tags: string[];
  warmupFunction?: () => Promise<void>;
}

/**
 * Intelligent cache service with advanced patterns
 */
export class CacheService {
  private redis = getRedisClient();
  private readonly patterns: Map<string, CachePattern> = new Map();
  private readonly tagMap: Map<string, Set<string>> = new Map();

  constructor() {
    this.initializePatterns();
  }

  /**
   * Get value from cache with intelligent fallback
   */
  async get<T>(
    keyOrObject: string | CacheKey,
    fallbackFn?: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T | null> {
    if (options.skipCache || (options.condition && !options.condition())) {
      if (fallbackFn) {
        return await fallbackFn();
      }
      return null;
    }

    const key = this.buildKey(keyOrObject);

    try {
      // Try to get from cache first
      const cached = await this.redis.get<T>(key);

      if (cached !== null) {
        logger.debug('Cache hit', { key });
        return cached;
      }

      logger.debug('Cache miss', { key });

      // If no cached value and fallback function provided, execute it
      if (fallbackFn) {
        const value = await fallbackFn();

        if (value !== null && value !== undefined) {
          // Cache the result
          await this.set(key, value, options);
        }

        return value;
      }

      return null;
    } catch (error) {
      logger.error('Cache get error', {
        key,
        error: (error as Error).message,
      });

      // If cache fails, try fallback function
      if (fallbackFn) {
        return await fallbackFn();
      }

      return null;
    }
  }

  /**
   * Set value in cache with tagging
   */
  async set<T>(
    keyOrObject: string | CacheKey,
    value: T,
    options: CacheOptions = {}
  ): Promise<boolean> {
    if (options.skipCache || (options.condition && !options.condition())) {
      return false;
    }

    const key = this.buildKey(keyOrObject);

    try {
      // Set the main value
      const success = await this.redis.set(key, value, options.ttl);

      if (success && options.tags && options.tags.length > 0) {
        // Add key to tag sets for invalidation
        await this.addToTagSets(key, options.tags);
      }

      return success;
    } catch (error) {
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
  async del(keyOrObject: string | CacheKey): Promise<boolean> {
    const key = this.buildKey(keyOrObject);

    try {
      const result = await this.redis.del(key);
      return result > 0;
    } catch (error) {
      logger.error('Cache delete error', {
        key,
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    let totalInvalidated = 0;

    try {
      for (const tag of tags) {
        const tagKey = this.getTagKey(tag);
        const keys = await this.redis.getRawClient()?.smembers(tagKey);

        if (keys && keys.length > 0) {
          const deleted = await this.redis.del(keys);
          totalInvalidated += deleted;

          // Remove the tag set itself
          await this.redis.del(tagKey);

          logger.info('Cache invalidated by tag', {
            tag,
            keysInvalidated: deleted,
          });
        }
      }

      return totalInvalidated;
    } catch (error) {
      logger.error('Cache tag invalidation error', {
        tags,
        error: (error as Error).message,
      });
      return totalInvalidated;
    }
  }

  /**
   * Warm up cache with multiple strategies
   */
  async warmup(
    items: Array<{ key: string | CacheKey; fetcher: () => Promise<any>; options?: CacheOptions }>,
    options: WarmupOptions = {}
  ): Promise<void> {
    const {
      batchSize = 10,
      concurrency = 3,
      onProgress,
      onError,
    } = options;

    logger.info('Starting cache warmup', {
      totalItems: items.length,
      batchSize,
      concurrency,
    });

    let completed = 0;

    // Process items in batches with controlled concurrency
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);

      const batchPromises = batch.map(async (item) => {
        try {
          const key = this.buildKey(item.key);
          const exists = await this.redis.exists(key);

          if (!exists) {
            const value = await item.fetcher();
            await this.set(item.key, value, item.options);
          }

          completed++;
          if (onProgress) {
            onProgress(completed, items.length);
          }
        } catch (error) {
          const key = this.buildKey(item.key);
          logger.error('Cache warmup item error', {
            key,
            error: (error as Error).message,
          });

          if (onError) {
            onError(error as Error, key);
          }
        }
      });

      // Limit concurrency within each batch
      const chunks = this.chunkArray(batchPromises, concurrency);
      for (const chunk of chunks) {
        await Promise.all(chunk);
      }
    }

    logger.info('Cache warmup completed', {
      totalItems: items.length,
      completed,
    });
  }

  /**
   * Cache with write-through pattern
   */
  async writeThrough<T>(
    keyOrObject: string | CacheKey,
    value: T,
    persistFn: (value: T) => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    try {
      // First persist to database
      const persistedValue = await persistFn(value);

      // Then cache the result
      await this.set(keyOrObject, persistedValue, options);

      return persistedValue;
    } catch (error) {
      logger.error('Write-through cache error', {
        key: this.buildKey(keyOrObject),
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Cache with write-behind pattern
   */
  async writeBehind<T>(
    keyOrObject: string | CacheKey,
    value: T,
    persistFn: (value: T) => Promise<void>,
    options: CacheOptions = {}
  ): Promise<boolean> {
    try {
      // First cache the value
      const cacheSuccess = await this.set(keyOrObject, value, options);

      // Then persist asynchronously (fire and forget)
      setImmediate(async () => {
        try {
          await persistFn(value);
        } catch (error) {
          logger.error('Write-behind persistence error', {
            key: this.buildKey(keyOrObject),
            error: (error as Error).message,
          });
        }
      });

      return cacheSuccess;
    } catch (error) {
      logger.error('Write-behind cache error', {
        key: this.buildKey(keyOrObject),
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Multi-get with automatic fallback
   */
  async mget<T>(
    keys: Array<string | CacheKey>,
    fallbackFn?: (missingKeys: string[]) => Promise<Map<string, T>>,
    options: CacheOptions = {}
  ): Promise<Map<string, T>> {
    const result = new Map<string, T>();

    if (options.skipCache || (options.condition && !options.condition())) {
      if (fallbackFn) {
        const keyStrings = keys.map(k => this.buildKey(k));
        return await fallbackFn(keyStrings);
      }
      return result;
    }

    try {
      const keyStrings = keys.map(k => this.buildKey(k));
      const values = await this.redis.mget<T>(keyStrings);

      const missingKeys: string[] = [];

      keyStrings.forEach((key, index) => {
        const value = values[index];
        if (value !== null) {
          result.set(key, value);
        } else {
          missingKeys.push(key);
        }
      });

      // If there are missing keys and fallback function provided
      if (missingKeys.length > 0 && fallbackFn) {
        const fallbackValues = await fallbackFn(missingKeys);

        // Cache the fallback values
        const cachePromises = Array.from(fallbackValues.entries()).map(
          ([key, value]) => this.set(key, value, options)
        );

        await Promise.allSettled(cachePromises);

        // Add fallback values to result
        fallbackValues.forEach((value, key) => {
          result.set(key, value);
        });
      }

      return result;
    } catch (error) {
      logger.error('Multi-get cache error', { error: (error as Error).message });

      if (fallbackFn) {
        const keyStrings = keys.map(k => this.buildKey(k));
        return await fallbackFn(keyStrings);
      }

      return result;
    }
  }

  /**
   * Implement cache-aside pattern with automatic refresh
   */
  async cacheAside<T>(
    keyOrObject: string | CacheKey,
    fetcher: () => Promise<T>,
    options: CacheOptions & {
      refreshThreshold?: number; // Refresh when TTL < this many seconds
      backgroundRefresh?: boolean;
    } = {}
  ): Promise<T> {
    const key = this.buildKey(keyOrObject);

    try {
      const cached = await this.redis.get<T>(key);

      if (cached !== null) {
        // Check if we need background refresh
        if (options.backgroundRefresh && options.refreshThreshold) {
          this.checkAndRefreshBackground(key, fetcher, options);
        }

        return cached;
      }

      // Cache miss - fetch and cache
      const value = await fetcher();
      await this.set(key, value, options);

      return value;
    } catch (error) {
      logger.error('Cache-aside error', {
        key,
        error: (error as Error).message,
      });

      // Fallback to direct fetch
      return await fetcher();
    }
  }

  // Service-specific convenience methods

  /**
   * Cache booking availability
   */
  async cacheAvailability(
    serviceId: number,
    date: string,
    timeSlots: any[],
    ttl = 300 // 5 minutes
  ): Promise<boolean> {
    const key = { prefix: 'availability', id: `${serviceId}:${date}` };
    return this.set(key, timeSlots, { ttl, tags: ['availability', `service:${serviceId}`] });
  }

  /**
   * Get cached availability
   */
  async getAvailability(
    serviceId: number,
    date: string,
    fallbackFn?: () => Promise<any[]>
  ): Promise<any[] | null> {
    const key = { prefix: 'availability', id: `${serviceId}:${date}` };
    return this.get(key, fallbackFn);
  }

  /**
   * Cache service details
   */
  async cacheService(service: any, ttl = 3600): Promise<boolean> {
    const key = { prefix: 'service', id: service.id };
    return this.set(key, service, { ttl, tags: ['services', `service:${service.id}`] });
  }

  /**
   * Cache user session
   */
  async cacheSession(sessionId: string, sessionData: any, ttl = 1800): Promise<boolean> {
    const key = { prefix: 'session', id: sessionId };
    return this.set(key, sessionData, { ttl, tags: ['sessions'] });
  }

  /**
   * Invalidate service-related caches
   */
  async invalidateService(serviceId: number): Promise<number> {
    return this.invalidateByTags([`service:${serviceId}`, 'services']);
  }

  /**
   * Invalidate availability caches
   */
  async invalidateAvailability(serviceId?: number): Promise<number> {
    const tags = ['availability'];
    if (serviceId) {
      tags.push(`service:${serviceId}`);
    }
    return this.invalidateByTags(tags);
  }

  // Private helper methods

  private buildKey(keyOrObject: string | CacheKey): string {
    if (typeof keyOrObject === 'string') {
      return keyOrObject;
    }

    const { prefix, id, suffix, version } = keyOrObject;
    let key = `${prefix}:${id}`;

    if (suffix) {
      key += `:${suffix}`;
    }

    if (version) {
      key += `:v${version}`;
    }

    return key;
  }

  private getTagKey(tag: string): string {
    return `tag:${tag}`;
  }

  private async addToTagSets(key: string, tags: string[]): Promise<void> {
    try {
      const client = this.redis.getRawClient();
      if (!client) return;

      const promises = tags.map(tag => {
        const tagKey = this.getTagKey(tag);
        return client.sadd(tagKey, key);
      });

      await Promise.all(promises);
    } catch (error) {
      logger.error('Error adding to tag sets', {
        key,
        tags,
        error: (error as Error).message,
      });
    }
  }

  private async checkAndRefreshBackground<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions
  ): Promise<void> {
    try {
      const client = this.redis.getRawClient();
      if (!client) return;

      const ttl = await client.ttl(key);
      const threshold = options.refreshThreshold || 300; // 5 minutes default

      if (ttl > 0 && ttl < threshold) {
        // Refresh in background
        setImmediate(async () => {
          try {
            const value = await fetcher();
            await this.set(key, value, options);
            logger.debug('Background cache refresh completed', { key });
          } catch (error) {
            logger.error('Background cache refresh failed', {
              key,
              error: (error as Error).message,
            });
          }
        });
      }
    } catch (error) {
      logger.debug('Background refresh check failed', {
        key,
        error: (error as Error).message,
      });
    }
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private initializePatterns(): void {
    // Define caching patterns for different data types
    this.patterns.set('availability', {
      name: 'Availability Cache',
      keyPattern: 'availability:*',
      ttl: 300, // 5 minutes
      tags: ['availability'],
    });

    this.patterns.set('services', {
      name: 'Services Cache',
      keyPattern: 'service:*',
      ttl: 3600, // 1 hour
      tags: ['services'],
    });

    this.patterns.set('sessions', {
      name: 'User Sessions',
      keyPattern: 'session:*',
      ttl: 1800, // 30 minutes
      tags: ['sessions'],
    });
  }

  /**
   * Get cache health and statistics
   */
  getHealthStats() {
    const redisMetrics = this.redis.getMetrics();
    return {
      redis: redisMetrics,
      patterns: Array.from(this.patterns.values()),
      hitRatio: this.redis.getHitRatio(),
      isHealthy: this.redis.isHealthy(),
    };
  }
}

// Export singleton instance
export const cacheService = new CacheService();