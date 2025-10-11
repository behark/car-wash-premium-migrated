import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { RateLimiter } from '@/lib/rate-limiter';
import { validateRequest, detectSuspiciousPatterns, generateRateLimitKey } from './input-validation';
import { z } from 'zod';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

interface ApiHandlerOptions<T = any> {
  methods?: HttpMethod[];
  requireAuth?: boolean;
  requireAdmin?: boolean;
  rateLimit?: {
    requests: number;
    windowMs: number;
  };
  validationSchema?: z.ZodSchema<T>;
  sanitizeInput?: boolean;
}

interface ApiContext {
  user?: any;
  session?: any;
}

type ApiHandler<T = any> = (
  _req: NextApiRequest,
  _res: NextApiResponse,
  _context: ApiContext,
  _validatedData?: T
) => Promise<void> | void;

/**
 * Secure API handler wrapper with built-in security features
 */
export function createApiHandler<T = any>(
  handler: ApiHandler<T>,
  options: ApiHandlerOptions<T> = {}
) {
  const {
    methods = ['GET'],
    requireAuth = false,
    requireAdmin = false,
    rateLimit,
    validationSchema,
    sanitizeInput = true,
  } = options;

  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      // Set security headers
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');

      // Method validation
      if (!methods.includes(req.method as HttpMethod)) {
        return res.status(405).json({
          error: 'Method Not Allowed',
          message: `Only ${methods.join(', ')} methods are allowed`,
        });
      }

      // Rate limiting
      if (rateLimit) {
        const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
                   req.headers['x-real-ip'] as string ||
                   req.socket.remoteAddress ||
                   'unknown';
        const userAgent = req.headers['user-agent'] || null;
        const endpoint = req.url || '/unknown';

        const rateLimiterKey = generateRateLimitKey(ip, userAgent, endpoint);
        const limiter = new RateLimiter(rateLimit.requests, rateLimit.windowMs);

        const isAllowed = await limiter.checkLimit(rateLimiterKey);
        const info = await limiter.getRateLimitInfo(rateLimiterKey);

        // Set rate limit headers
        res.setHeader('X-RateLimit-Limit', String(info.limit));
        res.setHeader('X-RateLimit-Remaining', String(info.remaining));
        res.setHeader('X-RateLimit-Reset', new Date(info.reset).toISOString());

        if (!isAllowed) {
          res.setHeader('Retry-After', String(Math.ceil((info.reset - Date.now()) / 1000)));
          return res.status(429).json({
            error: 'Too Many Requests',
            message: 'Rate limit exceeded. Please try again later.',
            retryAfter: info.reset,
          });
        }
      }

      // Detect suspicious patterns in request data
      if (sanitizeInput && req.method !== 'GET') {
        const requestData = JSON.stringify(req.body);
        const suspicious = detectSuspiciousPatterns(requestData);

        if (suspicious.isSuspicious) {
          console.warn('Suspicious request detected:', {
            ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
            endpoint: req.url,
            patterns: suspicious.patterns,
          });

          return res.status(400).json({
            error: 'Bad Request',
            message: 'Invalid input detected',
          });
        }
      }

      // Input validation
      let validatedData: T | undefined;
      if (validationSchema) {
        const dataToValidate = req.method === 'GET' ? req.query : req.body;
        const validation = validateRequest(dataToValidate, validationSchema);

        if (!validation.success) {
          return res.status(400).json({
            error: 'Validation Error',
            message: 'Invalid input data',
            errors: validation.errors.format(),
          });
        }

        validatedData = validation.data;
      }

      // Authentication check
      const context: ApiContext = {};

      if (requireAuth || requireAdmin) {
        const session = await getServerSession(req, res, authOptions);

        if (!session) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'Authentication required',
          });
        }

        context.session = session;
        context.user = session.user;

        // Admin check
        if (requireAdmin) {
          const userRole = (session.user as any)?.role;
          if (userRole !== 'admin' && userRole !== 'super_admin') {
            return res.status(403).json({
              error: 'Forbidden',
              message: 'Admin privileges required',
            });
          }
        }
      }

      // Call the actual handler
      await handler(req, res, context, validatedData);

    } catch (error) {
      console.error('API Handler Error:', error);

      // Don't leak internal errors
      if (process.env.NODE_ENV === 'production') {
        return res.status(500).json({
          error: 'Internal Server Error',
          message: 'An unexpected error occurred',
        });
      }

      // Development mode - include error details
      return res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  };
}

/**
 * Specialized handler for login endpoints
 */
export function createLoginHandler(
  handler: ApiHandler,
  maxAttempts: number = 5
) {
  return createApiHandler(handler, {
    methods: ['POST'],
    requireAuth: false,
    rateLimit: {
      requests: maxAttempts,
      windowMs: 15 * 60 * 1000, // 15 minutes
    },
  });
}

/**
 * Specialized handler for payment endpoints
 */
export function createPaymentHandler(
  handler: ApiHandler,
  options: Omit<ApiHandlerOptions, 'rateLimit'> = {}
) {
  return createApiHandler(handler, {
    ...options,
    requireAuth: true,
    rateLimit: {
      requests: 10,
      windowMs: 60 * 1000, // 1 minute
    },
  });
}

/**
 * Specialized handler for admin endpoints
 */
export function createAdminHandler(
  handler: ApiHandler,
  options: Omit<ApiHandlerOptions, 'requireAuth' | 'requireAdmin'> = {}
) {
  return createApiHandler(handler, {
    ...options,
    requireAuth: true,
    requireAdmin: true,
  });
}

/**
 * Helper to safely get client IP address
 */
export function getClientIp(req: NextApiRequest): string {
  // Check for various proxy headers
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return (forwarded as string).split(',')[0].trim();
  }

  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return realIp as string;
  }

  const cloudflareIp = req.headers['cf-connecting-ip'];
  if (cloudflareIp) {
    return cloudflareIp as string;
  }

  // Fall back to socket address
  return req.socket.remoteAddress || 'unknown';
}

/**
 * Helper to log security events
 */
export function logSecurityEvent(
  eventType: string,
  details: Record<string, any>,
  req: NextApiRequest
) {
  const event = {
    timestamp: new Date().toISOString(),
    type: eventType,
    ip: getClientIp(req),
    userAgent: req.headers['user-agent'],
    endpoint: req.url,
    method: req.method,
    ...details,
  };

  // In production, send to logging service
  if (process.env.NODE_ENV === 'production') {
    // TODO: Send to logging service (e.g., Sentry, LogRocket, etc.)
    console.log('SECURITY_EVENT:', JSON.stringify(event));
  } else {
    console.warn('Security Event:', event);
  }
}