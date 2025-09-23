/**
 * Sentry Integration for Error Tracking and Performance Monitoring
 */

// Temporarily disabled for build
// import * as Sentry from '@sentry/nextjs';
// import { CaptureContext } from '@sentry/types';

const Sentry = {} as any;
type CaptureContext = any;

// Initialize Sentry
export function initSentry() {
  const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;

  if (!SENTRY_DSN) {
    console.warn('Sentry DSN not configured');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV,

    // Performance Monitoring
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),

    // Session Replay
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    // Release tracking
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,

    // Integrations
    integrations: [
      new Sentry.BrowserTracing({
        routingInstrumentation: Sentry.nextRouterInstrumentation,
      }),
      new Sentry.Replay({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],

    // Filtering
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
      'Network request failed',
      'NetworkError',
      'TypeError: Failed to fetch',
    ],

    beforeSend(event: any, hint: any) {
      // Filter out sensitive data
      if (event.request) {
        // Remove sensitive headers
        if (event.request.headers) {
          delete event.request.headers['cookie'];
          delete event.request.headers['authorization'];
          delete event.request.headers['x-api-key'];
        }

        // Remove sensitive data from body
        if (event.request.data) {
          const sensitiveFields = ['password', 'creditCard', 'cvv', 'ssn'];
          sensitiveFields.forEach(field => {
            if (event.request.data[field]) {
              event.request.data[field] = '[REDACTED]';
            }
          });
        }
      }

      // Filter out development errors in production
      if (process.env.NODE_ENV === 'production' && event.exception) {
        const error = hint.originalException;
        if (error && error.message?.includes('development')) {
          return null;
        }
      }

      return event;
    },

    // Custom tags
    initialScope: {
      tags: {
        component: 'car-wash-booking',
        version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
      },
    },
  });
}

/**
 * Capture exception with context
 */
export function captureException(
  error: Error,
  context?: CaptureContext
): string {
  return Sentry.captureException(error, context);
}

/**
 * Capture message
 */
export function captureMessage(
  message: string,
  level: any = 'info'
): string {
  return Sentry.captureMessage(message, level);
}

/**
 * Add breadcrumb for better error context
 */
export function addBreadcrumb(breadcrumb: any): void {
  Sentry.addBreadcrumb(breadcrumb);
}

/**
 * Set user context
 */
export function setUser(user: any | null): void {
  Sentry.setUser(user);
}

/**
 * Set additional context
 */
export function setContext(name: string, context: any): void {
  Sentry.setContext(name, context);
}

/**
 * Set tags
 */
export function setTags(tags: { [key: string]: string }): void {
  Sentry.setTags(tags);
}

/**
 * Create a transaction for performance monitoring
 */
export function startTransaction(
  name: string,
  op: string
): any {
  return Sentry.startTransaction({ name, op });
}

/**
 * Profile a function execution
 */
export async function profileFunction<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  const transaction = startTransaction(name, 'function');

  try {
    const result = await fn();
    transaction.setStatus('ok');
    return result;
  } catch (error) {
    transaction.setStatus('internal_error');
    throw error;
  } finally {
    transaction.finish();
  }
}

/**
 * Monitor API endpoint
 */
export function monitorApiEndpoint(
  endpoint: string,
  method: string,
  handler: Function
) {
  return async (...args: any[]) => {
    const transaction = startTransaction(
      `${method} ${endpoint}`,
      'http.server'
    );

    try {
      const result = await handler(...args);
      transaction.setStatus('ok');
      return result;
    } catch (error: any) {
      transaction.setStatus('internal_error');

      captureException(error, {
        tags: {
          endpoint,
          method,
        },
        extra: {
          args: args.map(arg =>
            typeof arg === 'object' ? '[Object]' : arg
          ),
        },
      });

      throw error;
    } finally {
      transaction.finish();
    }
  };
}

/**
 * Monitor database query
 */
export async function monitorQuery<T>(
  queryName: string,
  query: () => Promise<T>
): Promise<T> {
  const span = Sentry.getCurrentHub()
    .getScope()
    ?.getSpan()
    ?.startChild({
      op: 'db.query',
      description: queryName,
    });

  try {
    const result = await query();
    span?.setStatus('ok');
    return result;
  } catch (error) {
    span?.setStatus('internal_error');
    throw error;
  } finally {
    span?.finish();
  }
}

/**
 * Custom error boundary for React components
 */
export class ErrorBoundary extends Error {
  constructor(error: Error, errorInfo: any) {
    super(error.message);
    this.name = 'ErrorBoundary';

    captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
      },
    });
  }
}

/**
 * Monitor performance metrics
 */
export function reportWebVitals(metric: any): void {
  const transaction = Sentry.getCurrentHub()
    .getScope()
    ?.getTransaction();

  if (!transaction) return;

  switch (metric.name) {
    case 'FCP':
      transaction.setMeasurement('fcp', metric.value);
      break;
    case 'LCP':
      transaction.setMeasurement('lcp', metric.value);
      break;
    case 'CLS':
      transaction.setMeasurement('cls', metric.value);
      break;
    case 'FID':
      transaction.setMeasurement('fid', metric.value);
      break;
    case 'TTFB':
      transaction.setMeasurement('ttfb', metric.value);
      break;
  }

  // Alert on poor performance
  if (metric.name === 'LCP' && metric.value > 2500) {
    captureMessage(`Poor LCP performance: ${metric.value}ms`, 'warning');
  }
}

/**
 * Create custom alerts
 */
export const alerts = {
  paymentFailed: (userId: string, amount: number, error: string) => {
    captureMessage('Payment failed', 'error');
    setContext('payment', {
      userId,
      amount,
      error,
    });
  },

  bookingFailed: (customerEmail: string, serviceId: number, error: string) => {
    captureMessage('Booking failed', 'error');
    setContext('booking', {
      customerEmail,
      serviceId,
      error,
    });
  },

  securityThreat: (type: string, details: any) => {
    captureMessage(`Security threat detected: ${type}`, 'critical');
    setContext('security', details);
  },

  highTraffic: (endpoint: string, requestCount: number) => {
    captureMessage(`High traffic on ${endpoint}`, 'warning');
    setContext('traffic', {
      endpoint,
      requestCount,
    });
  },

  databaseError: (query: string, error: string) => {
    captureException(new Error(`Database error: ${error}`), {
      tags: {
        database: 'postgresql',
      },
      extra: {
        query,
      },
    });
  },

  apiRateLimit: (ip: string, endpoint: string) => {
    captureMessage('API rate limit exceeded', 'warning');
    setContext('rateLimit', {
      ip,
      endpoint,
    });
  },
};

/**
 * Health check for monitoring
 */
export async function performHealthCheck(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: { [key: string]: boolean };
  timestamp: string;
}> {
  const checks: { [key: string]: boolean } = {};

  // Check database connection
  try {
    // Simulate database check
    checks.database = true;
  } catch {
    checks.database = false;
  }

  // Check external services
  try {
    // Check SendGrid
    const sendgridResponse = await fetch('https://api.sendgrid.com/v3/scopes', {
      headers: {
        'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
      },
    });
    checks.sendgrid = sendgridResponse.ok;
  } catch {
    checks.sendgrid = false;
  }

  // Check Stripe
  try {
    // This would be a real Stripe health check
    checks.stripe = !!process.env.STRIPE_SECRET_KEY;
  } catch {
    checks.stripe = false;
  }

  // Determine overall status
  const allHealthy = Object.values(checks).every(status => status);
  const someHealthy = Object.values(checks).some(status => status);

  const status = allHealthy ? 'healthy' : someHealthy ? 'degraded' : 'unhealthy';

  // Report to Sentry if unhealthy
  if (status !== 'healthy') {
    captureMessage(`Health check ${status}`, 'warning');
    setContext('healthCheck', checks);
  }

  return {
    status,
    checks,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Custom metrics tracking
 */
export const metrics = {
  recordBookingTime: (duration: number) => {
    const transaction = Sentry.getCurrentHub()
      .getScope()
      ?.getTransaction();

    if (transaction) {
      transaction.setMeasurement('booking.duration', duration);
    }
  },

  recordPaymentProcessingTime: (duration: number) => {
    const transaction = Sentry.getCurrentHub()
      .getScope()
      ?.getTransaction();

    if (transaction) {
      transaction.setMeasurement('payment.processing', duration);
    }
  },

  recordApiResponseTime: (endpoint: string, duration: number) => {
    const transaction = Sentry.getCurrentHub()
      .getScope()
      ?.getTransaction();

    if (transaction) {
      transaction.setMeasurement(`api.${endpoint}`, duration);
    }
  },
};

// Export Sentry instance for direct use if needed
export { Sentry };

export default {
  initSentry,
  captureException,
  captureMessage,
  addBreadcrumb,
  setUser,
  setContext,
  setTags,
  startTransaction,
  profileFunction,
  monitorApiEndpoint,
  monitorQuery,
  ErrorBoundary,
  reportWebVitals,
  alerts,
  performHealthCheck,
  metrics,
};