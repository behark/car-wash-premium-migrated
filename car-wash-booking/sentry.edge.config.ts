/**
 * Sentry Edge Configuration
 * This file configures the initialization of Sentry for Edge runtime
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

    // Edge-specific configuration
  });
}