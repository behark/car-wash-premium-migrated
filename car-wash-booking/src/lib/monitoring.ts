/**
 * Monitoring and Analytics Integration
 * Sentry for error tracking, PostHog for analytics
 */

import * as Sentry from '@sentry/nextjs';
import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';


/**
 * Initialize monitoring services
 */
export function initializeMonitoring(): void {
  // Initialize Sentry
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',

      // Performance Monitoring
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

      // Session Replay
      replaysSessionSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
      replaysOnErrorSampleRate: 1.0,

      // Release tracking
      release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,

      // Integrations
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllText: true,
          blockAllMedia: false,
          maskAllInputs: true,
        }),
      ],

      // Filtering
      beforeSend(event, hint) {
        // Filter out non-error events in development
        if (process.env.NODE_ENV === 'development' && event.level !== 'error') {
          return null;
        }

        // Filter out specific errors
        const error = hint.originalException;
        if (error && error instanceof Error) {
          // Filter out network errors that are expected
          if (error.message?.includes('NetworkError') ||
              error.message?.includes('Failed to fetch')) {
            return null;
          }
        }

        return event;
      },

      // Additional options
      ignoreErrors: [
        'ResizeObserver loop limit exceeded',
        'Non-Error promise rejection captured',
        'Network request failed',
      ],
    });

    console.log('✅ Sentry monitoring initialized');
  }

  // Initialize PostHog
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
      loaded: (posthog) => {
        if (process.env.NODE_ENV === 'development') {
          posthog.opt_out_capturing();
        }
      },
      autocapture: true,
      capture_pageview: true,
      capture_pageleave: true,
      cross_subdomain_cookie: true,
      persistence: 'localStorage+cookie',
      disable_session_recording: process.env.NODE_ENV === 'development',
    });

    console.log('✅ PostHog analytics initialized');
  }
}

/**
 * Track custom events
 */
export function trackEvent(eventName: string, properties?: Record<string, any>): void {
  // Send to Sentry as breadcrumb
  if (typeof Sentry !== 'undefined') {
    Sentry.addBreadcrumb({
      category: 'user-action',
      message: eventName,
      level: 'info',
      data: properties,
    });
  }

  // Send to PostHog
  if (typeof posthog !== 'undefined') {
    posthog.capture(eventName, properties);
  }
}

/**
 * Track page views
 */
export function trackPageView(pageName: string, properties?: Record<string, any>): void {
  trackEvent('page_view', {
    page: pageName,
    ...properties,
  });
}

/**
 * Identify user for tracking
 */
export function identifyUser(userId: string, traits?: Record<string, any>): void {
  // Sentry user context
  if (typeof Sentry !== 'undefined') {
    Sentry.setUser({
      id: userId,
      ...traits,
    });
  }

  // PostHog identify
  if (typeof posthog !== 'undefined') {
    posthog.identify(userId, traits);
  }
}

/**
 * Track errors
 */
export function trackError(error: Error, context?: Record<string, any>): void {
  console.error('Tracked error:', error);

  // Send to Sentry
  if (typeof Sentry !== 'undefined') {
    Sentry.captureException(error, {
      contexts: {
        custom: context,
      },
    });
  }

  // Track in PostHog as event
  if (typeof posthog !== 'undefined') {
    posthog.capture('error', {
      error_message: error.message,
      error_stack: error.stack,
      ...context,
    });
  }
}

/**
 * Performance monitoring
 */
export function measurePerformance(name: string, fn: () => any): any {
  const startTime = performance.now();

  try {
    const result = fn();

    const duration = performance.now() - startTime;

    // Log to Sentry
    if (typeof Sentry !== 'undefined') {
      Sentry.startSpan(
        {
          op: 'function',
          name: name,
        },
        () => {}
      );
    }

    // Track in PostHog
    trackEvent('performance_measure', {
      name,
      duration,
    });

    return result;
  } catch (error) {
    trackError(error as Error, { function: name });
    throw error;
  }
}

/**
 * Custom hook for error boundaries
 */
export function useErrorHandler() {
  return (error: Error, errorInfo?: { componentStack?: string }) => {
    console.error('Error boundary caught:', error);

    if (typeof Sentry !== 'undefined') {
      Sentry.withScope((scope) => {
        if (errorInfo?.componentStack) {
          scope.setContext('react', {
            componentStack: errorInfo.componentStack,
          });
        }
        Sentry.captureException(error);
      });
    }
  };
}

/**
 * API response monitoring
 */
export async function monitorApiCall<T>(
  name: string,
  apiCall: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await apiCall();

    const duration = Date.now() - startTime;

    // Track successful API call
    trackEvent('api_call_success', {
      endpoint: name,
      duration,
    });

    // Sentry breadcrumb
    if (typeof Sentry !== 'undefined') {
      Sentry.addBreadcrumb({
        category: 'api',
        message: `API call to ${name} succeeded`,
        level: 'info',
        data: { duration },
      });
    }

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    // Track failed API call
    trackEvent('api_call_failure', {
      endpoint: name,
      duration,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Send to Sentry
    if (typeof Sentry !== 'undefined') {
      Sentry.captureException(error, {
        tags: {
          api_endpoint: name,
        },
        extra: {
          duration,
        },
      });
    }

    throw error;
  }
}

/**
 * Database query monitoring
 */
export async function monitorDatabaseQuery<T>(
  queryName: string,
  query: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await query();
    const duration = Date.now() - startTime;

    // Log slow queries
    if (duration > 1000) {
      trackEvent('slow_database_query', {
        query: queryName,
        duration,
      });

      console.warn(`Slow database query: ${queryName} took ${duration}ms`);
    }

    return result;
  } catch (error) {
    trackError(error as Error, {
      database_query: queryName,
    });
    throw error;
  }
}

/**
 * Feature flag tracking
 */
export function trackFeatureFlag(flagName: string, value: boolean): void {
  trackEvent('feature_flag_evaluated', {
    flag: flagName,
    value,
  });
}

/**
 * User session tracking
 */
export function startSession(sessionId: string): void {
  if (typeof Sentry !== 'undefined') {
    Sentry.setContext('session', {
      id: sessionId,
      started_at: new Date().toISOString(),
    });
  }

  trackEvent('session_started', {
    session_id: sessionId,
  });
}

export function endSession(sessionId: string): void {
  trackEvent('session_ended', {
    session_id: sessionId,
  });
}

/**
 * Export monitoring providers for React
 */
export { PostHogProvider };