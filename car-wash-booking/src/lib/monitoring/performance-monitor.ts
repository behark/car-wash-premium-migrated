/**
 * Enterprise Performance Monitor
 * Advanced performance monitoring with intelligent alerting and optimization recommendations
 */

import { logger } from '../logger';
import { getDbMetrics } from '../prisma';
import { getRedisClient } from '../cache/redis-client';

export interface PerformanceMetrics {
  system: {
    cpu: NodeJS.CpuUsage;
    memory: NodeJS.MemoryUsage;
    uptime: number;
    loadAverage: number[];
    timestamp: Date;
  };
  database: {
    connectionCount: number;
    activeQueries: number;
    avgQueryTime: number;
    slowQueries: number;
    errorRate: number;
    poolUtilization: number;
  };
  cache: {
    hitRatio: number;
    memoryUsage: number;
    connectionCount: number;
    operationsPerSecond: number;
    errorRate: number;
  };
  api: {
    requestsPerSecond: number;
    avgResponseTime: number;
    errorRate: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    activeConnections: number;
  };
  business: {
    bookingsPerHour: number;
    conversionRate: number;
    revenuePerHour: number;
    customerSatisfaction: number;
    capacityUtilization: number;
  };
}

export interface PerformanceAlert {
  id: string;
  type: 'performance' | 'availability' | 'error_rate' | 'capacity' | 'security';
  severity: 'info' | 'warning' | 'critical' | 'emergency';
  metric: string;
  threshold: number;
  currentValue: number;
  message: string;
  component: string;
  timestamp: Date;
  resolved?: boolean;
  resolvedAt?: Date;
  acknowledgements: Array<{
    userId: string;
    timestamp: Date;
    note?: string;
  }>;
  actions: Array<{
    type: 'auto_scale' | 'restart_service' | 'clear_cache' | 'notify_team';
    status: 'pending' | 'executing' | 'completed' | 'failed';
    timestamp: Date;
    result?: any;
  }>;
}

export interface PerformanceThresholds {
  system: {
    maxCpuPercentage: number;
    maxMemoryPercentage: number;
    maxLoadAverage: number;
  };
  database: {
    maxQueryTime: number;
    maxSlowQueries: number;
    maxErrorRate: number;
    maxPoolUtilization: number;
  };
  cache: {
    minHitRatio: number;
    maxMemoryUsage: number;
    maxErrorRate: number;
  };
  api: {
    maxResponseTime: number;
    maxErrorRate: number;
    maxP95ResponseTime: number;
  };
  business: {
    minConversionRate: number;
    maxCapacityUtilization: number;
  };
}

export interface OptimizationRecommendation {
  id: string;
  category: 'performance' | 'cost' | 'scalability' | 'reliability';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  recommendation: string;
  automatable: boolean;
  estimatedROI?: string;
  relatedMetrics: string[];
  implementationSteps: string[];
  risks: string[];
}

/**
 * Comprehensive performance monitoring system
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetrics;
  private thresholds: PerformanceThresholds;
  private alerts = new Map<string, PerformanceAlert>();
  private metricsHistory: PerformanceMetrics[] = [];
  private maxHistorySize = 1000;
  private monitoringInterval?: NodeJS.Timeout;
  private apiMetrics = new Map<string, {
    requestCount: number;
    totalResponseTime: number;
    errorCount: number;
    responseTimes: number[];
  }>();

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  constructor() {
    this.initializeThresholds();
    this.initializeMetrics();
    this.startMonitoring();
  }

  /**
   * Record API request metrics
   */
  recordApiRequest(
    endpoint: string,
    method: string,
    responseTime: number,
    statusCode: number
  ): void {
    const key = `${method} ${endpoint}`;
    const existing = this.apiMetrics.get(key) || {
      requestCount: 0,
      totalResponseTime: 0,
      errorCount: 0,
      responseTimes: [],
    };

    existing.requestCount++;
    existing.totalResponseTime += responseTime;

    if (statusCode >= 400) {
      existing.errorCount++;
    }

    existing.responseTimes.push(responseTime);

    // Keep only last 100 response times for percentile calculation
    if (existing.responseTimes.length > 100) {
      existing.responseTimes.shift();
    }

    this.apiMetrics.set(key, existing);
  }

  /**
   * Get current performance metrics
   */
  async getCurrentMetrics(): Promise<PerformanceMetrics> {
    const systemMetrics = this.collectSystemMetrics();
    const databaseMetrics = await this.collectDatabaseMetrics();
    const cacheMetrics = await this.collectCacheMetrics();
    const apiMetrics = this.collectApiMetrics();
    const businessMetrics = await this.collectBusinessMetrics();

    const metrics: PerformanceMetrics = {
      system: systemMetrics,
      database: databaseMetrics,
      cache: cacheMetrics,
      api: apiMetrics,
      business: businessMetrics,
    };

    this.metrics = metrics;
    this.addToHistory(metrics);

    return metrics;
  }

  /**
   * Generate optimization recommendations
   */
  async generateRecommendations(): Promise<OptimizationRecommendation[]> {
    const metrics = await this.getCurrentMetrics();
    const recommendations: OptimizationRecommendation[] = [];

    // Database performance recommendations
    if (metrics.database.avgQueryTime > 500) {
      recommendations.push({
        id: 'optimize_database_queries',
        category: 'performance',
        priority: 'high',
        title: 'Optimize Database Queries',
        description: `Average query time is ${metrics.database.avgQueryTime}ms, above optimal threshold`,
        impact: 'Reduce API response times by 40-60%',
        effort: 'medium',
        recommendation: 'Analyze slow queries and add appropriate database indexes',
        automatable: false,
        estimatedROI: 'High - improved user experience and reduced server load',
        relatedMetrics: ['database.avgQueryTime', 'api.avgResponseTime'],
        implementationSteps: [
          'Run query analysis to identify slow queries',
          'Add missing database indexes',
          'Optimize complex queries',
          'Enable query result caching',
        ],
        risks: ['Database migration downtime', 'Increased storage usage for indexes'],
      });
    }

    // Cache recommendations
    if (metrics.cache.hitRatio < 0.8) {
      recommendations.push({
        id: 'improve_cache_strategy',
        category: 'performance',
        priority: 'medium',
        title: 'Improve Cache Hit Ratio',
        description: `Cache hit ratio is ${(metrics.cache.hitRatio * 100).toFixed(1)}%, below optimal threshold of 80%`,
        impact: 'Reduce database load and improve response times',
        effort: 'low',
        recommendation: 'Optimize cache keys and TTL values, implement cache warming',
        automatable: true,
        relatedMetrics: ['cache.hitRatio', 'database.connectionCount'],
        implementationSteps: [
          'Analyze cache miss patterns',
          'Implement cache warming for frequently accessed data',
          'Optimize cache TTL values',
          'Add cache tagging for better invalidation',
        ],
        risks: ['Increased memory usage', 'Cache warming overhead'],
      });
    }

    // API performance recommendations
    if (metrics.api.p95ResponseTime > 2000) {
      recommendations.push({
        id: 'optimize_api_performance',
        category: 'performance',
        priority: 'high',
        title: 'Optimize API Performance',
        description: `P95 response time is ${metrics.api.p95ResponseTime}ms, exceeding 2 second target`,
        impact: 'Significantly improve user experience',
        effort: 'medium',
        recommendation: 'Implement response caching, optimize database queries, add CDN',
        automatable: true,
        relatedMetrics: ['api.p95ResponseTime', 'api.avgResponseTime'],
        implementationSteps: [
          'Identify slowest API endpoints',
          'Implement response caching for GET requests',
          'Optimize database queries in slow endpoints',
          'Add request/response compression',
        ],
        risks: ['Cache invalidation complexity', 'Increased memory usage'],
      });
    }

    // Memory recommendations
    if (metrics.system.memory.heapUsed / metrics.system.memory.heapTotal > 0.85) {
      recommendations.push({
        id: 'optimize_memory_usage',
        category: 'scalability',
        priority: 'critical',
        title: 'Address High Memory Usage',
        description: `Memory usage at ${((metrics.system.memory.heapUsed / metrics.system.memory.heapTotal) * 100).toFixed(1)}%`,
        impact: 'Prevent memory-related crashes and improve stability',
        effort: 'high',
        recommendation: 'Analyze memory leaks, optimize data structures, implement pagination',
        automatable: false,
        relatedMetrics: ['system.memory'],
        implementationSteps: [
          'Run memory profiling to identify leaks',
          'Optimize large object handling',
          'Implement proper cleanup in event handlers',
          'Add memory usage monitoring alerts',
        ],
        risks: ['Application instability during optimization', 'Performance impact during profiling'],
      });
    }

    // Business performance recommendations
    if (metrics.business.conversionRate < 0.7) {
      recommendations.push({
        id: 'improve_conversion_rate',
        category: 'performance',
        priority: 'medium',
        title: 'Improve Booking Conversion Rate',
        description: `Conversion rate is ${(metrics.business.conversionRate * 100).toFixed(1)}%, below 70% target`,
        impact: 'Increase revenue and customer satisfaction',
        effort: 'medium',
        recommendation: 'Optimize booking flow, reduce friction points, improve UX',
        automatable: false,
        relatedMetrics: ['business.conversionRate', 'business.bookingsPerHour'],
        implementationSteps: [
          'Analyze user journey and drop-off points',
          'Simplify booking form',
          'Improve error messages and validation',
          'Add progress indicators',
        ],
        risks: ['User experience changes may initially reduce conversions'],
      });
    }

    return recommendations.sort((a, b) => {
      const priorities = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorities[b.priority] - priorities[a.priority];
    });
  }

  /**
   * Check all thresholds and generate alerts
   */
  async checkThresholds(): Promise<PerformanceAlert[]> {
    const metrics = await this.getCurrentMetrics();
    const newAlerts: PerformanceAlert[] = [];

    // System threshold checks
    const cpuUsage = (metrics.system.cpu.user + metrics.system.cpu.system) / 1000000; // Convert to percentage
    if (cpuUsage > this.thresholds.system.maxCpuPercentage) {
      newAlerts.push(this.createAlert(
        'system_cpu_high',
        'critical',
        'CPU Usage',
        this.thresholds.system.maxCpuPercentage,
        cpuUsage,
        `CPU usage at ${cpuUsage.toFixed(1)}%`,
        'system'
      ));
    }

    const memoryUsage = (metrics.system.memory.heapUsed / metrics.system.memory.heapTotal) * 100;
    if (memoryUsage > this.thresholds.system.maxMemoryPercentage) {
      newAlerts.push(this.createAlert(
        'system_memory_high',
        'critical',
        'Memory Usage',
        this.thresholds.system.maxMemoryPercentage,
        memoryUsage,
        `Memory usage at ${memoryUsage.toFixed(1)}%`,
        'system'
      ));
    }

    // Database threshold checks
    if (metrics.database.avgQueryTime > this.thresholds.database.maxQueryTime) {
      newAlerts.push(this.createAlert(
        'database_slow_queries',
        'warning',
        'Average Query Time',
        this.thresholds.database.maxQueryTime,
        metrics.database.avgQueryTime,
        `Average query time: ${metrics.database.avgQueryTime}ms`,
        'database'
      ));
    }

    if (metrics.database.errorRate > this.thresholds.database.maxErrorRate) {
      newAlerts.push(this.createAlert(
        'database_error_rate_high',
        'critical',
        'Database Error Rate',
        this.thresholds.database.maxErrorRate,
        metrics.database.errorRate,
        `Database error rate: ${(metrics.database.errorRate * 100).toFixed(1)}%`,
        'database'
      ));
    }

    // Cache threshold checks
    if (metrics.cache.hitRatio < this.thresholds.cache.minHitRatio) {
      newAlerts.push(this.createAlert(
        'cache_hit_ratio_low',
        'warning',
        'Cache Hit Ratio',
        this.thresholds.cache.minHitRatio,
        metrics.cache.hitRatio,
        `Cache hit ratio: ${(metrics.cache.hitRatio * 100).toFixed(1)}%`,
        'cache'
      ));
    }

    // API threshold checks
    if (metrics.api.avgResponseTime > this.thresholds.api.maxResponseTime) {
      newAlerts.push(this.createAlert(
        'api_response_time_high',
        'warning',
        'API Response Time',
        this.thresholds.api.maxResponseTime,
        metrics.api.avgResponseTime,
        `Average API response time: ${metrics.api.avgResponseTime}ms`,
        'api'
      ));
    }

    if (metrics.api.errorRate > this.thresholds.api.maxErrorRate) {
      newAlerts.push(this.createAlert(
        'api_error_rate_high',
        'critical',
        'API Error Rate',
        this.thresholds.api.maxErrorRate,
        metrics.api.errorRate,
        `API error rate: ${(metrics.api.errorRate * 100).toFixed(1)}%`,
        'api'
      ));
    }

    // Store new alerts
    newAlerts.forEach(alert => {
      this.alerts.set(alert.id, alert);
    });

    return newAlerts;
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): PerformanceAlert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit = 100): PerformanceAlert[] {
    return Array.from(this.alerts.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string, userId: string, note?: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;

    alert.acknowledgements.push({
      userId,
      timestamp: new Date(),
      note,
    });

    logger.info('Alert acknowledged', {
      alertId,
      userId,
      note,
    });

    return true;
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string, userId: string, note?: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;

    alert.resolved = true;
    alert.resolvedAt = new Date();

    if (note) {
      alert.acknowledgements.push({
        userId,
        timestamp: new Date(),
        note: `Resolved: ${note}`,
      });
    }

    logger.info('Alert resolved', {
      alertId,
      userId,
      note,
    });

    return true;
  }

  /**
   * Get performance trends
   */
  getPerformanceTrends(
    metric: string,
    timeRange: { start: Date; end: Date }
  ): Array<{
    timestamp: Date;
    value: number;
  }> {
    return this.metricsHistory
      .filter(m => m.system.timestamp >= timeRange.start && m.system.timestamp <= timeRange.end)
      .map(m => ({
        timestamp: m.system.timestamp,
        value: this.getMetricValue(m, metric),
      }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Get system health score (0-100)
   */
  getHealthScore(): {
    overall: number;
    breakdown: {
      system: number;
      database: number;
      cache: number;
      api: number;
      business: number;
    };
  } {
    if (!this.metrics) {
      return {
        overall: 0,
        breakdown: { system: 0, database: 0, cache: 0, api: 0, business: 0 },
      };
    }

    const systemScore = this.calculateSystemHealthScore();
    const databaseScore = this.calculateDatabaseHealthScore();
    const cacheScore = this.calculateCacheHealthScore();
    const apiScore = this.calculateApiHealthScore();
    const businessScore = this.calculateBusinessHealthScore();

    const overall = Math.round(
      (systemScore + databaseScore + cacheScore + apiScore + businessScore) / 5
    );

    return {
      overall,
      breakdown: {
        system: systemScore,
        database: databaseScore,
        cache: cacheScore,
        api: apiScore,
        business: businessScore,
      },
    };
  }

  /**
   * Start automated performance optimization
   */
  async performAutomatedOptimization(): Promise<{
    actionsPerformed: Array<{
      action: string;
      success: boolean;
      impact: string;
    }>;
    recommendations: OptimizationRecommendation[];
  }> {
    const actionsPerformed: Array<{
      action: string;
      success: boolean;
      impact: string;
    }> = [];

    const recommendations = await this.generateRecommendations();
    const automatableRecommendations = recommendations.filter(r => r.automatable);

    for (const rec of automatableRecommendations) {
      try {
        const success = await this.executeOptimizationAction(rec);
        actionsPerformed.push({
          action: rec.title,
          success,
          impact: rec.impact,
        });
      } catch (error) {
        logger.error('Automated optimization failed', error, {
          recommendationId: rec.id,
        });

        actionsPerformed.push({
          action: rec.title,
          success: false,
          impact: 'Failed to apply optimization',
        });
      }
    }

    logger.info('Automated optimization completed', {
      totalActions: actionsPerformed.length,
      successfulActions: actionsPerformed.filter(a => a.success).length,
    });

    return {
      actionsPerformed,
      recommendations: recommendations.filter(r => !r.automatable),
    };
  }

  // Private methods for metric collection

  private collectSystemMetrics(): PerformanceMetrics['system'] {
    return {
      cpu: process.cpuUsage(),
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      loadAverage: require('os').loadavg?.() || [0, 0, 0],
      timestamp: new Date(),
    };
  }

  private async collectDatabaseMetrics(): Promise<PerformanceMetrics['database']> {
    try {
      const dbMetrics = getDbMetrics();

      return {
        connectionCount: dbMetrics.totalConnections || 0,
        activeQueries: 0, // Would be implemented with actual DB monitoring
        avgQueryTime: dbMetrics.averageConnectionTime || 0,
        slowQueries: 0, // Would be calculated from query monitor
        errorRate: 0, // Would be calculated from error metrics
        poolUtilization: dbMetrics.activeConnections / (dbMetrics.totalConnections || 1),
      };
    } catch (error) {
      logger.error('Failed to collect database metrics', error);
      return {
        connectionCount: 0,
        activeQueries: 0,
        avgQueryTime: 0,
        slowQueries: 0,
        errorRate: 0,
        poolUtilization: 0,
      };
    }
  }

  private async collectCacheMetrics(): Promise<PerformanceMetrics['cache']> {
    try {
      const redisClient = getRedisClient();
      const redisMetrics = redisClient.getMetrics();

      return {
        hitRatio: redisClient.getHitRatio(),
        memoryUsage: 0, // Would get from Redis INFO command
        connectionCount: redisMetrics.connectionCount,
        operationsPerSecond: this.calculateOpsPerSecond(redisMetrics),
        errorRate: redisMetrics.errors / (redisMetrics.hits + redisMetrics.misses + redisMetrics.sets),
      };
    } catch (error) {
      logger.error('Failed to collect cache metrics', error);
      return {
        hitRatio: 0,
        memoryUsage: 0,
        connectionCount: 0,
        operationsPerSecond: 0,
        errorRate: 0,
      };
    }
  }

  private collectApiMetrics(): PerformanceMetrics['api'] {
    const allMetrics = Array.from(this.apiMetrics.values());

    if (allMetrics.length === 0) {
      return {
        requestsPerSecond: 0,
        avgResponseTime: 0,
        errorRate: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        activeConnections: 0,
      };
    }

    const totalRequests = allMetrics.reduce((sum, m) => sum + m.requestCount, 0);
    const totalErrors = allMetrics.reduce((sum, m) => sum + m.errorCount, 0);
    const totalResponseTime = allMetrics.reduce((sum, m) => sum + m.totalResponseTime, 0);

    const allResponseTimes = allMetrics
      .flatMap(m => m.responseTimes)
      .sort((a, b) => a - b);

    return {
      requestsPerSecond: totalRequests / 60, // Assuming metrics collected over 1 minute
      avgResponseTime: totalRequests > 0 ? totalResponseTime / totalRequests : 0,
      errorRate: totalRequests > 0 ? totalErrors / totalRequests : 0,
      p95ResponseTime: this.getPercentile(allResponseTimes, 95),
      p99ResponseTime: this.getPercentile(allResponseTimes, 99),
      activeConnections: 0, // Would track active connections
    };
  }

  private async collectBusinessMetrics(): Promise<PerformanceMetrics['business']> {
    // Mock business metrics - in production would query actual data
    return {
      bookingsPerHour: 12,
      conversionRate: 0.75,
      revenuePerHour: 450.00,
      customerSatisfaction: 4.6,
      capacityUtilization: 0.68,
    };
  }

  private calculateOpsPerSecond(redisMetrics: any): number {
    const totalOps = redisMetrics.hits + redisMetrics.misses + redisMetrics.sets + redisMetrics.deletes;
    return totalOps / 60; // Assuming metrics over 1 minute period
  }

  private getPercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, index)];
  }

  private createAlert(
    type: string,
    severity: PerformanceAlert['severity'],
    metric: string,
    threshold: number,
    currentValue: number,
    message: string,
    component: string
  ): PerformanceAlert {
    return {
      id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
      type: 'performance',
      severity,
      metric,
      threshold,
      currentValue,
      message,
      component,
      timestamp: new Date(),
      acknowledgements: [],
      actions: [],
    };
  }

  private initializeThresholds(): void {
    this.thresholds = {
      system: {
        maxCpuPercentage: 80,
        maxMemoryPercentage: 85,
        maxLoadAverage: 4,
      },
      database: {
        maxQueryTime: 1000,
        maxSlowQueries: 10,
        maxErrorRate: 0.01,
        maxPoolUtilization: 0.9,
      },
      cache: {
        minHitRatio: 0.8,
        maxMemoryUsage: 0.85,
        maxErrorRate: 0.05,
      },
      api: {
        maxResponseTime: 2000,
        maxErrorRate: 0.05,
        maxP95ResponseTime: 3000,
      },
      business: {
        minConversionRate: 0.7,
        maxCapacityUtilization: 0.95,
      },
    };
  }

  private initializeMetrics(): void {
    this.metrics = {
      system: {
        cpu: process.cpuUsage(),
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        loadAverage: [0, 0, 0],
        timestamp: new Date(),
      },
      database: {
        connectionCount: 0,
        activeQueries: 0,
        avgQueryTime: 0,
        slowQueries: 0,
        errorRate: 0,
        poolUtilization: 0,
      },
      cache: {
        hitRatio: 0,
        memoryUsage: 0,
        connectionCount: 0,
        operationsPerSecond: 0,
        errorRate: 0,
      },
      api: {
        requestsPerSecond: 0,
        avgResponseTime: 0,
        errorRate: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        activeConnections: 0,
      },
      business: {
        bookingsPerHour: 0,
        conversionRate: 0,
        revenuePerHour: 0,
        customerSatisfaction: 0,
        capacityUtilization: 0,
      },
    };
  }

  private startMonitoring(): void {
    // Collect metrics every minute
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.getCurrentMetrics();
        const newAlerts = await this.checkThresholds();

        if (newAlerts.length > 0) {
          logger.warn('Performance alerts generated', {
            alertCount: newAlerts.length,
            alerts: newAlerts.map(a => ({
              id: a.id,
              severity: a.severity,
              metric: a.metric,
              component: a.component,
            })),
          });

          // Send alerts to notification systems
          await this.sendAlerts(newAlerts);
        }
      } catch (error) {
        logger.error('Performance monitoring error', error);
      }
    }, 60000); // Every minute

    logger.info('Performance monitoring started');
  }

  private addToHistory(metrics: PerformanceMetrics): void {
    this.metricsHistory.push(metrics);

    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory.shift();
    }
  }

  private getMetricValue(metrics: PerformanceMetrics, path: string): number {
    const parts = path.split('.');
    let current: any = metrics;

    for (const part of parts) {
      current = current[part];
      if (current === undefined) return 0;
    }

    return typeof current === 'number' ? current : 0;
  }

  private calculateSystemHealthScore(): number {
    if (!this.metrics) return 0;

    const cpu = (this.metrics.system.cpu.user + this.metrics.system.cpu.system) / 1000000;
    const memory = (this.metrics.system.memory.heapUsed / this.metrics.system.memory.heapTotal) * 100;

    const cpuScore = Math.max(0, 100 - (cpu / this.thresholds.system.maxCpuPercentage) * 100);
    const memoryScore = Math.max(0, 100 - (memory / this.thresholds.system.maxMemoryPercentage) * 100);

    return Math.round((cpuScore + memoryScore) / 2);
  }

  private calculateDatabaseHealthScore(): number {
    if (!this.metrics) return 0;

    const queryTimeScore = Math.max(0, 100 - (this.metrics.database.avgQueryTime / this.thresholds.database.maxQueryTime) * 100);
    const errorRateScore = Math.max(0, 100 - (this.metrics.database.errorRate / this.thresholds.database.maxErrorRate) * 100);

    return Math.round((queryTimeScore + errorRateScore) / 2);
  }

  private calculateCacheHealthScore(): number {
    if (!this.metrics) return 0;

    const hitRatioScore = (this.metrics.cache.hitRatio / this.thresholds.cache.minHitRatio) * 100;
    const errorRateScore = Math.max(0, 100 - (this.metrics.cache.errorRate / this.thresholds.cache.maxErrorRate) * 100);

    return Math.round(Math.min(100, (hitRatioScore + errorRateScore) / 2));
  }

  private calculateApiHealthScore(): number {
    if (!this.metrics) return 0;

    const responseTimeScore = Math.max(0, 100 - (this.metrics.api.avgResponseTime / this.thresholds.api.maxResponseTime) * 100);
    const errorRateScore = Math.max(0, 100 - (this.metrics.api.errorRate / this.thresholds.api.maxErrorRate) * 100);

    return Math.round((responseTimeScore + errorRateScore) / 2);
  }

  private calculateBusinessHealthScore(): number {
    if (!this.metrics) return 0;

    const conversionScore = (this.metrics.business.conversionRate / this.thresholds.business.minConversionRate) * 100;
    const capacityScore = Math.max(0, 100 - (this.metrics.business.capacityUtilization / this.thresholds.business.maxCapacityUtilization) * 100);

    return Math.round(Math.min(100, (conversionScore + capacityScore) / 2));
  }

  private async executeOptimizationAction(recommendation: OptimizationRecommendation): Promise<boolean> {
    switch (recommendation.id) {
      case 'improve_cache_strategy':
        return await this.optimizeCacheStrategy();

      case 'optimize_api_performance':
        return await this.optimizeApiPerformance();

      default:
        logger.info('No automated action available for recommendation', {
          recommendationId: recommendation.id,
        });
        return false;
    }
  }

  private async optimizeCacheStrategy(): Promise<boolean> {
    try {
      // Mock cache optimization
      logger.info('Executing cache strategy optimization');
      return true;
    } catch (error) {
      logger.error('Cache optimization failed', error);
      return false;
    }
  }

  private async optimizeApiPerformance(): Promise<boolean> {
    try {
      // Mock API optimization
      logger.info('Executing API performance optimization');
      return true;
    } catch (error) {
      logger.error('API optimization failed', error);
      return false;
    }
  }

  private async sendAlerts(alerts: PerformanceAlert[]): Promise<void> {
    for (const alert of alerts) {
      // Mock alert sending
      logger.info('Sending performance alert', {
        alertId: alert.id,
        severity: alert.severity,
        component: alert.component,
        message: alert.message,
      });

      // In production, would integrate with:
      // - Slack notifications
      // - Email alerts
      // - PagerDuty
      // - Teams/Discord webhooks
      // - SMS alerts for critical issues
    }
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();