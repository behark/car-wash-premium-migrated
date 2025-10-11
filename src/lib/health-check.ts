/**
 * Health Check System
 * Monitors application health and service availability
 */

import { PrismaClient } from '@prisma/client';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    [key: string]: {
      status: 'pass' | 'fail' | 'warn';
      message?: string;
      responseTime?: number;
      details?: any;
    };
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
}

export class HealthChecker {
  private startTime: number;
  private prisma: PrismaClient | null = null;

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * Perform all health checks
   */
  async check(): Promise<HealthCheckResult> {
    const checks: HealthCheckResult['checks'] = {};
    let overallStatus: HealthCheckResult['status'] = 'healthy';

    // Database check
    const dbCheck = await this.checkDatabase();
    checks.database = dbCheck;
    if (dbCheck.status === 'fail') {
      overallStatus = 'unhealthy';
    } else if (dbCheck.status === 'warn') {
      overallStatus = 'degraded';
    }

    // Environment variables check
    const envCheck = this.checkEnvironment();
    checks.environment = envCheck;
    if (envCheck.status === 'fail') {
      overallStatus = 'unhealthy';
    }

    // External services check
    const servicesCheck = await this.checkExternalServices();
    checks.externalServices = servicesCheck;
    if (servicesCheck.status === 'fail' && overallStatus === 'healthy') {
      overallStatus = 'degraded';
    }

    // File system check
    const fsCheck = await this.checkFileSystem();
    checks.fileSystem = fsCheck;

    // Memory check
    const memoryCheck = this.checkMemory();
    checks.memory = memoryCheck;
    if (memoryCheck.status === 'warn' && overallStatus === 'healthy') {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      checks,
      environment: this.getEnvironmentInfo(),
    };
  }

  /**
   * Check database connectivity and performance
   */
  private async checkDatabase(): Promise<HealthCheckResult['checks'][string]> {
    try {
      const start = Date.now();

      if (!this.prisma) {
        this.prisma = new PrismaClient({
          datasources: {
            db: {
              url: process.env.DATABASE_URL,
            },
          },
        });
      }

      // Simple query to test connection
      await this.prisma.$queryRaw`SELECT 1`;

      const responseTime = Date.now() - start;

      // Check response time
      if (responseTime > 5000) {
        return {
          status: 'warn',
          message: 'Database responding slowly',
          responseTime,
        };
      }

      return {
        status: 'pass',
        message: 'Database connection successful',
        responseTime,
      };
    } catch (error) {
      return {
        status: 'fail',
        message: `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Check required environment variables
   */
  private checkEnvironment(): HealthCheckResult['checks'][string] {
    const requiredVars = [
      'DATABASE_URL',
      'NEXTAUTH_URL',
      'NEXTAUTH_SECRET',
    ];

    const productionVars = [
      'STRIPE_SECRET_KEY',
      'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
      'SENDGRID_API_KEY',
      'SENDER_EMAIL',
    ];

    const missing: string[] = [];

    // Check required vars
    requiredVars.forEach(varName => {
      if (!process.env[varName]) {
        missing.push(varName);
      }
    });

    // In production, check additional vars
    if (process.env.NODE_ENV === 'production') {
      productionVars.forEach(varName => {
        if (!process.env[varName]) {
          missing.push(varName);
        }
      });
    }

    if (missing.length > 0) {
      return {
        status: 'fail',
        message: `Missing environment variables: ${missing.join(', ')}`,
        details: { missing },
      };
    }

    return {
      status: 'pass',
      message: 'All required environment variables are set',
    };
  }

  /**
   * Check external service connectivity
   */
  private async checkExternalServices(): Promise<HealthCheckResult['checks'][string]> {
    const services: { [key: string]: boolean } = {};
    let allHealthy = true;

    // Check Stripe API
    if (process.env.STRIPE_SECRET_KEY) {
      try {
        const response = await fetch('https://api.stripe.com/v1/charges?limit=1', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
          },
          signal: AbortSignal.timeout(5000),
        });
        services.stripe = response.ok;
        if (!response.ok) allHealthy = false;
      } catch {
        services.stripe = false;
        allHealthy = false;
      }
    }

    // Check SendGrid API
    if (process.env.SENDGRID_API_KEY) {
      try {
        const response = await fetch('https://api.sendgrid.com/v3/scopes', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
          },
          signal: AbortSignal.timeout(5000),
        });
        services.sendgrid = response.ok;
        if (!response.ok) allHealthy = false;
      } catch {
        services.sendgrid = false;
        allHealthy = false;
      }
    }

    if (!allHealthy) {
      const failedServices = Object.entries(services)
        .filter(([_, status]) => !status)
        .map(([name]) => name);

      return {
        status: 'warn',
        message: `Some external services are unavailable: ${failedServices.join(', ')}`,
        details: services,
      };
    }

    return {
      status: 'pass',
      message: 'All external services are reachable',
      details: services,
    };
  }

  /**
   * Check file system write permissions
   */
  private async checkFileSystem(): Promise<HealthCheckResult['checks'][string]> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const os = await import('os');

      const testFile = path.join(os.tmpdir(), `health-check-${Date.now()}.txt`);

      // Try to write and delete a test file
      await fs.writeFile(testFile, 'test');
      await fs.unlink(testFile);

      return {
        status: 'pass',
        message: 'File system is writable',
      };
    } catch (error) {
      return {
        status: 'warn',
        message: `File system check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Check memory usage
   */
  private checkMemory(): HealthCheckResult['checks'][string] {
    const used = process.memoryUsage();
    const heapUsedMB = Math.round(used.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(used.heapTotal / 1024 / 1024);
    const percentage = Math.round((used.heapUsed / used.heapTotal) * 100);

    if (percentage > 90) {
      return {
        status: 'warn',
        message: `High memory usage: ${percentage}%`,
        details: {
          heapUsedMB,
          heapTotalMB,
          percentage,
        },
      };
    }

    return {
      status: 'pass',
      message: `Memory usage: ${percentage}%`,
      details: {
        heapUsedMB,
        heapTotalMB,
        percentage,
      },
    };
  }

  /**
   * Get environment information
   */
  private getEnvironmentInfo(): HealthCheckResult['environment'] {
    const used = process.memoryUsage();

    return {
      nodeVersion: process.version,
      platform: process.platform,
      memory: {
        used: Math.round(used.heapUsed / 1024 / 1024),
        total: Math.round(used.heapTotal / 1024 / 1024),
        percentage: Math.round((used.heapUsed / used.heapTotal) * 100),
      },
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    if (this.prisma) {
      await this.prisma.$disconnect();
      this.prisma = null;
    }
  }
}

/**
 * Express/Connect middleware for health checks
 */
export function healthCheckMiddleware() {
  const checker = new HealthChecker();

  return async (_req: any, res: any) => {
    try {
      const result = await checker.check();
      const statusCode = result.status === 'healthy' ? 200 :
                        result.status === 'degraded' ? 206 : 503;

      res.status(statusCode).json(result);
    } catch (error) {
      res.status(500).json({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    } finally {
      await checker.cleanup();
    }
  };
}