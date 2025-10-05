/**
 * API Metrics Endpoint
 * GET /api/monitoring/metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiMetricsCollector } from '@/lib/middleware/api-monitoring';

interface MetricsResponse {
  summary: {
    totalRequests: number;
    totalEndpoints: number;
    overallErrorRate: number;
    overallAverageResponseTime: number;
    timeRange: string;
  };
  endpoints: Array<{
    endpoint: string;
    totalRequests: number;
    averageResponseTime: number;
    errorRate: number;
    slowRequestRate: number;
    statusCodes: Record<number, number>;
    lastRequest?: string;
  }>;
  recentRequests: Array<{
    method: string;
    path: string;
    statusCode: number;
    responseTime: number;
    timestamp: string;
    error?: string;
  }>;
  alerts: Array<{
    type: 'slow_response' | 'high_error_rate' | 'high_load';
    endpoint: string;
    message: string;
    severity: 'low' | 'medium' | 'high';
    timestamp: string;
  }>;
}

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const url = new URL(request.url);
    const timeRange = url.searchParams.get('timeRange') || '1h';
    const limit = parseInt(url.searchParams.get('limit') || '100');

    // Calculate time window
    const timeWindows = {
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
    };

    const timeWindow = timeWindows[timeRange as keyof typeof timeWindows] || timeWindows['1h'];
    const cutoffTime = Date.now() - timeWindow;

    // Get all metrics
    const allMetrics = apiMetricsCollector.getMetrics().filter(
      metric => metric.timestamp.getTime() > cutoffTime
    );

    // Get endpoint stats
    const endpointStats = apiMetricsCollector.getAllEndpointStats();
    const endpoints = Object.entries(endpointStats).map(([endpoint, stats]) => {
      const endpointMetrics = apiMetricsCollector.getMetrics(endpoint).filter(
        metric => metric.timestamp.getTime() > cutoffTime
      );

      const lastRequest = endpointMetrics.length > 0
        ? endpointMetrics[endpointMetrics.length - 1].timestamp.toISOString()
        : undefined;

      return {
        endpoint,
        ...stats,
        lastRequest,
      };
    }).sort((a, b) => b.totalRequests - a.totalRequests);

    // Calculate summary
    const totalRequests = allMetrics.length;
    const totalEndpoints = Object.keys(endpointStats).length;
    const errorCount = allMetrics.filter(m => m.statusCode >= 400).length;
    const overallErrorRate = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0;
    const overallAverageResponseTime = totalRequests > 0
      ? allMetrics.reduce((sum, m) => sum + m.responseTime, 0) / totalRequests
      : 0;

    // Get recent requests
    const recentRequests = allMetrics
      .slice(-limit)
      .reverse()
      .map(metric => ({
        method: metric.method,
        path: metric.path,
        statusCode: metric.statusCode,
        responseTime: metric.responseTime,
        timestamp: metric.timestamp.toISOString(),
        error: metric.error,
      }));

    // Generate alerts
    const alerts: MetricsResponse['alerts'] = [];

    endpoints.forEach(endpoint => {
      // High error rate alert
      if (endpoint.errorRate > 20) {
        alerts.push({
          type: 'high_error_rate',
          endpoint: endpoint.endpoint,
          message: `Error rate is ${endpoint.errorRate.toFixed(1)}%`,
          severity: endpoint.errorRate > 50 ? 'high' : 'medium',
          timestamp: new Date().toISOString(),
        });
      }

      // Slow response alert
      if (endpoint.averageResponseTime > 5000) {
        alerts.push({
          type: 'slow_response',
          endpoint: endpoint.endpoint,
          message: `Average response time is ${endpoint.averageResponseTime.toFixed(0)}ms`,
          severity: endpoint.averageResponseTime > 10000 ? 'high' : 'medium',
          timestamp: new Date().toISOString(),
        });
      }

      // High load alert
      if (endpoint.totalRequests > 1000) {
        alerts.push({
          type: 'high_load',
          endpoint: endpoint.endpoint,
          message: `High request volume: ${endpoint.totalRequests} requests`,
          severity: 'low',
          timestamp: new Date().toISOString(),
        });
      }
    });

    const response: MetricsResponse = {
      summary: {
        totalRequests,
        totalEndpoints,
        overallErrorRate,
        overallAverageResponseTime,
        timeRange,
      },
      endpoints,
      recentRequests,
      alerts: alerts.sort((a, b) => {
        const severityOrder = { high: 3, medium: 2, low: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      }),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Failed to fetch metrics:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}