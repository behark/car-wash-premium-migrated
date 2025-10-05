/**
 * Correlation ID Middleware
 * Automatic correlation ID generation and context management for requests
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '../logger';
import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  correlationId: string;
  requestId: string;
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  ip?: string;
  startTime: number;
  endpoint: string;
  method: string;
}

// Global context storage for request correlation
const requestContextStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Generate correlation ID with prefix
 */
export function generateCorrelationId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `corr_${timestamp}_${random}`;
}

/**
 * Generate request ID with prefix
 */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `req_${timestamp}_${random}`;
}

/**
 * Get client IP address from request
 */
export function getClientIp(req: NextApiRequest | NextRequest): string {
  // For NextApiRequest
  if ('headers' in req && 'socket' in req) {
    const apiReq = req as NextApiRequest;
    const forwarded = apiReq.headers['x-forwarded-for'];
    if (forwarded) {
      return (forwarded as string).split(',')[0].trim();
    }

    const realIp = apiReq.headers['x-real-ip'];
    if (realIp) {
      return realIp as string;
    }

    const cloudflareIp = apiReq.headers['cf-connecting-ip'];
    if (cloudflareIp) {
      return cloudflareIp as string;
    }

    return apiReq.socket.remoteAddress || 'unknown';
  }

  // For NextRequest (App Router)
  const nextReq = req as NextRequest;
  const forwarded = nextReq.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = nextReq.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  const cloudflareIp = nextReq.headers.get('cf-connecting-ip');
  if (cloudflareIp) {
    return cloudflareIp;
  }

  return nextReq.ip || 'unknown';
}

/**
 * Extract user information from request
 */
export function extractUserInfo(req: NextApiRequest | NextRequest): {
  userId?: string;
  sessionId?: string;
} {
  try {
    // Try to get from headers first
    const headers = 'headers' in req ? req.headers : req.headers;
    const userIdHeader = typeof headers.get === 'function'
      ? headers.get('x-user-id')
      : (headers as any)['x-user-id'];

    const sessionIdHeader = typeof headers.get === 'function'
      ? headers.get('x-session-id')
      : (headers as any)['x-session-id'];

    // Try to get from cookies
    let cookieUserId: string | undefined;
    let cookieSessionId: string | undefined;

    if ('cookies' in req && req.cookies) {
      // NextApiRequest cookies
      const cookies = req.cookies as any;
      cookieUserId = cookies['user-id'];
      cookieSessionId = cookies['session-id'] || cookies['next-auth.session-token'];
    } else if ('cookies' in req) {
      // NextRequest cookies
      const nextReq = req as NextRequest;
      cookieUserId = nextReq.cookies.get('user-id')?.value;
      cookieSessionId = nextReq.cookies.get('session-id')?.value ||
                      nextReq.cookies.get('next-auth.session-token')?.value;
    }

    return {
      userId: userIdHeader || cookieUserId,
      sessionId: sessionIdHeader || cookieSessionId,
    };
  } catch (error) {
    logger.debug('Failed to extract user info', { error });
    return {};
  }
}

/**
 * Get current request context
 */
export function getCurrentRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}

/**
 * Execute function with request context
 */
export function withRequestContext<T>(context: RequestContext, fn: () => T): T {
  return requestContextStorage.run(context, fn);
}

/**
 * Middleware for API routes (Pages Router)
 */
export function withCorrelationId(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void> | void
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const correlationId = (req.headers['x-correlation-id'] as string) || generateCorrelationId();
    const requestId = (req.headers['x-request-id'] as string) || generateRequestId();

    const { userId, sessionId } = extractUserInfo(req);

    const context: RequestContext = {
      correlationId,
      requestId,
      userId,
      sessionId,
      userAgent: req.headers['user-agent'],
      ip: getClientIp(req),
      startTime: Date.now(),
      endpoint: req.url || 'unknown',
      method: req.method || 'unknown',
    };

    // Set response headers
    res.setHeader('X-Correlation-ID', correlationId);
    res.setHeader('X-Request-ID', requestId);

    return requestContextStorage.run(context, async () => {
      // Set up structured logging context
      const contextualLogger = logger
        .withCorrelationId(correlationId)
        .withRequestId(requestId)
        .withOperation(`${req.method} ${req.url}`, 'api');

      if (userId) {
        contextualLogger.withUser(userId, sessionId);
      }

      // Log request start
      contextualLogger.info('Request started', {
        method: req.method,
        url: req.url,
        userAgent: req.headers['user-agent'],
        ip: context.ip,
        userId,
        sessionId,
      });

      try {
        await handler(req, res);

        const duration = Date.now() - context.startTime;

        // Log request completion
        contextualLogger.info('Request completed', {
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration,
        });

      } catch (error) {
        const duration = Date.now() - context.startTime;

        // Log request error
        contextualLogger.error('Request failed', error, {
          method: req.method,
          url: req.url,
          duration,
        });

        throw error;
      }
    });
  };
}

/**
 * Middleware for App Router
 */
export function withAppRouterCorrelation<T>(
  handler: (req: NextRequest, context?: any) => Promise<T>
) {
  return async (req: NextRequest, context?: any): Promise<T> => {
    const correlationId = req.headers.get('x-correlation-id') || generateCorrelationId();
    const requestId = req.headers.get('x-request-id') || generateRequestId();

    const { userId, sessionId } = extractUserInfo(req);

    const requestContext: RequestContext = {
      correlationId,
      requestId,
      userId,
      sessionId,
      userAgent: req.headers.get('user-agent') || undefined,
      ip: getClientIp(req),
      startTime: Date.now(),
      endpoint: req.url || 'unknown',
      method: req.method || 'unknown',
    };

    return requestContextStorage.run(requestContext, async () => {
      // Set up structured logging context
      const contextualLogger = logger
        .withCorrelationId(correlationId)
        .withRequestId(requestId)
        .withOperation(`${req.method} ${req.url}`, 'app-router');

      if (userId) {
        contextualLogger.withUser(userId, sessionId);
      }

      // Log request start
      contextualLogger.info('App Router request started', {
        method: req.method,
        url: req.url,
        userAgent: req.headers.get('user-agent'),
        ip: requestContext.ip,
        userId,
        sessionId,
      });

      try {
        const result = await handler(req, context);

        const duration = Date.now() - requestContext.startTime;

        // Log request completion
        contextualLogger.info('App Router request completed', {
          method: req.method,
          url: req.url,
          duration,
        });

        return result;

      } catch (error) {
        const duration = Date.now() - requestContext.startTime;

        // Log request error
        contextualLogger.error('App Router request failed', error, {
          method: req.method,
          url: req.url,
          duration,
        });

        throw error;
      }
    });
  };
}

/**
 * Next.js middleware for automatic correlation ID injection
 */
export function createCorrelationMiddleware() {
  return (req: NextRequest) => {
    const response = NextResponse.next();

    // Generate or extract correlation ID
    const correlationId = req.headers.get('x-correlation-id') || generateCorrelationId();
    const requestId = req.headers.get('x-request-id') || generateRequestId();

    // Add to response headers
    response.headers.set('X-Correlation-ID', correlationId);
    response.headers.set('X-Request-ID', requestId);

    // Add to request headers for downstream handlers
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-correlation-id', correlationId);
    requestHeaders.set('x-request-id', requestId);

    return response;
  };
}

/**
 * Database operation wrapper with correlation
 */
export async function withDatabaseCorrelation<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const context = getCurrentRequestContext();

  const operationLogger = logger
    .withOperation(operation, 'database')
    .withCorrelationId(context?.correlationId)
    .withRequestId(context?.requestId);

  return operationLogger.measureAsync(
    `db_${operation}`,
    async () => {
      operationLogger.debug('Database operation started', {
        operation,
        correlationId: context?.correlationId,
      });

      try {
        const result = await fn();

        operationLogger.debug('Database operation completed', {
          operation,
          correlationId: context?.correlationId,
        });

        return result;
      } catch (error) {
        operationLogger.error('Database operation failed', error, {
          operation,
          correlationId: context?.correlationId,
        });

        throw error;
      }
    }
  );
}

/**
 * External service call wrapper with correlation
 */
export async function withExternalServiceCorrelation<T>(
  serviceName: string,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const context = getCurrentRequestContext();

  const serviceLogger = logger
    .withOperation(`${serviceName}_${operation}`, 'external-service')
    .withCorrelationId(context?.correlationId)
    .withRequestId(context?.requestId);

  return serviceLogger.measureAsync(
    `ext_${serviceName}_${operation}`,
    async () => {
      serviceLogger.info('External service call started', {
        serviceName,
        operation,
        correlationId: context?.correlationId,
      });

      try {
        const result = await fn();

        serviceLogger.info('External service call completed', {
          serviceName,
          operation,
          correlationId: context?.correlationId,
        });

        return result;
      } catch (error) {
        serviceLogger.error('External service call failed', error, {
          serviceName,
          operation,
          correlationId: context?.correlationId,
        });

        throw error;
      }
    }
  );
}

/**
 * Cache operation wrapper with correlation
 */
export async function withCacheCorrelation<T>(
  operation: string,
  cacheKey: string,
  fn: () => Promise<T>
): Promise<T> {
  const context = getCurrentRequestContext();

  const cacheLogger = logger
    .withOperation(`cache_${operation}`, 'cache')
    .withCorrelationId(context?.correlationId)
    .withRequestId(context?.requestId);

  return cacheLogger.measureAsync(
    `cache_${operation}`,
    async () => {
      cacheLogger.debug('Cache operation started', {
        operation,
        cacheKey,
        correlationId: context?.correlationId,
      });

      try {
        const result = await fn();

        cacheLogger.debug('Cache operation completed', {
          operation,
          cacheKey,
          correlationId: context?.correlationId,
        });

        return result;
      } catch (error) {
        cacheLogger.error('Cache operation failed', error, {
          operation,
          cacheKey,
          correlationId: context?.correlationId,
        });

        throw error;
      }
    }
  );
}

/**
 * Export context storage for advanced usage
 */
export { requestContextStorage };