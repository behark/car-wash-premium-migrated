import { Redis } from 'ioredis';

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

// In-memory store for development/testing
class InMemoryStore {
  private store: Map<string, { count: number; resetTime: number }> = new Map();

  async increment(key: string, windowMs: number): Promise<{ count: number; ttl: number }> {
    const now = Date.now();
    const resetTime = now + windowMs;

    const existing = this.store.get(key);

    if (!existing || existing.resetTime < now) {
      // New window
      this.store.set(key, { count: 1, resetTime });
      return { count: 1, ttl: windowMs };
    }

    // Increment existing
    existing.count++;
    return { count: existing.count, ttl: existing.resetTime - now };
  }

  // Clean up expired entries periodically
  cleanUp() {
    const now = Date.now();
    for (const [key, value] of this.store.entries()) {
      if (value.resetTime < now) {
        this.store.delete(key);
      }
    }
  }
}

export class RateLimiter {
  private redis?: Redis;
  private inMemoryStore?: InMemoryStore;
  private limit: number;
  private windowMs: number;

  constructor(limit: number = 100, windowMs: number = 60 * 1000) {
    this.limit = limit;
    this.windowMs = windowMs;

    // Use Redis if available, otherwise fall back to in-memory store
    if (process.env.REDIS_URL) {
      try {
        this.redis = new Redis(process.env.REDIS_URL, {
          maxRetriesPerRequest: 3,
          retryStrategy: (times) => Math.min(times * 50, 2000),
        });
      } catch (error) {
        console.error('Failed to connect to Redis, using in-memory store:', error);
        this.inMemoryStore = new InMemoryStore();
      }
    } else {
      this.inMemoryStore = new InMemoryStore();
    }

    // Clean up in-memory store periodically
    if (this.inMemoryStore) {
      setInterval(() => this.inMemoryStore?.cleanUp(), 60 * 1000);
    }
  }

  async checkLimit(identifier: string, endpoint?: string): Promise<boolean> {
    const key = `rate_limit:${endpoint || 'global'}:${identifier}`;

    try {
      let count: number;
      let ttl: number;

      if (this.redis) {
        // Redis-based rate limiting
        const multi = this.redis.multi();
        multi.incr(key);
        multi.ttl(key);

        const results = await multi.exec();

        if (!results) {
          return true; // Allow on error
        }

        count = results[0][1] as number;
        ttl = results[1][1] as number;

        if (ttl === -1) {
          // Key exists but no TTL, set it
          await this.redis.expire(key, Math.ceil(this.windowMs / 1000));
        }
      } else if (this.inMemoryStore) {
        // In-memory rate limiting
        const result = await this.inMemoryStore.increment(key, this.windowMs);
        count = result.count;
        ttl = Math.ceil(result.ttl / 1000);
      } else {
        // No store available, allow request
        return true;
      }

      return count <= this.limit;
    } catch (error) {
      console.error('Rate limiting error:', error);
      // Allow request on error to prevent service disruption
      return true;
    }
  }

  async getRateLimitInfo(identifier: string, endpoint?: string): Promise<RateLimitResult> {
    const key = `rate_limit:${endpoint || 'global'}:${identifier}`;

    try {
      let count: number = 0;
      let ttl: number = this.windowMs / 1000;

      if (this.redis) {
        count = parseInt((await this.redis.get(key)) || '0');
        ttl = await this.redis.ttl(key);

        if (ttl === -1 || ttl === -2) {
          ttl = this.windowMs / 1000;
        }
      } else if (this.inMemoryStore) {
        // For simplicity, we'll need to access the store directly
        // In production, you'd want a proper getter method
        count = 0; // Default for now
      }

      const remaining = Math.max(0, this.limit - count);
      const reset = Date.now() + (ttl * 1000);

      return {
        success: count <= this.limit,
        limit: this.limit,
        remaining,
        reset,
      };
    } catch (error) {
      console.error('Error getting rate limit info:', error);
      return {
        success: true,
        limit: this.limit,
        remaining: this.limit,
        reset: Date.now() + this.windowMs,
      };
    }
  }

  async reset(identifier: string, endpoint?: string): Promise<void> {
    const key = `rate_limit:${endpoint || 'global'}:${identifier}`;

    try {
      if (this.redis) {
        await this.redis.del(key);
      }
      // For in-memory store, you'd implement a reset method
    } catch (error) {
      console.error('Error resetting rate limit:', error);
    }
  }

  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
  }
}

// Specialized rate limiters for different scenarios
export class LoginRateLimiter extends RateLimiter {
  constructor() {
    // Strict limits for login attempts: 5 attempts per 15 minutes
    super(5, 15 * 60 * 1000);
  }
}

export class ApiRateLimiter extends RateLimiter {
  constructor() {
    // General API rate limit: 100 requests per minute
    super(100, 60 * 1000);
  }
}

export class PaymentRateLimiter extends RateLimiter {
  constructor() {
    // Strict limits for payment endpoints: 10 requests per minute
    super(10, 60 * 1000);
  }
}