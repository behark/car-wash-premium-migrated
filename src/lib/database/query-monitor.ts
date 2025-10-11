/**
 * Database Query Monitor
 * Enterprise-grade query performance monitoring, optimization, and analysis
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../logger';

export interface QueryMetrics {
  query: string;
  duration: number;
  timestamp: Date;
  parameters?: any[];
  affectedRows?: number;
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'TRANSACTION' | 'UNKNOWN';
  table?: string;
  correlationId?: string;
  userId?: string;
}

export interface QueryAnalysis {
  query: string;
  executionPlan?: any;
  indexes?: string[];
  suggestedIndexes?: string[];
  optimization?: {
    canUseIndex?: boolean;
    estimatedImprovement?: number;
    suggestions: string[];
  };
  performance: {
    avgDuration: number;
    maxDuration: number;
    minDuration: number;
    executionCount: number;
    p95Duration: number;
    p99Duration: number;
  };
}

export interface SlowQueryAlert {
  query: string;
  duration: number;
  threshold: number;
  timestamp: Date;
  correlationId?: string;
  recommendation?: string;
}

/**
 * Query monitoring and optimization service
 */
export class QueryMonitor {
  private static instance: QueryMonitor;
  private queryHistory: QueryMetrics[] = [];
  private maxHistorySize = 10000;
  private slowQueryThreshold = 1000; // 1 second
  private analysisCache = new Map<string, QueryAnalysis>();
  private queryFrequency = new Map<string, number>();

  static getInstance(): QueryMonitor {
    if (!QueryMonitor.instance) {
      QueryMonitor.instance = new QueryMonitor();
    }
    return QueryMonitor.instance;
  }

  constructor() {
    this.initializeMonitoring();
  }

  /**
   * Record query execution metrics
   */
  recordQuery(queryEvent: any, correlationId?: string, userId?: string): void {
    const metrics: QueryMetrics = {
      query: this.normalizeQuery(queryEvent.query),
      duration: queryEvent.duration,
      timestamp: new Date(queryEvent.timestamp),
      parameters: queryEvent.params,
      operation: this.extractOperation(queryEvent.query),
      table: this.extractTable(queryEvent.query),
      correlationId,
      userId,
    };

    // Add to history
    this.queryHistory.push(metrics);

    // Maintain history size
    if (this.queryHistory.length > this.maxHistorySize) {
      this.queryHistory.shift();
    }

    // Update query frequency
    const queryHash = this.hashQuery(metrics.query);
    this.queryFrequency.set(queryHash, (this.queryFrequency.get(queryHash) || 0) + 1);

    // Check for slow queries
    if (metrics.duration > this.slowQueryThreshold) {
      this.handleSlowQuery(metrics);
    }

    // Log query for debugging
    this.logQuery(metrics);
  }

  /**
   * Analyze query performance and suggest optimizations
   */
  async analyzeQuery(query: string): Promise<QueryAnalysis> {
    const queryHash = this.hashQuery(query);

    // Check cache first
    if (this.analysisCache.has(queryHash)) {
      return this.analysisCache.get(queryHash)!;
    }

    const relatedQueries = this.queryHistory.filter(
      q => this.normalizeQuery(q.query) === this.normalizeQuery(query)
    );

    if (relatedQueries.length === 0) {
      // No historical data available
      return {
        query,
        performance: {
          avgDuration: 0,
          maxDuration: 0,
          minDuration: 0,
          executionCount: 0,
          p95Duration: 0,
          p99Duration: 0,
        },
        optimization: {
          suggestions: ['No historical data available for analysis'],
        },
      };
    }

    const durations = relatedQueries.map(q => q.duration).sort((a, b) => a - b);
    const analysis: QueryAnalysis = {
      query,
      performance: {
        avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
        maxDuration: Math.max(...durations),
        minDuration: Math.min(...durations),
        executionCount: relatedQueries.length,
        p95Duration: this.getPercentile(durations, 95),
        p99Duration: this.getPercentile(durations, 99),
      },
      optimization: {
        suggestions: this.generateOptimizationSuggestions(query, relatedQueries),
      },
    };

    // Cache the analysis
    this.analysisCache.set(queryHash, analysis);

    return analysis;
  }

  /**
   * Get slow queries within time range
   */
  getSlowQueries(
    startTime: Date,
    endTime: Date,
    threshold?: number
  ): QueryMetrics[] {
    const effectiveThreshold = threshold || this.slowQueryThreshold;

    return this.queryHistory.filter(q =>
      q.timestamp >= startTime &&
      q.timestamp <= endTime &&
      q.duration >= effectiveThreshold
    );
  }

  /**
   * Get query frequency statistics
   */
  getQueryFrequencyStats(): Array<{ query: string; count: number; avgDuration: number }> {
    const stats: Array<{ query: string; count: number; avgDuration: number }> = [];

    for (const [queryHash, count] of this.queryFrequency.entries()) {
      const relatedQueries = this.queryHistory.filter(
        q => this.hashQuery(q.query) === queryHash
      );

      if (relatedQueries.length > 0) {
        const avgDuration = relatedQueries.reduce((sum, q) => sum + q.duration, 0) / relatedQueries.length;

        stats.push({
          query: relatedQueries[0].query,
          count,
          avgDuration,
        });
      }
    }

    return stats.sort((a, b) => b.count - a.count);
  }

  /**
   * Get database performance metrics
   */
  getPerformanceMetrics(): {
    totalQueries: number;
    slowQueries: number;
    avgQueryDuration: number;
    queriesPerSecond: number;
    topSlowQueries: QueryMetrics[];
    mostFrequentQueries: Array<{ query: string; count: number }>;
    operationBreakdown: Record<string, number>;
  } {
    const now = Date.now();
    const oneHourAgo = new Date(now - 60 * 60 * 1000);
    const recentQueries = this.queryHistory.filter(q => q.timestamp >= oneHourAgo);

    const slowQueries = recentQueries.filter(q => q.duration > this.slowQueryThreshold);
    const avgDuration = recentQueries.length > 0 ?
      recentQueries.reduce((sum, q) => sum + q.duration, 0) / recentQueries.length : 0;

    const operationBreakdown: Record<string, number> = {};
    recentQueries.forEach(q => {
      operationBreakdown[q.operation] = (operationBreakdown[q.operation] || 0) + 1;
    });

    const topSlowQueries = [...recentQueries]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    const frequencyStats = this.getQueryFrequencyStats();
    const mostFrequentQueries = frequencyStats.slice(0, 10).map(stat => ({
      query: stat.query,
      count: stat.count,
    }));

    return {
      totalQueries: recentQueries.length,
      slowQueries: slowQueries.length,
      avgQueryDuration: avgDuration,
      queriesPerSecond: recentQueries.length / 3600, // Per second over last hour
      topSlowQueries,
      mostFrequentQueries,
      operationBreakdown,
    };
  }

  /**
   * Suggest query optimizations
   */
  async suggestOptimizations(): Promise<Array<{
    query: string;
    issue: string;
    suggestion: string;
    priority: 'low' | 'medium' | 'high';
    estimatedImpact: string;
  }>> {
    const suggestions: Array<{
      query: string;
      issue: string;
      suggestion: string;
      priority: 'low' | 'medium' | 'high';
      estimatedImpact: string;
    }> = [];

    const frequencyStats = this.getQueryFrequencyStats();

    for (const stat of frequencyStats.slice(0, 20)) {
      if (stat.avgDuration > this.slowQueryThreshold) {
        const analysis = await this.analyzeQuery(stat.query);

        analysis.optimization?.suggestions.forEach(suggestion => {
          suggestions.push({
            query: stat.query,
            issue: `Slow query (${stat.avgDuration.toFixed(0)}ms avg, ${stat.count} executions)`,
            suggestion,
            priority: stat.avgDuration > 5000 ? 'high' :
                     stat.avgDuration > 2000 ? 'medium' : 'low',
            estimatedImpact: this.estimateOptimizationImpact(stat.avgDuration, stat.count),
          });
        });
      }
    }

    return suggestions.sort((a, b) => {
      const priorities = { high: 3, medium: 2, low: 1 };
      return priorities[b.priority] - priorities[a.priority];
    });
  }

  /**
   * Clear query history and analysis cache
   */
  clearHistory(): void {
    this.queryHistory = [];
    this.queryFrequency.clear();
    this.analysisCache.clear();
    logger.info('Query monitoring history cleared');
  }

  /**
   * Get query monitoring configuration
   */
  getConfiguration(): {
    slowQueryThreshold: number;
    maxHistorySize: number;
    monitoringEnabled: boolean;
  } {
    return {
      slowQueryThreshold: this.slowQueryThreshold,
      maxHistorySize: this.maxHistorySize,
      monitoringEnabled: true,
    };
  }

  /**
   * Update monitoring configuration
   */
  updateConfiguration(config: {
    slowQueryThreshold?: number;
    maxHistorySize?: number;
  }): void {
    if (config.slowQueryThreshold !== undefined) {
      this.slowQueryThreshold = config.slowQueryThreshold;
    }

    if (config.maxHistorySize !== undefined) {
      this.maxHistorySize = config.maxHistorySize;
      // Trim history if needed
      if (this.queryHistory.length > this.maxHistorySize) {
        this.queryHistory = this.queryHistory.slice(-this.maxHistorySize);
      }
    }

    logger.info('Query monitor configuration updated', config);
  }

  // Private helper methods

  private initializeMonitoring(): void {
    // Set up periodic analysis
    setInterval(() => {
      this.performPeriodicAnalysis();
    }, 300000); // Every 5 minutes

    // Set up cleanup
    setInterval(() => {
      this.cleanupOldData();
    }, 3600000); // Every hour

    logger.info('Query monitoring initialized', {
      slowQueryThreshold: this.slowQueryThreshold,
      maxHistorySize: this.maxHistorySize,
    });
  }

  private normalizeQuery(query: string): string {
    // Remove parameter values and normalize whitespace
    return query
      .replace(/\$\d+/g, '?') // Replace $1, $2, etc. with ?
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .toLowerCase();
  }

  private extractOperation(query: string): QueryMetrics['operation'] {
    const normalizedQuery = query.toLowerCase().trim();

    if (normalizedQuery.startsWith('select')) return 'SELECT';
    if (normalizedQuery.startsWith('insert')) return 'INSERT';
    if (normalizedQuery.startsWith('update')) return 'UPDATE';
    if (normalizedQuery.startsWith('delete')) return 'DELETE';
    if (normalizedQuery.includes('begin') || normalizedQuery.includes('commit')) return 'TRANSACTION';

    return 'UNKNOWN';
  }

  private extractTable(query: string): string | undefined {
    const normalizedQuery = query.toLowerCase().trim();

    // Simple table extraction - can be enhanced
    const tablePatterns = [
      /from\s+(["`]?)(\w+)\1/i,
      /into\s+(["`]?)(\w+)\1/i,
      /update\s+(["`]?)(\w+)\1/i,
    ];

    for (const pattern of tablePatterns) {
      const match = normalizedQuery.match(pattern);
      if (match && match[2]) {
        return match[2];
      }
    }

    return undefined;
  }

  private hashQuery(query: string): string {
    // Simple hash for query deduplication
    return Buffer.from(this.normalizeQuery(query)).toString('base64').slice(0, 32);
  }

  private handleSlowQuery(metrics: QueryMetrics): void {
    const alert: SlowQueryAlert = {
      query: metrics.query,
      duration: metrics.duration,
      threshold: this.slowQueryThreshold,
      timestamp: metrics.timestamp,
      correlationId: metrics.correlationId,
      recommendation: this.getQuickRecommendation(metrics.query),
    };

    logger.warn('Slow query detected', {
      query: metrics.query.substring(0, 200) + '...',
      duration: metrics.duration,
      threshold: this.slowQueryThreshold,
      table: metrics.table,
      operation: metrics.operation,
      correlationId: metrics.correlationId,
      userId: metrics.userId,
    });

    // In production, you might send alerts to monitoring systems
    if (process.env.NODE_ENV === 'production') {
      this.sendSlowQueryAlert(alert);
    }
  }

  private getQuickRecommendation(query: string): string {
    const normalizedQuery = query.toLowerCase();

    if (normalizedQuery.includes('select') && !normalizedQuery.includes('where')) {
      return 'Consider adding WHERE clause to limit results';
    }

    if (normalizedQuery.includes('like \'%')) {
      return 'Avoid leading wildcards in LIKE queries - consider full-text search';
    }

    if (normalizedQuery.includes('order by') && !normalizedQuery.includes('limit')) {
      return 'Consider adding LIMIT to ORDER BY queries';
    }

    if (normalizedQuery.includes('join') && normalizedQuery.split('join').length > 4) {
      return 'Complex JOIN query - consider denormalization or caching';
    }

    if (normalizedQuery.includes('distinct')) {
      return 'DISTINCT can be expensive - verify if necessary';
    }

    return 'Review query execution plan and consider adding appropriate indexes';
  }

  private generateOptimizationSuggestions(query: string, queryHistory: QueryMetrics[]): string[] {
    const suggestions: string[] = [];
    const normalizedQuery = query.toLowerCase();

    // Analyze query patterns
    if (queryHistory.length > 10) {
      const avgDuration = queryHistory.reduce((sum, q) => sum + q.duration, 0) / queryHistory.length;

      if (avgDuration > 2000) {
        suggestions.push('Query consistently slow - high priority for optimization');
      }

      // Check for N+1 pattern
      const recentExecution = queryHistory.filter(
        q => Date.now() - q.timestamp.getTime() < 60000 // Last minute
      );

      if (recentExecution.length > 50) {
        suggestions.push('Potential N+1 query pattern - consider batch loading or eager loading');
      }
    }

    // Query structure analysis
    if (normalizedQuery.includes('select *')) {
      suggestions.push('Use specific column names instead of SELECT *');
    }

    if (normalizedQuery.includes('where') && !normalizedQuery.match(/where\s+\w+\s*=\s*\$/)) {
      suggestions.push('Consider using parameterized queries for better security');
    }

    if (normalizedQuery.includes('order by') && !normalizedQuery.includes('limit')) {
      suggestions.push('Add LIMIT clause to ORDER BY queries');
    }

    if (normalizedQuery.includes('count(*)') && normalizedQuery.includes('where')) {
      suggestions.push('For COUNT queries, consider using approximate counting for large datasets');
    }

    // Table-specific suggestions
    const table = this.extractTable(query);
    if (table) {
      suggestions.push(...this.getTableSpecificSuggestions(table, normalizedQuery));
    }

    return suggestions.length > 0 ? suggestions : ['No specific optimizations identified'];
  }

  private getTableSpecificSuggestions(table: string, query: string): string[] {
    const suggestions: string[] = [];

    switch (table) {
      case 'booking':
        if (query.includes('where date')) {
          suggestions.push('Ensure date column is indexed');
        }
        if (query.includes('where customeremail')) {
          suggestions.push('Consider indexing customerEmail for faster customer lookups');
        }
        if (query.includes('where status')) {
          suggestions.push('Status column is likely indexed - good practice');
        }
        break;

      case 'service':
        if (query.includes('where isactive')) {
          suggestions.push('isActive column should be indexed for filtering');
        }
        break;

      case 'timeslot':
        if (query.includes('where date') && query.includes('where starttime')) {
          suggestions.push('Consider composite index on (date, startTime)');
        }
        break;
    }

    return suggestions;
  }

  private getPercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;

    const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, index)];
  }

  private estimateOptimizationImpact(avgDuration: number, frequency: number): string {
    const totalTimePerDay = avgDuration * frequency * 24; // Assuming even distribution
    const potentialSavings = totalTimePerDay * 0.7; // Assume 70% improvement

    if (potentialSavings > 60000) { // > 1 minute per day
      return `High impact - could save ${Math.round(potentialSavings / 60000)} minutes per day`;
    }
    if (potentialSavings > 10000) { // > 10 seconds per day
      return `Medium impact - could save ${Math.round(potentialSavings / 1000)} seconds per day`;
    }

    return 'Low impact - minor performance improvement';
  }

  private logQuery(metrics: QueryMetrics): void {
    if (metrics.duration > this.slowQueryThreshold) {
      logger.warn('Slow query execution', {
        operation: metrics.operation,
        table: metrics.table,
        duration: metrics.duration,
        query: metrics.query.substring(0, 100) + '...',
        correlationId: metrics.correlationId,
      });
    } else if (process.env.LOG_LEVEL === 'DEBUG') {
      logger.debug('Query execution', {
        operation: metrics.operation,
        table: metrics.table,
        duration: metrics.duration,
        correlationId: metrics.correlationId,
      });
    }
  }

  private async sendSlowQueryAlert(alert: SlowQueryAlert): Promise<void> {
    // In production, send to alerting system
    logger.error('Slow query alert', {
      query: alert.query,
      duration: alert.duration,
      threshold: alert.threshold,
      recommendation: alert.recommendation,
    });

    // Could integrate with PagerDuty, Slack, email alerts, etc.
  }

  private performPeriodicAnalysis(): void {
    const recentQueries = this.queryHistory.filter(
      q => Date.now() - q.timestamp.getTime() < 3600000 // Last hour
    );

    if (recentQueries.length > 100) {
      logger.info('Query monitoring summary', {
        totalQueries: recentQueries.length,
        slowQueries: recentQueries.filter(q => q.duration > this.slowQueryThreshold).length,
        avgDuration: recentQueries.reduce((sum, q) => sum + q.duration, 0) / recentQueries.length,
        uniqueQueries: new Set(recentQueries.map(q => this.hashQuery(q.query))).size,
      });
    }
  }

  private cleanupOldData(): void {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    const originalSize = this.queryHistory.length;

    this.queryHistory = this.queryHistory.filter(q => q.timestamp > cutoffTime);

    const removedCount = originalSize - this.queryHistory.length;
    if (removedCount > 0) {
      logger.debug('Cleaned up old query data', {
        removedCount,
        remainingCount: this.queryHistory.length,
      });
    }

    // Also clean analysis cache periodically
    if (this.analysisCache.size > 1000) {
      this.analysisCache.clear();
      logger.debug('Cleared query analysis cache');
    }
  }
}

/**
 * Enhanced Prisma client wrapper with query monitoring
 */
export function createMonitoredPrismaClient(): PrismaClient {
  const queryMonitor = QueryMonitor.getInstance();

  const client = new PrismaClient({
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'warn' }
    ],
  });

  // Add query monitoring
  client.$on('query', (e) => {
    const context = getCurrentRequestContext();
    queryMonitor.recordQuery(e, context?.correlationId, context?.userId);
  });

  client.$on('error', (e) => {
    logger.error('Database error', {
      target: e.target,
      message: e.message,
      timestamp: e.timestamp,
    });
  });

  return client;
}

// Import getCurrentRequestContext for use in monitoring
import { getCurrentRequestContext } from '../logging/correlation-middleware';

// Export singleton instance
export const queryMonitor = QueryMonitor.getInstance();