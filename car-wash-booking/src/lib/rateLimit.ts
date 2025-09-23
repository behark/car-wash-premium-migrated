import { logger } from './logger';

interface RateLimitRule {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: any) => string;
}

interface RequestEntry {
  timestamp: number;
  count: number;
}

class RateLimiter {
  private requests = new Map<string, RequestEntry>();
  private rules: RateLimitRule[];

  constructor(rules: RateLimitRule[]) {
    this.rules = rules;
    // Clean up old entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.requests.entries()) {
      const maxWindow = Math.max(...this.rules.map(rule => rule.windowMs));
      if (now - entry.timestamp > maxWindow) {
        this.requests.delete(key);
      }
    }
  }

  private getKey(req: any, rule: RateLimitRule): string {
    if (rule.keyGenerator) {
      return rule.keyGenerator(req);
    }

    // Default: use IP address
    const forwarded = req.headers['x-forwarded-for'];
    const ip = forwarded ? forwarded.split(',')[0] : (req as any).connection.remoteAddress;
    return `${ip}:${req.url}`;
  }

  public checkLimit(req: any): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();

    for (const rule of this.rules) {
      const key = this.getKey(req, rule);
      const entry = this.requests.get(key);

      if (!entry || now - entry.timestamp > rule.windowMs) {
        // First request or outside window - allow and reset
        this.requests.set(key, { timestamp: now, count: 1 });
        continue;
      }

      if (entry.count >= rule.maxRequests) {
        // Rate limit exceeded
        const retryAfter = Math.ceil((rule.windowMs - (now - entry.timestamp)) / 1000);

        logger.warn('Rate limit exceeded', {
          key,
          count: entry.count,
          maxRequests: rule.maxRequests,
          windowMs: rule.windowMs,
          retryAfter,
          ip: req.headers['x-forwarded-for'] || (req as any).connection.remoteAddress
        });

        return { allowed: false, retryAfter };
      }

      // Increment count
      entry.count++;
    }

    return { allowed: true };
  }
}

// Rate limiting configurations
const BOOKING_RATE_LIMIT = new RateLimiter([
  // Max 5 booking attempts per 15 minutes per IP
  { windowMs: 15 * 60 * 1000, maxRequests: 5 },
  // Max 1 booking attempt per minute per IP
  { windowMs: 60 * 1000, maxRequests: 1 }
]);

const TESTIMONIAL_RATE_LIMIT = new RateLimiter([
  // Max 3 testimonials per hour per IP
  { windowMs: 60 * 60 * 1000, maxRequests: 3 }
]);

const API_RATE_LIMIT = new RateLimiter([
  // Max 100 requests per hour per IP
  { windowMs: 60 * 60 * 1000, maxRequests: 100 }
]);

export function createRateLimitMiddleware(limiter: RateLimiter) {
  return (req: any, res: any, next: () => void) => {
    if (process.env.NODE_ENV === 'development') {
      // Skip rate limiting in development
      return next();
    }

    const result = limiter.checkLimit(req);

    if (!result.allowed) {
      res.status(429).json({
        error: 'Too many requests',
        retryAfter: result.retryAfter
      });
      return;
    }

    next();
  };
}

export { BOOKING_RATE_LIMIT, TESTIMONIAL_RATE_LIMIT, API_RATE_LIMIT };