/**
 * Enhanced Health Check API Endpoint
 * GET /api/health
 */

import { NextResponse } from 'next/server';
import { HealthChecker } from '@/lib/health-check';
import { getAPIHealthStatus } from '@/lib/middleware/api-monitoring';

interface EnhancedHealthResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    [key: string]: {
      status: 'pass' | 'fail' | 'warn';
      message?: string;
      responseTime?: number;
      details?: any;
    };
  };
  api: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    totalRequests: number;
    errorRate: number;
    averageResponseTime: number;
    slowRequestRate: number;
    topErrors: Array<{ endpoint: string; count: number }>;
  };
  environment: {
    nodeVersion: string;
    platform: string;
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
  };
  monitoring: {
    sentryEnabled: boolean;
    posthogEnabled: boolean;
    webVitalsEnabled: boolean;
  };
}

export async function GET() {
  const checker = new HealthChecker();

  try {
    // Get basic health check
    const basicHealth = await checker.check();

    // Get API health status
    const apiHealth = getAPIHealthStatus();

    // Enhanced health result
    const result: EnhancedHealthResult = {
      ...basicHealth,
      version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
      api: apiHealth,
      monitoring: {
        sentryEnabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
        posthogEnabled: !!process.env.NEXT_PUBLIC_POSTHOG_KEY,
        webVitalsEnabled: true,
      },
    };

    // Determine overall status considering API health
    if (basicHealth.status === 'unhealthy' || apiHealth.status === 'unhealthy') {
      result.status = 'unhealthy';
    } else if (basicHealth.status === 'degraded' || apiHealth.status === 'degraded') {
      result.status = 'degraded';
    }

    const statusCode = result.status === 'healthy' ? 200 :
                       result.status === 'degraded' ? 206 : 503;

    return NextResponse.json(result, { status: statusCode });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
      },
      { status: 500 }
    );
  } finally {
    await checker.cleanup();
  }
}