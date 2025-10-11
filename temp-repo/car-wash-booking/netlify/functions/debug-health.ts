/**
 * Health Check and Debug Endpoint
 * GET /api/debug-health
 *
 * Provides comprehensive system health and debug information
 */

import { checkDatabaseHealth, withPrisma } from './lib/prisma';
import { dbMonitor } from './lib/db-monitor';
import { createGetHandler } from './lib/request-handler';

/**
 * Get database statistics
 */
async function getDatabaseStats() {
  return await withPrisma(async (prisma) => {
    const [serviceCount, bookingCount, recentBookings] = await Promise.all([
      prisma.service.count(),
      prisma.booking.count(),
      prisma.booking.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          confirmationCode: true,
          createdAt: true,
          status: true,
          paymentStatus: true,
        },
      }),
    ]);

    // Get booking statistics by status
    const bookingsByStatus = await prisma.booking.groupBy({
      by: ['status'],
      _count: true,
    });

    // Get booking statistics by payment status
    const bookingsByPaymentStatus = await prisma.booking.groupBy({
      by: ['paymentStatus'],
      _count: true,
    });

    return {
      serviceCount,
      bookingCount,
      recentBookings,
      bookingsByStatus: bookingsByStatus.reduce((acc, item) => ({
        ...acc,
        [item.status]: item._count,
      }), {}),
      bookingsByPaymentStatus: bookingsByPaymentStatus.reduce((acc, item) => ({
        ...acc,
        [item.paymentStatus]: item._count,
      }), {}),
    };
  });
}

/**
 * Get environment configuration status
 */
function getEnvironmentInfo() {
  return {
    node: {
      version: process.version,
      environment: process.env.NODE_ENV || 'production',
    },
    function: {
      region: process.env.AWS_REGION || 'unknown',
      memoryLimit: process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE || 'unknown',
      timeout: process.env.AWS_LAMBDA_FUNCTION_TIMEOUT || 'unknown',
      runtime: process.env.AWS_EXECUTION_ENV || 'local',
    },
    configuration: {
      database: {
        configured: !!process.env.DATABASE_URL,
        host: process.env.DATABASE_URL
          ? new URL(process.env.DATABASE_URL).hostname
          : 'not configured',
      },
      email: {
        sendgrid: !!process.env.SENDGRID_API_KEY,
        senderEmail: !!process.env.SENDER_EMAIL,
      },
      payment: {
        stripeSecretKey: !!process.env.STRIPE_SECRET_KEY,
        stripeWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
      },
      frontend: {
        url: process.env.FRONTEND_URL || 'not configured',
      },
      cors: {
        allowedOrigins: process.env.ALLOWED_ORIGINS || '*',
      },
    },
  };
}

/**
 * Get memory usage information
 */
function getMemoryInfo() {
  const memoryUsage = process.memoryUsage();
  return {
    rss: {
      bytes: memoryUsage.rss,
      mb: Math.round(memoryUsage.rss / 1024 / 1024),
    },
    heapTotal: {
      bytes: memoryUsage.heapTotal,
      mb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
    },
    heapUsed: {
      bytes: memoryUsage.heapUsed,
      mb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
    },
    external: {
      bytes: memoryUsage.external,
      mb: Math.round(memoryUsage.external / 1024 / 1024),
    },
    arrayBuffers: {
      bytes: memoryUsage.arrayBuffers,
      mb: Math.round(memoryUsage.arrayBuffers / 1024 / 1024),
    },
    heapUsagePercent: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
  };
}

/**
 * Determine overall health status
 */
function determineOverallHealth(dbHealth: any, monitoringReport: any): {
  status: 'healthy' | 'degraded' | 'unhealthy';
  issues: string[];
} {
  const issues: string[] = [];

  if (!dbHealth.healthy) {
    issues.push(`Database connection failed: ${dbHealth.error}`);
  }

  if (dbHealth.latency && dbHealth.latency > 1000) {
    issues.push(`Database latency high: ${dbHealth.latency}ms`);
  }

  if (monitoringReport.status === 'unhealthy') {
    issues.push('Database monitoring reports unhealthy state');
  }

  if (monitoringReport.status === 'degraded') {
    issues.push('Database monitoring reports degraded performance');
  }

  const memoryInfo = getMemoryInfo();
  if (memoryInfo.heapUsagePercent > 90) {
    issues.push(`High memory usage: ${memoryInfo.heapUsagePercent}%`);
  }

  let status: 'healthy' | 'degraded' | 'unhealthy';
  if (!dbHealth.healthy || monitoringReport.status === 'unhealthy') {
    status = 'unhealthy';
  } else if (
    monitoringReport.status === 'degraded' ||
    issues.length > 0 ||
    (dbHealth.latency && dbHealth.latency > 500)
  ) {
    status = 'degraded';
  } else {
    status = 'healthy';
  }

  return { status, issues };
}

/**
 * Main handler for health check
 */
export const handler = createGetHandler(
  {},
  async () => {
    // Gather all health information
    const [dbHealth, dbStats, monitoringReport] = await Promise.all([
      checkDatabaseHealth(),
      getDatabaseStats().catch(err => ({
        error: err.message,
        serviceCount: 0,
        bookingCount: 0,
        recentBookings: [],
      })),
      Promise.resolve(dbMonitor.getHealthReport()),
    ]);

    const slowQueries = dbMonitor.getSlowQueries(500); // Queries over 500ms
    const recentErrors = dbMonitor.getRecentErrors(10); // Last 10 errors
    const envInfo = getEnvironmentInfo();
    const memoryInfo = getMemoryInfo();
    const overallHealth = determineOverallHealth(dbHealth, monitoringReport);

    // Build comprehensive health response
    return {
      status: overallHealth.status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      health: {
        overall: overallHealth,
        database: {
          connected: dbHealth.healthy,
          latency: dbHealth.latency ? `${dbHealth.latency}ms` : null,
          error: dbHealth.error,
        },
        monitoring: {
          status: monitoringReport.status,
          metrics: monitoringReport.metrics,
          issues: monitoringReport.issues,
        },
      },
      statistics: {
        database: dbStats,
        memory: memoryInfo,
      },
      performance: {
        slowQueries: {
          count: slowQueries.length,
          queries: slowQueries.slice(0, 5), // Show top 5 slow queries
        },
        recentErrors: {
          count: recentErrors.length,
          errors: recentErrors.slice(0, 5), // Show last 5 errors
        },
      },
      environment: envInfo,
      endpoints: {
        services: {
          list: '/api/services-index',
          details: '/api/services-id?id={serviceId}',
        },
        bookings: {
          create: '/api/bookings-create',
          retrieve: '/api/bookings-id?id={bookingId}',
          availability: '/api/bookings-availability?date={YYYY-MM-DD}&serviceId={id}',
        },
        payment: {
          createSession: '/api/payment-create-session',
          webhook: '/api/payment-webhook',
        },
        health: {
          simple: '/api/test',
          detailed: '/api/debug-health',
        },
      },
    };
  }
);