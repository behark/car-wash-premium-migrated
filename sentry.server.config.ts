/**
 * Sentry Server Configuration
 * This file configures the initialization of Sentry for the server side
 */

import * as Sentry from '@sentry/nextjs';

// Only initialize if DSN is provided
if (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',

    // Performance Monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Release tracking
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,

    // Debug
    debug: process.env.NODE_ENV === 'development',

    // Integrations
    integrations: [
      // Automatically instrument Node.js libraries and frameworks
      Sentry.extraErrorDataIntegration(),
    ],

    // Filtering
    beforeSend(event, _hint) {
      // Filter out non-error events in development
      if (process.env.NODE_ENV === 'development' && event.level !== 'error') {
        return null;
      }

      // Don't send events for database connection issues in development
      if (process.env.NODE_ENV === 'development' &&
          event.exception?.values?.[0]?.value?.includes('database')) {
        return null;
      }

      return event;
    },

    // Ignore specific errors
    ignoreErrors: [
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'Error: socket hang up',
    ],
  });
}