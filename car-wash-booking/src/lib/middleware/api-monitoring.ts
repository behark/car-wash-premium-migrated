/**
 * API Monitoring Middleware
 * Tracks API performance, errors, and usage patterns
 */

import { NextRequest, NextResponse } from 'next/server';
import { trackEvent, trackError } from '../monitoring-init';

export interface APIRequestMetrics {
  method: string;
  path: string;
  statusCode: number;
  responseTime: number;
  timestamp: Date;
  userAgent?: string;
  ip?: string;
  userId?: string;
  error?: string;
}

class APIMetricsCollector {
  private static instance: APIMetricsCollector;
  private metrics: Map<string, APIRequestMetrics[]> = new Map();
  private readonly maxMetricsPerEndpoint = 1000;

  static getInstance(): APIMetricsCollector {
    if (!APIMetricsCollector.instance) {
      APIMetricsCollector.instance = new APIMetricsCollector();
    }
    return APIMetricsCollector.instance;
  }

  recordMetric(metric: APIRequestMetrics): void {
    const key = `${metric.method}:${metric.path}`;
    const metrics = this.metrics.get(key) || [];

    metrics.push(metric);

    // Keep only recent metrics to prevent memory issues
    if (metrics.length > this.maxMetricsPerEndpoint) {
      metrics.splice(0, metrics.length - this.maxMetricsPerEndpoint);
    }

    this.metrics.set(key, metrics);

    // Track performance events
    this.analyzeMetric(metric);
  }

  private analyzeMetric(metric: APIRequestMetrics): void {
    // Track slow responses
    if (metric.responseTime > 5000) {
      trackEvent('api_slow_response', {
        endpoint: `${metric.method} ${metric.path}`,
        response_time: metric.responseTime,
        status_code: metric.statusCode,
      });
    }

    // Track errors
    if (metric.statusCode >= 400) {
      trackEvent('api_error', {
        endpoint: `${metric.method} ${metric.path}`,
        status_code: metric.statusCode,
        response_time: metric.responseTime,
        error: metric.error,
      });
    }

    // Track successful requests
    if (metric.statusCode >= 200 && metric.statusCode < 300) {
      trackEvent('api_success', {
        endpoint: `${metric.method} ${metric.path}`,
        response_time: metric.responseTime,
        status_code: metric.statusCode,
      });
    }
  }

  getMetrics(endpoint?: string): APIRequestMetrics[] {
    if (endpoint) {
      return this.metrics.get(endpoint) || [];
    }

    const allMetrics: APIRequestMetrics[] = [];
    for (const metrics of this.metrics.values()) {
      allMetrics.push(...metrics);
    }

    return allMetrics.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getEndpointStats(endpoint: string): {
    totalRequests: number;
    averageResponseTime: number;
    errorRate: number;
    slowRequestRate: number;
    statusCodes: Record<number, number>;
  } {
    const metrics = this.metrics.get(endpoint) || [];

    if (metrics.length === 0) {
      return {
        totalRequests: 0,
        averageResponseTime: 0,
        errorRate: 0,
        slowRequestRate: 0,
        statusCodes: {},
      };
    }

    const totalRequests = metrics.length;
    const averageResponseTime = metrics.reduce((sum, m) => sum + m.responseTime, 0) / totalRequests;
    const errorCount = metrics.filter(m => m.statusCode >= 400).length;
    const slowRequestCount = metrics.filter(m => m.responseTime > 1000).length;

    const statusCodes: Record<number, number> = {};
    metrics.forEach(m => {
      statusCodes[m.statusCode] = (statusCodes[m.statusCode] || 0) + 1;
    });

    return {
      totalRequests,
      averageResponseTime,
      errorRate: (errorCount / totalRequests) * 100,
      slowRequestRate: (slowRequestCount / totalRequests) * 100,
      statusCodes,
    };
  }

  getAllEndpointStats(): Record<string, ReturnType<APIMetricsCollector['getEndpointStats']>> {
    const stats: Record<string, ReturnType<APIMetricsCollector['getEndpointStats']>> = {};

    for (const endpoint of this.metrics.keys()) {
      stats[endpoint] = this.getEndpointStats(endpoint);
    }

    return stats;
  }
}

export const apiMetricsCollector = APIMetricsCollector.getInstance();

/**
 * API monitoring middleware for Next.js API routes
 */
export function withAPIMonitoring<T = any>(
  handler: (req: NextRequest, res: NextResponse) => Promise<T> | T
) {
  return async (req: NextRequest, res: NextResponse): Promise<T> => {
    const startTime = Date.now();
    const path = new URL(req.url).pathname;
    const method = req.method;

    // Extract user info if available
    const userAgent = req.headers.get('user-agent') || undefined;
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';

    let statusCode = 200;
    let error: string | undefined;

    try {
      const result = await handler(req, res);

      // Try to extract status code from response
      if (res && typeof res === 'object' && 'status' in res) {
        statusCode = (res as any).status || 200;
      }

      return result;
    } catch (err) {
      statusCode = 500;
      error = err instanceof Error ? err.message : 'Unknown error';

      // Track error
      trackError(err instanceof Error ? err : new Error(String(err)), {
        endpoint: `${method} ${path}`,
        ip,
        userAgent,
      });

      throw err;
    } finally {
      const responseTime = Date.now() - startTime;

      // Record metrics
      const metric: APIRequestMetrics = {
        method,
        path,
        statusCode,
        responseTime,
        timestamp: new Date(),
        userAgent,
        ip,
        error,
      };

      apiMetricsCollector.recordMetric(metric);
    }
  };
}

/**
 * API monitoring middleware for traditional Next.js API routes
 */
export function withAPIMonitoringLegacy(handler: (req: any, res: any) => Promise<void> | void) {
  return async (req: any, res: any): Promise<void> => {
    const startTime = Date.now();
    const path = req.url || req.path || 'unknown';
    const method = req.method || 'GET';

    // Extract user info
    const userAgent = req.headers['user-agent'];
    const ip =
      req.headers['x-forwarded-for'] ||
      req.headers['x-real-ip'] ||
      req.connection?.remoteAddress ||
      'unknown';

    let statusCode = 200;
    let error: string | undefined;

    // Wrap res.status to capture status code
    const originalStatus = res.status;
    res.status = function (code: number) {
      statusCode = code;
      return originalStatus.call(this, code);
    };

    // Wrap res.json and res.send to capture when response is sent
    const originalJson = res.json;
    const originalSend = res.send;
    const originalEnd = res.end;

    const recordMetrics = () => {
      const responseTime = Date.now() - startTime;

      const metric: APIRequestMetrics = {
        method,
        path,
        statusCode,
        responseTime,
        timestamp: new Date(),
        userAgent,
        ip,
        error,
      };

      apiMetricsCollector.recordMetric(metric);
    };

    res.json = function (data: any) {
      recordMetrics();
      return originalJson.call(this, data);
    };

    res.send = function (data: any) {
      recordMetrics();
      return originalSend.call(this, data);
    };

    res.end = function (data?: any) {
      recordMetrics();
      return originalEnd.call(this, data);
    };

    try {
      await handler(req, res);
    } catch (err) {
      statusCode = 500;
      error = err instanceof Error ? err.message : 'Unknown error';

      // Track error
      trackError(err instanceof Error ? err : new Error(String(err)), {
        endpoint: `${method} ${path}`,
        ip,
        userAgent,
      });

      throw err;
    }
  };
}

/**
 * Express-style middleware for database monitoring
 */
export function createDatabaseMonitoringMiddleware() {
  return async (req: any, _res: any, next: any) => {
    // Inject database monitoring into Prisma client if available
    if (req.prisma) {
      const originalQuery = req.prisma.$queryRaw;
      const originalExecute = req.prisma.$executeRaw;

      req.prisma.$queryRaw = async function (...args: any[]) {
        const startTime = Date.now();
        const queryString = args[0]?.toString() || 'unknown';

        try {
          const result = await originalQuery.apply(this, args);
          const duration = Date.now() - startTime;

          // Track slow queries
          if (duration > 1000) {
            trackEvent('slow_database_query', {
              query: queryString.substring(0, 200),
              duration,
              endpoint: `${req.method} ${req.url}`,
            });
          }

          return result;
        } catch (error) {
          trackError(error instanceof Error ? error : new Error(String(error)), {
            query: queryString.substring(0, 200),
            endpoint: `${req.method} ${req.url}`,
          });
          throw error;
        }
      };

      req.prisma.$executeRaw = async function (...args: any[]) {
        const startTime = Date.now();
        const queryString = args[0]?.toString() || 'unknown';

        try {
          const result = await originalExecute.apply(this, args);
          const duration = Date.now() - startTime;

          if (duration > 1000) {
            trackEvent('slow_database_execute', {
              query: queryString.substring(0, 200),
              duration,
              endpoint: `${req.method} ${req.url}`,
            });
          }

          return result;
        } catch (error) {
          trackError(error instanceof Error ? error : new Error(String(error)), {
            query: queryString.substring(0, 200),
            endpoint: `${req.method} ${req.url}`,
          });
          throw error;
        }
      };
    }

    next();
  };
}

/**
 * Rate limiting monitoring
 */
export function trackRateLimit(endpoint: string, ip: string, isBlocked: boolean) {
  if (isBlocked) {
    trackEvent('rate_limit_exceeded', {
      endpoint,
      ip,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * API health check for monitoring dashboard
 */
export function getAPIHealthStatus(): {
  status: 'healthy' | 'degraded' | 'unhealthy';
  totalRequests: number;
  errorRate: number;
  averageResponseTime: number;
  slowRequestRate: number;
  topErrors: Array<{ endpoint: string; count: number }>;
} {
  const allMetrics = apiMetricsCollector.getMetrics();
  const recentMetrics = allMetrics.filter(
    m => Date.now() - m.timestamp.getTime() < 5 * 60 * 1000 // Last 5 minutes
  );

  if (recentMetrics.length === 0) {
    return {
      status: 'healthy',
      totalRequests: 0,
      errorRate: 0,
      averageResponseTime: 0,
      slowRequestRate: 0,
      topErrors: [],
    };
  }

  const totalRequests = recentMetrics.length;
  const errorCount = recentMetrics.filter(m => m.statusCode >= 400).length;
  const errorRate = (errorCount / totalRequests) * 100;
  const averageResponseTime =
    recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / totalRequests;
  const slowRequestCount = recentMetrics.filter(m => m.responseTime > 1000).length;
  const slowRequestRate = (slowRequestCount / totalRequests) * 100;

  // Count errors by endpoint
  const errorsByEndpoint: Record<string, number> = {};
  recentMetrics
    .filter(m => m.statusCode >= 400)
    .forEach(m => {
      const key = `${m.method} ${m.path}`;
      errorsByEndpoint[key] = (errorsByEndpoint[key] || 0) + 1;
    });

  const topErrors = Object.entries(errorsByEndpoint)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([endpoint, count]) => ({ endpoint, count }));

  // Determine status
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (errorRate > 20 || averageResponseTime > 5000) {
    status = 'unhealthy';
  } else if (errorRate > 10 || averageResponseTime > 2000 || slowRequestRate > 20) {
    status = 'degraded';
  }

  return {
    status,
    totalRequests,
    errorRate,
    averageResponseTime,
    slowRequestRate,
    topErrors,
  };
}
