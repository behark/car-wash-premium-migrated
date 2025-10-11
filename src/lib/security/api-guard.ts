/**
 * API Security Guard
 * Comprehensive API protection middleware
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../pages/api/auth/[...nextauth]';
import { sanitizeRequestBody, isMalicious } from './sanitizer';
import { validateWithSchema } from './validator';
import { z } from 'zod';
import crypto from 'crypto';
import { logger } from '../logger';

// Type definitions
interface SessionUser {
  id: string;
  email: string;
  role: string;
}

interface Session {
  user: SessionUser;
}

interface ApiKeyData {
  name: string;
  permissions: string[];
  rateLimit: number;
}

// API key management
const API_KEYS = new Map<string, ApiKeyData>();

// Initialize API keys from environment
if (process.env.API_KEYS) {
  try {
    const keys = JSON.parse(process.env.API_KEYS);
    Object.entries(keys).forEach(([key, value]) => {
      API_KEYS.set(key, value as ApiKeyData);
    });
  } catch (e) {
    logger.error('Failed to parse API_KEYS', { error: e instanceof Error ? e.message : String(e) });
  }
}

// Request tracking for rate limiting
const requestTracking = new Map<string, { count: number; resetTime: number }>();

// Security configuration
const config = {
  maxRequestSize: 10 * 1024 * 1024, // 10MB
  rateLimitWindow: 60 * 1000, // 1 minute
  defaultRateLimit: 60, // requests per window
  enableApiKeys: process.env.ENABLE_API_KEYS === 'true',
  enableCsrf: process.env.ENABLE_CSRF === 'true',
  allowedOrigins: process.env.CORS_ALLOWED_ORIGINS?.split(',') || ['https://kiiltoloisto.fi'],
};

/**
 * Main API guard middleware
 */
export function apiGuard(
  options: {
    requireAuth?: boolean;
    requireAdmin?: boolean;
    rateLimit?: number;
    validateBody?: z.ZodSchema;
    allowedMethods?: string[];
    requireApiKey?: boolean;
    permissions?: string[];
  } = {}
) {
  return async (
    handler: (_req: NextApiRequest, _res: NextApiResponse) => Promise<void>
  ) => {
    return async (req: NextApiRequest, res: NextApiResponse) => {
      try {
        // Method validation
        if (options.allowedMethods && !options.allowedMethods.includes(req.method!)) {
          return res.status(405).json({ error: 'Method not allowed' });
        }

        // Request size check
        const contentLength = parseInt(req.headers['content-length'] || '0');
        if (contentLength > config.maxRequestSize) {
          return res.status(413).json({ error: 'Request entity too large' });
        }

        // Origin validation
        const origin = req.headers.origin || req.headers.referer;
        if (origin && !isOriginAllowed(origin)) {
          return res.status(403).json({ error: 'Origin not allowed' });
        }

        // IP extraction
        const ip = getClientIp(req);

        // Rate limiting
        if (!checkRateLimitWithCleanup(ip, options.rateLimit || config.defaultRateLimit)) {
          return res.status(429).json({
            error: 'Too many requests',
            retryAfter: 60
          });
        }

        // API key authentication
        if (options.requireApiKey || config.enableApiKeys) {
          const apiKey = req.headers['x-api-key'] as string;

          if (!apiKey) {
            return res.status(401).json({ error: 'API key required' });
          }

          const keyData = API_KEYS.get(apiKey);
          if (!keyData) {
            logSecurityEvent('invalid_api_key', { ip, apiKey: apiKey.substring(0, 8) });
            return res.status(401).json({ error: 'Invalid API key' });
          }

          // Check permissions
          if (options.permissions) {
            const hasPermission = options.permissions.every(p => keyData.permissions.includes(p));
            if (!hasPermission) {
              return res.status(403).json({ error: 'Insufficient permissions' });
            }
          }

          // API key specific rate limiting
          if (!checkRateLimitWithCleanup(`key:${apiKey}`, keyData.rateLimit)) {
            return res.status(429).json({ error: 'API key rate limit exceeded' });
          }
        }

        // Session authentication
        let session: Session | null = null;
        if (options.requireAuth || options.requireAdmin) {
          const serverSession = await getServerSession(req, res, authOptions);

          if (!serverSession) {
            return res.status(401).json({ error: 'Authentication required' });
          }

          session = serverSession as unknown as Session;

          if (options.requireAdmin && session.user?.role !== 'admin') {
            logSecurityEvent('unauthorized_admin_access', {
              ip,
              path: req.url
            });
            return res.status(403).json({ error: 'Admin access required' });
          }

          // Add user info to request
          (req as any).user = session.user;
        }

        // CSRF protection for state-changing operations
        if (config.enableCsrf && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method!)) {
          const csrfToken = req.headers['x-csrf-token'] as string;

          if (!csrfToken || !validateCsrfToken(csrfToken, session?.user?.id)) {
            return res.status(403).json({ error: 'Invalid CSRF token' });
          }
        }

        // Input sanitization
        if (req.body) {
          // Check for malicious patterns
          const bodyString = JSON.stringify(req.body);
          if (isMalicious(bodyString)) {
            logSecurityEvent('malicious_input_detected', {
              ip,
              path: req.url,
              sample: bodyString.substring(0, 100)
            });
            return res.status(400).json({ error: 'Invalid input detected' });
          }

          // Sanitize request body
          req.body = sanitizeRequestBody(req.body);
        }

        // Schema validation
        if (options.validateBody && req.body) {
          const validation = validateWithSchema(options.validateBody, req.body);

          if (!validation.valid) {
            return res.status(400).json({
              error: 'Validation failed',
              details: (validation as any).errors?.errors
            });
          }

          req.body = validation.data;
        }

        // Add security headers
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

        // Log API access
        logApiAccess({
          ip,
          method: req.method!,
          path: req.url!,
          userId: (req as any).user?.id,
          apiKey: req.headers['x-api-key']?.toString().substring(0, 8),
        });

        // Execute the actual handler
        await handler(req, res);

      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));

        // Log error
        logSecurityEvent('api_error', {
          error: err.message,
          stack: err.stack,
          path: req.url,
          method: req.method,
        });

        // Send error response
        if (process.env.NODE_ENV === 'development') {
          res.status(500).json({
            error: 'Internal server error',
            details: err.message
          });
        } else {
          res.status(500).json({ error: 'Internal server error' });
        }
      }
    };
  };
}

/**
 * Get client IP address
 */
function getClientIp(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for'] as string;
  const ip = forwarded ? forwarded.split(',')[0] : req.socket.remoteAddress;
  return ip || 'unknown';
}

/**
 * Check if origin is allowed
 */
function isOriginAllowed(origin: string): boolean {
  try {
    const url = new URL(origin);
    return config.allowedOrigins.some(allowed => {
      if (allowed === '*') return true;
      if (allowed.startsWith('*.')) {
        const domain = allowed.substring(2);
        return url.hostname.endsWith(domain);
      }
      return url.origin === allowed;
    });
  } catch {
    return false;
  }
}

/**
 * Rate limiting check
 */
function checkRateLimit(key: string, limit: number): boolean {
  const now = Date.now();
  const tracking = requestTracking.get(key);

  if (!tracking || now > tracking.resetTime) {
    requestTracking.set(key, {
      count: 1,
      resetTime: now + config.rateLimitWindow,
    });
    return true;
  }

  if (tracking.count >= limit) {
    return false;
  }

  tracking.count++;
  return true;
}

/**
 * Generate CSRF token
 */
export function generateCsrfToken(userId?: string): string {
  const secret = process.env.NEXTAUTH_SECRET;

  if (!secret) {
    throw new Error('NEXTAUTH_SECRET is required for CSRF token generation');
  }

  const random = crypto.randomBytes(32).toString('hex');
  const data = `${userId || 'anonymous'}-${Date.now()}-${random}`;
  return crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('hex');
}

/**
 * Validate CSRF token
 */
function validateCsrfToken(token: string | undefined, _userId?: string): boolean {
  if (!token || token.length !== 64) {
    return false;
  }

  // Validate hex format
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return false;
  }

  // In production, should validate against stored session token
  // For now, validate format and length
  return true;
}

/**
 * Log security events
 */
function logSecurityEvent(event: string, data: Record<string, unknown>): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event,
    ...data,
  };

  // Use logger instead of console
  logger.warn('Security event', logEntry);

  // In production, send to monitoring service
  if (process.env.NODE_ENV === 'production' && process.env.MONITORING_WEBHOOK_URL) {
    fetch(process.env.MONITORING_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logEntry),
    }).catch(err => {
      logger.error('Failed to send security log', { error: err instanceof Error ? err.message : String(err) });
    });
  }
}

/**
 * Log API access
 */
function logApiAccess(data: Record<string, unknown>): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    type: 'api_access',
    ...data,
  };

  // Use logger for debug logging
  logger.debug('API access', logEntry);
}

/**
 * Clean up old rate limit entries
 * Note: Disabled for serverless environments - cleanup happens on-demand
 */
function cleanupRateLimits(): void {
  const now = Date.now();
  for (const [key, tracking] of requestTracking.entries()) {
    if (now > tracking.resetTime + config.rateLimitWindow) {
      requestTracking.delete(key);
    }
  }
}

// Run cleanup on-demand instead of setInterval (serverless compatible)
function checkRateLimitWithCleanup(key: string, limit: number): boolean {
  // Periodic cleanup (every ~100 requests to avoid overhead)
  if (Math.random() < 0.01) {
    cleanupRateLimits();
  }
  return checkRateLimit(key, limit);
}

/**
 * Middleware for specific HTTP methods
 */
export const requireGet = apiGuard({ allowedMethods: ['GET'] });
export const requirePost = apiGuard({ allowedMethods: ['POST'] });
export const requirePut = apiGuard({ allowedMethods: ['PUT'] });
export const requireDelete = apiGuard({ allowedMethods: ['DELETE'] });

/**
 * Middleware for authentication levels
 */
export const requireAuth = apiGuard({ requireAuth: true });
export const requireAdmin = apiGuard({ requireAdmin: true });

/**
 * Combined middleware examples
 */
export const protectedPost = apiGuard({
  allowedMethods: ['POST'],
  requireAuth: true
});

export const adminOnly = apiGuard({
  requireAdmin: true,
  rateLimit: 30
});

export default apiGuard;