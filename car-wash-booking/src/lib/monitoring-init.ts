/**
 * Comprehensive Monitoring Initialization
 * Orchestrates all monitoring systems: Sentry, PostHog, Performance, Health Checks
 */

import { initSentry } from './monitoring/sentry';
import { initWebVitals } from '../utils/performance';
import posthog from 'posthog-js';

export interface MonitoringConfig {
  sentry?: {
    dsn?: string;
    enabled: boolean;
    tracesSampleRate?: number;
    replaysSessionSampleRate?: number;
  };
  posthog?: {
    key?: string;
    host?: string;
    enabled: boolean;
    disableSessionRecording?: boolean;
  };
  webVitals?: {
    enabled: boolean;
    thresholds?: {
      FCP?: number;
      LCP?: number;
      FID?: number;
      CLS?: number;
      TTFB?: number;
    };
  };
  healthCheck?: {
    enabled: boolean;
    interval?: number;
  };
}

class MonitoringManager {
  private static instance: MonitoringManager;
  private config: MonitoringConfig;
  private initialized = false;

  private constructor() {
    this.config = this.loadConfig();
  }

  static getInstance(): MonitoringManager {
    if (!MonitoringManager.instance) {
      MonitoringManager.instance = new MonitoringManager();
    }
    return MonitoringManager.instance;
  }

  private loadConfig(): MonitoringConfig {
    const isProduction = process.env.NODE_ENV === 'production';
    const isDevelopment = process.env.NODE_ENV === 'development';

    return {
      sentry: {
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
        enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
        tracesSampleRate: isProduction ? 0.1 : 1.0,
        replaysSessionSampleRate: isProduction ? 0.1 : 0.5,
      },
      posthog: {
        key: process.env.NEXT_PUBLIC_POSTHOG_KEY,
        host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
        enabled: !!process.env.NEXT_PUBLIC_POSTHOG_KEY,
        disableSessionRecording: isDevelopment,
      },
      webVitals: {
        enabled: true,
        thresholds: {
          FCP: 1800, // First Contentful Paint
          LCP: 2500, // Largest Contentful Paint
          FID: 100,  // First Input Delay
          CLS: 0.1,  // Cumulative Layout Shift
          TTFB: 800, // Time to First Byte
        },
      },
      healthCheck: {
        enabled: true,
        interval: 60000, // 1 minute
      },
    };
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('Monitoring systems already initialized');
      return;
    }

    console.log('🔧 Initializing monitoring systems...');

    try {
      // Initialize Sentry for error tracking
      if (this.config.sentry?.enabled) {
        initSentry();
        console.log('✅ Sentry error tracking initialized');
      } else {
        console.log('⚠️ Sentry not configured - error tracking disabled');
      }

      // Initialize PostHog for analytics (client-side only)
      if (typeof window !== 'undefined' && this.config.posthog?.enabled) {
        this.initializePostHog();
        console.log('✅ PostHog analytics initialized');
      } else if (typeof window !== 'undefined') {
        console.log('⚠️ PostHog not configured - analytics disabled');
      }

      // Initialize Web Vitals monitoring
      if (this.config.webVitals?.enabled) {
        this.initializeWebVitals();
        console.log('✅ Web Vitals monitoring initialized');
      }

      // Initialize health check monitoring
      if (this.config.healthCheck?.enabled) {
        this.initializeHealthChecks();
        console.log('✅ Health check monitoring initialized');
      }

      this.initialized = true;
      console.log('🎯 All monitoring systems initialized successfully');

      // Report successful initialization
      this.trackEvent('monitoring_initialized', {
        sentry_enabled: this.config.sentry?.enabled,
        posthog_enabled: this.config.posthog?.enabled,
        web_vitals_enabled: this.config.webVitals?.enabled,
        health_check_enabled: this.config.healthCheck?.enabled,
      });

    } catch (error) {
      console.error('❌ Failed to initialize monitoring systems:', error);

      // Try to report the error to Sentry if it was initialized
      if (this.config.sentry?.enabled) {
        const { captureException } = await import('./monitoring/sentry');
        captureException(error as Error, {
          tags: { component: 'monitoring-init' },
        });
      }
    }
  }

  private initializePostHog(): void {
    if (!this.config.posthog?.key) return;

    posthog.init(this.config.posthog.key, {
      api_host: this.config.posthog.host,
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
      disable_session_recording: this.config.posthog.disableSessionRecording,
    });
  }

  private initializeWebVitals(): void {
    initWebVitals((metric) => {
      // Log in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Web Vitals] ${metric.name}:`, metric.value, metric.rating);
      }

      // Check against thresholds
      const threshold = this.config.webVitals?.thresholds?.[metric.name as keyof typeof this.config.webVitals.thresholds];
      if (threshold && metric.value > threshold) {
        console.warn(`[Performance] ${metric.name} exceeded threshold:`, {
          value: metric.value,
          threshold,
          rating: metric.rating,
        });

        // Report to monitoring systems
        this.trackEvent('performance_threshold_exceeded', {
          metric: metric.name,
          value: metric.value,
          threshold,
          rating: metric.rating,
          page: window.location.pathname,
        });
      }

      // Send to PostHog
      this.trackEvent('web_vital', {
        metric: metric.name,
        value: metric.value,
        rating: metric.rating,
        page: window.location.pathname,
      });

      // Send to Sentry
      if (this.config.sentry?.enabled) {
        import('./monitoring/sentry').then(({ reportWebVitals }) => {
          reportWebVitals(metric);
        });
      }
    });
  }

  private initializeHealthChecks(): void {
    if (typeof window === 'undefined') return; // Server-side only

    const interval = this.config.healthCheck?.interval || 60000;

    // Perform initial health check
    this.performHealthCheck();

    // Schedule regular health checks
    setInterval(() => {
      this.performHealthCheck();
    }, interval);
  }

  private async performHealthCheck(): Promise<void> {
    try {
      const response = await fetch('/api/health');
      const health = await response.json();

      if (health.status !== 'healthy') {
        this.trackEvent('health_check_warning', {
          status: health.status,
          checks: health.checks,
          timestamp: health.timestamp,
        });

        console.warn('[Health Check] System not healthy:', health);
      }

      // Store health status in localStorage for dashboard
      localStorage.setItem('system_health', JSON.stringify({
        ...health,
        lastCheck: new Date().toISOString(),
      }));

    } catch (error) {
      console.error('[Health Check] Failed to check system health:', error);

      this.trackEvent('health_check_failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  }

  trackEvent(eventName: string, properties?: Record<string, any>): void {
    // Send to PostHog
    if (typeof window !== 'undefined' && this.config.posthog?.enabled) {
      posthog.capture(eventName, properties);
    }

    // Send to Sentry as breadcrumb
    if (this.config.sentry?.enabled) {
      import('./monitoring/sentry').then(({ addBreadcrumb }) => {
        addBreadcrumb({
          category: 'user-action',
          message: eventName,
          level: 'info',
          data: properties,
        });
      });
    }
  }

  trackError(error: Error, context?: Record<string, any>): void {
    console.error('Tracked error:', error);

    // Send to Sentry
    if (this.config.sentry?.enabled) {
      import('./monitoring/sentry').then(({ captureException }) => {
        captureException(error, {
          contexts: {
            custom: context,
          },
        });
      });
    }

    // Track in PostHog as event
    if (typeof window !== 'undefined' && this.config.posthog?.enabled) {
      posthog.capture('error', {
        error_message: error.message,
        error_stack: error.stack,
        ...context,
      });
    }
  }

  identifyUser(userId: string, traits?: Record<string, any>): void {
    // Sentry user context
    if (this.config.sentry?.enabled) {
      import('./monitoring/sentry').then(({ setUser }) => {
        setUser({
          id: userId,
          ...traits,
        });
      });
    }

    // PostHog identify
    if (typeof window !== 'undefined' && this.config.posthog?.enabled) {
      posthog.identify(userId, traits);
    }
  }

  getConfig(): MonitoringConfig {
    return { ...this.config };
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

// Export singleton instance
export const monitoringManager = MonitoringManager.getInstance();

// Convenience functions
export async function initializeMonitoring(): Promise<void> {
  return monitoringManager.initialize();
}

export function trackEvent(eventName: string, properties?: Record<string, any>): void {
  monitoringManager.trackEvent(eventName, properties);
}

export function trackError(error: Error, context?: Record<string, any>): void {
  monitoringManager.trackError(error, context);
}

export function identifyUser(userId: string, traits?: Record<string, any>): void {
  monitoringManager.identifyUser(userId, traits);
}

export function trackPageView(pageName: string, properties?: Record<string, any>): void {
  trackEvent('page_view', {
    page: pageName,
    ...properties,
  });
}