/**
 * Logging Module Exports
 * Centralized access to all logging functionality
 */

// Export structured logger
export {
  StructuredLogger,
  structuredLogger,
  type LogLevel,
  type LogContext,
  type LogEntry,
  type LoggerConfig,
  type PerformanceMetrics,
} from './structured-logger';

// Export correlation middleware
export {
  withCorrelationId,
  withAppRouterCorrelation,
  createCorrelationMiddleware,
  withDatabaseCorrelation,
  withExternalServiceCorrelation,
  withCacheCorrelation,
  generateCorrelationId,
  generateRequestId,
  getClientIp,
  extractUserInfo,
  getCurrentRequestContext,
  withRequestContext,
  requestContextStorage,
  type RequestContext,
} from './correlation-middleware';

// Re-export enhanced logger
export { logger } from '../logger';

/**
 * Logging utilities and convenience functions
 */

import { logger } from '../logger';
import {
  getCurrentRequestContext,
  withDatabaseCorrelation,
  withExternalServiceCorrelation,
  withCacheCorrelation,
} from './correlation-middleware';

/**
 * Quick performance measurement decorator
 */
export function LogPerformance(operationName?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const operation = operationName || `${target.constructor.name}.${propertyKey}`;

    if (originalMethod.constructor.name === 'AsyncFunction') {
      descriptor.value = async function (...args: any[]) {
        return logger.measureAsync(operation, () => originalMethod.apply(this, args));
      };
    } else {
      descriptor.value = function (...args: any[]) {
        return logger.measure(operation, () => originalMethod.apply(this, args));
      };
    }

    return descriptor;
  };
}

/**
 * Audit logging decorator
 */
export function LogAudit(action?: string, resource?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const auditAction = action || propertyKey;
    const auditResource = resource || target.constructor.name;

    descriptor.value = async function (...args: any[]) {
      const context = getCurrentRequestContext();

      logger.audit(auditAction, auditResource, context?.userId, {
        method: propertyKey,
        args: args.length,
        correlationId: context?.correlationId,
      });

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

/**
 * Security event logging decorator
 */
export function LogSecurity(
  event: string,
  severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const context = getCurrentRequestContext();

      logger.security(event, severity, {
        method: propertyKey,
        class: target.constructor.name,
        userId: context?.userId,
        correlationId: context?.correlationId,
        ip: context?.ip,
      });

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

/**
 * Database operation logging wrapper
 */
export function logDatabaseOperation<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  return withDatabaseCorrelation(operation, fn);
}

/**
 * External service call logging wrapper
 */
export function logExternalServiceCall<T>(
  serviceName: string,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  return withExternalServiceCorrelation(serviceName, operation, fn);
}

/**
 * Cache operation logging wrapper
 */
export function logCacheOperation<T>(
  operation: string,
  cacheKey: string,
  fn: () => Promise<T>
): Promise<T> {
  return withCacheCorrelation(operation, cacheKey, fn);
}

/**
 * Business logic logging helper
 */
export const BusinessLogger = {
  /**
   * Log booking creation
   */
  bookingCreated(bookingId: number, customerId: string, serviceId: number): void {
    const context = getCurrentRequestContext();
    logger.audit('booking_created', 'booking', context?.userId || customerId, {
      bookingId,
      serviceId,
      customerId,
    });
  },

  /**
   * Log booking cancellation
   */
  bookingCancelled(
    bookingId: number,
    reason: string,
    initiatedBy: 'customer' | 'admin' | 'system'
  ): void {
    const context = getCurrentRequestContext();
    logger.audit('booking_cancelled', 'booking', context?.userId, {
      bookingId,
      reason,
      initiatedBy,
    });
  },

  /**
   * Log payment processing
   */
  paymentProcessed(bookingId: number, amount: number, paymentIntentId: string): void {
    const context = getCurrentRequestContext();
    logger.audit('payment_processed', 'payment', context?.userId, {
      bookingId,
      amount,
      paymentIntentId,
    });
  },

  /**
   * Log service configuration changes
   */
  serviceConfigChanged(serviceId: number, changes: Record<string, any>): void {
    const context = getCurrentRequestContext();
    logger.audit('service_config_changed', 'service', context?.userId, {
      serviceId,
      changes: Object.keys(changes),
      changeCount: Object.keys(changes).length,
    });
  },
};

/**
 * Security event logger
 */
export const SecurityLogger = {
  /**
   * Log authentication attempts
   */
  authenticationAttempt(email: string, success: boolean, reason?: string): void {
    const context = getCurrentRequestContext();
    logger.security(
      success ? 'authentication_success' : 'authentication_failure',
      success ? 'low' : 'medium',
      {
        email,
        success,
        reason,
        ip: context?.ip,
        userAgent: context?.userAgent,
      }
    );
  },

  /**
   * Log authorization failures
   */
  authorizationFailure(userId: string, resource: string, action: string): void {
    logger.security('authorization_failure', 'medium', {
      userId,
      resource,
      action,
    });
  },

  /**
   * Log suspicious activity
   */
  suspiciousActivity(type: string, severity: 'low' | 'medium' | 'high' | 'critical', details: Record<string, any>): void {
    const context = getCurrentRequestContext();
    logger.security(`suspicious_activity_${type}`, severity, {
      ...details,
      ip: context?.ip,
      userAgent: context?.userAgent,
      correlationId: context?.correlationId,
    });
  },

  /**
   * Log rate limiting events
   */
  rateLimitExceeded(identifier: string, limit: number, window: number): void {
    const context = getCurrentRequestContext();
    logger.security('rate_limit_exceeded', 'medium', {
      identifier,
      limit,
      window,
      ip: context?.ip,
      endpoint: context?.endpoint,
    });
  },
};

/**
 * Performance monitoring logger
 */
export const PerformanceLogger = {
  /**
   * Log slow database queries
   */
  slowQuery(query: string, duration: number, threshold: number): void {
    const context = getCurrentRequestContext();
    logger.warn('Slow database query detected', {
      query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
      duration,
      threshold,
      correlationId: context?.correlationId,
      operation: context?.endpoint,
    });
  },

  /**
   * Log memory usage spikes
   */
  highMemoryUsage(usage: NodeJS.MemoryUsage, threshold: number): void {
    logger.warn('High memory usage detected', {
      memoryUsage: usage,
      threshold,
      heapUsedMB: Math.round(usage.heapUsed / 1024 / 1024),
      rssMB: Math.round(usage.rss / 1024 / 1024),
    });
  },

  /**
   * Log API response times
   */
  slowApiResponse(endpoint: string, method: string, duration: number, threshold: number): void {
    const context = getCurrentRequestContext();
    logger.warn('Slow API response detected', {
      endpoint,
      method,
      duration,
      threshold,
      correlationId: context?.correlationId,
    });
  },
};