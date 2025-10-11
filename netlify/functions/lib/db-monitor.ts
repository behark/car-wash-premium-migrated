/**
 * Database Monitoring and Metrics
 * Tracks connection health, query performance, and resource usage
 */

import { PrismaClient } from '@prisma/client';

interface DatabaseMetrics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingConnections: number;
  maxConnections: number;
  queryCount: number;
  slowQueries: number;
  errorCount: number;
  averageQueryTime: number;
  uptime: number;
  lastError?: string;
  lastErrorTime?: Date;
}

interface QueryMetrics {
  query: string;
  duration: number;
  timestamp: Date;
  error?: string;
}

class DatabaseMonitor {
  private static instance: DatabaseMonitor;
  private metrics: DatabaseMetrics;
  private queryHistory: QueryMetrics[] = [];
  private startTime: Date;
  private maxHistorySize = 100;

  private constructor() {
    this.startTime = new Date();
    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingConnections: 0,
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10'),
      queryCount: 0,
      slowQueries: 0,
      errorCount: 0,
      averageQueryTime: 0,
      uptime: 0,
    };
  }

  public static getInstance(): DatabaseMonitor {
    if (!DatabaseMonitor.instance) {
      DatabaseMonitor.instance = new DatabaseMonitor();
    }
    return DatabaseMonitor.instance;
  }

  /**
   * Records a query execution
   */
  public recordQuery(query: string, duration: number, error?: string): void {
    const metric: QueryMetrics = {
      query: query.substring(0, 200), // Truncate long queries
      duration,
      timestamp: new Date(),
      error,
    };

    this.queryHistory.push(metric);

    // Maintain history size
    if (this.queryHistory.length > this.maxHistorySize) {
      this.queryHistory.shift();
    }

    // Update metrics
    this.metrics.queryCount++;

    if (error) {
      this.metrics.errorCount++;
      this.metrics.lastError = error;
      this.metrics.lastErrorTime = new Date();
    }

    // Consider queries over 1000ms as slow
    if (duration > 1000) {
      this.metrics.slowQueries++;
    }

    // Calculate average query time
    const totalTime = this.queryHistory.reduce((sum, q) => sum + q.duration, 0);
    this.metrics.averageQueryTime = Math.round(totalTime / this.queryHistory.length);
  }

  /**
   * Updates connection pool metrics
   */
  public updateConnectionMetrics(
    active: number,
    idle: number,
    waiting: number
  ): void {
    this.metrics.activeConnections = active;
    this.metrics.idleConnections = idle;
    this.metrics.waitingConnections = waiting;
    this.metrics.totalConnections = active + idle;
  }

  /**
   * Gets current metrics
   */
  public getMetrics(): DatabaseMetrics {
    this.metrics.uptime = Math.floor(
      (new Date().getTime() - this.startTime.getTime()) / 1000
    );
    return { ...this.metrics };
  }

  /**
   * Gets slow queries
   */
  public getSlowQueries(threshold: number = 1000): QueryMetrics[] {
    return this.queryHistory
      .filter(q => q.duration > threshold)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);
  }

  /**
   * Gets recent errors
   */
  public getRecentErrors(limit: number = 10): QueryMetrics[] {
    return this.queryHistory
      .filter(q => q.error)
      .slice(-limit)
      .reverse();
  }

  /**
   * Resets metrics
   */
  public reset(): void {
    this.queryHistory = [];
    this.metrics = {
      ...this.metrics,
      queryCount: 0,
      slowQueries: 0,
      errorCount: 0,
      averageQueryTime: 0,
      lastError: undefined,
      lastErrorTime: undefined,
    };
  }

  /**
   * Generates a health report
   */
  public getHealthReport(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    metrics: DatabaseMetrics;
    issues: string[];
    recommendations: string[];
  } {
    const metrics = this.getMetrics();
    const issues: string[] = [];
    const recommendations: string[] = [];
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Check for high error rate
    const errorRate = metrics.queryCount > 0
      ? (metrics.errorCount / metrics.queryCount) * 100
      : 0;

    if (errorRate > 5) {
      issues.push(`High error rate: ${errorRate.toFixed(2)}%`);
      recommendations.push('Review recent errors and check database logs');
      status = 'unhealthy';
    } else if (errorRate > 1) {
      issues.push(`Elevated error rate: ${errorRate.toFixed(2)}%`);
      status = 'degraded';
    }

    // Check for slow queries
    const slowQueryRate = metrics.queryCount > 0
      ? (metrics.slowQueries / metrics.queryCount) * 100
      : 0;

    if (slowQueryRate > 10) {
      issues.push(`High slow query rate: ${slowQueryRate.toFixed(2)}%`);
      recommendations.push('Review and optimize slow queries');
      recommendations.push('Consider adding indexes');
      status = status === 'healthy' ? 'degraded' : status;
    }

    // Check connection pool usage
    const connectionUsage = metrics.maxConnections > 0
      ? (metrics.activeConnections / metrics.maxConnections) * 100
      : 0;

    if (connectionUsage > 90) {
      issues.push(`High connection pool usage: ${connectionUsage.toFixed(2)}%`);
      recommendations.push('Consider increasing max connections');
      recommendations.push('Review connection leak possibilities');
      status = 'unhealthy';
    } else if (connectionUsage > 70) {
      issues.push(`Elevated connection pool usage: ${connectionUsage.toFixed(2)}%`);
      status = status === 'healthy' ? 'degraded' : status;
    }

    // Check waiting connections
    if (metrics.waitingConnections > 0) {
      issues.push(`${metrics.waitingConnections} connections waiting`);
      recommendations.push('Optimize query performance to free connections faster');
      status = status === 'healthy' ? 'degraded' : status;
    }

    // Check average query time
    if (metrics.averageQueryTime > 500) {
      issues.push(`High average query time: ${metrics.averageQueryTime}ms`);
      recommendations.push('Review database indexes');
      recommendations.push('Consider query optimization');
      status = status === 'healthy' ? 'degraded' : status;
    }

    return {
      status,
      metrics,
      issues,
      recommendations,
    };
  }
}

/**
 * Middleware to track Prisma queries
 */
export function createPrismaMonitoringMiddleware(prisma: PrismaClient): void {
  const monitor = DatabaseMonitor.getInstance();

  // Track query metrics
  prisma.$use(async (params, next) => {
    const startTime = Date.now();

    try {
      const result = await next(params);
      const duration = Date.now() - startTime;

      monitor.recordQuery(
        `${params.model}.${params.action}`,
        duration
      );

      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;

      monitor.recordQuery(
        `${params.model}.${params.action}`,
        duration,
        error.message
      );

      throw error;
    }
  });
}

export const dbMonitor = DatabaseMonitor.getInstance();