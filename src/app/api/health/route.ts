/**
 * Comprehensive Health Check API Endpoint for Production Monitoring
 * GET /api/health
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma-simple';
import { cache } from '@/lib/redis';

interface HealthCheck {
  status: 'pass' | 'fail' | 'warn';
  message: string;
  responseTime?: number;
  details?: any;
}

interface HealthResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  checks: {
    database: HealthCheck;
    redis?: HealthCheck;
    services: HealthCheck;
    external?: HealthCheck;
  };
  system: {
    memory: {
      used: number;
      total: number;
      percentage: number;
      rss: number;
      external: number;
    };
    node: {
      version: string;
      platform: string;
      arch: string;
    };
  };
}

async function checkDatabase(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    // Check database connectivity
    await prisma.$queryRaw`SELECT 1`;

    // Check if critical tables exist and are accessible
    const serviceCount = await prisma.service.count();
    const userCount = await prisma.user.count();

    const responseTime = Date.now() - start;

    return {
      status: responseTime > 5000 ? 'warn' : 'pass',
      message: 'Database connection successful',
      responseTime,
      details: {
        services: serviceCount,
        users: userCount,
        latency: `${responseTime}ms`
      }
    };
  } catch (error: any) {
    return {
      status: 'fail',
      message: `Database connection failed: ${error.message}`,
      responseTime: Date.now() - start
    };
  }
}

async function checkRedis(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const result = await cache.healthCheck();

    if (result.status === 'pass') {
      return {
        status: 'pass',
        message: 'Redis connection successful',
        responseTime: result.responseTime,
        details: {
          configured: !!process.env.REDIS_URL,
          latency: `${result.responseTime}ms`
        }
      };
    } else {
      return {
        status: 'fail',
        message: `Redis connection failed: ${result.error}`,
        responseTime: result.responseTime
      };
    }
  } catch (error: any) {
    return {
      status: 'fail',
      message: `Redis check failed: ${error.message}`,
      responseTime: Date.now() - start
    };
  }
}

async function checkServices(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    // Check if essential services are configured
    const checks = {
      stripe: !!process.env.STRIPE_SECRET_KEY,
      email: !!process.env.SENDGRID_API_KEY,
      auth: !!process.env.NEXTAUTH_SECRET,
      database: !!process.env.DATABASE_URL,
      redis: !!process.env.REDIS_URL
    };

    const failedServices = Object.entries(checks)
      .filter(([_, isConfigured]) => !isConfigured)
      .map(([service]) => service);

    const responseTime = Date.now() - start;

    if (failedServices.length > 0) {
      return {
        status: 'warn',
        message: `Some services not configured: ${failedServices.join(', ')}`,
        responseTime,
        details: checks
      };
    }

    return {
      status: 'pass',
      message: 'All essential services configured',
      responseTime,
      details: checks
    };
  } catch (error: any) {
    return {
      status: 'fail',
      message: `Service check failed: ${error.message}`,
      responseTime: Date.now() - start
    };
  }
}

export async function GET() {
  const timestamp = new Date().toISOString();
  const uptime = Math.floor(process.uptime());

  try {
    // Run health checks in parallel
    const [databaseCheck, redisCheck, servicesCheck] = await Promise.all([
      checkDatabase(),
      checkRedis(),
      checkServices()
    ]);

    // System information
    const memUsage = process.memoryUsage();
    const memUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const memTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);

    // Determine overall status
    const allChecks = [databaseCheck, redisCheck, servicesCheck];
    const hasFailures = allChecks.some(check => check.status === 'fail');
    const hasWarnings = allChecks.some(check => check.status === 'warn');

    const overallStatus = hasFailures ? 'unhealthy' : hasWarnings ? 'degraded' : 'healthy';
    const statusCode = hasFailures ? 503 : hasWarnings ? 200 : 200;

    const response: HealthResponse = {
      status: overallStatus,
      timestamp,
      uptime,
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'unknown',
      checks: {
        database: databaseCheck,
        redis: redisCheck,
        services: servicesCheck
      },
      system: {
        memory: {
          used: memUsedMB,
          total: memTotalMB,
          percentage: Math.round((memUsedMB / memTotalMB) * 100),
          rss: Math.round(memUsage.rss / 1024 / 1024),
          external: Math.round(memUsage.external / 1024 / 1024)
        },
        node: {
          version: process.version,
          platform: process.platform,
          arch: process.arch
        }
      }
    };

    return NextResponse.json(response, { status: statusCode });

  } catch (error: any) {
    // Fallback response if health check itself fails
    const response: Partial<HealthResponse> = {
      status: 'unhealthy',
      timestamp,
      uptime,
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'unknown',
      checks: {
        database: {
          status: 'fail',
          message: 'Health check system failure'
        },
        services: {
          status: 'fail',
          message: `Health check error: ${error.message}`
        }
      }
    };

    return NextResponse.json(response, { status: 503 });
  }
}