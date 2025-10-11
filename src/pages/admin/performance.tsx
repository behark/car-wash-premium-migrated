/**
 * Performance Monitoring Dashboard
 * Real-time performance metrics and monitoring for the application
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import SEO from '../../components/SEO';
import { siteConfig } from '../../lib/siteConfig';
import {
  getCurrentMetrics,
  checkPerformanceBudget,
  PerformanceMetrics
} from '../../utils/performance';

// Note: Chart component removed as it's not in dependencies
// For production, you would need to install react-chartjs-2 and chart.js
// npm install react-chartjs-2 chart.js

interface StoredMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  timestamp: number;
  page: string;
}

interface LongTask {
  duration: number;
  startTime: number;
  timestamp: number;
  page: string;
}

export default function PerformanceDashboard() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<PerformanceMetrics>(getCurrentMetrics());
  const [webVitals, setWebVitals] = useState<StoredMetric[]>([]);
  const [longTasks, setLongTasks] = useState<LongTask[]>([]);
  const [budgetViolations, setBudgetViolations] = useState<string[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<string>('FCP');
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | 'all'>('24h');

  // Load stored metrics from localStorage
  const loadStoredData = useCallback(() => {
    try {
      const storedVitals = JSON.parse(localStorage.getItem('webVitals') || '[]');
      const storedTasks = JSON.parse(localStorage.getItem('longTasks') || '[]');

      setWebVitals(storedVitals);
      setLongTasks(storedTasks);
      setMetrics(getCurrentMetrics());
      setBudgetViolations(checkPerformanceBudget());
    } catch (e) {
      console.error('Error loading performance data:', e);
    }
  }, []);

  // Filter data by time range
  const filterByTimeRange = useCallback((data: any[], range: string) => {
    const now = Date.now();
    const ranges = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      'all': Infinity,
    };

    const cutoff = now - ranges[range as keyof typeof ranges];
    return data.filter(item => item.timestamp >= cutoff);
  }, []);


  // Calculate metric statistics
  const getMetricStats = useCallback((metricName: string) => {
    const metricData = webVitals.filter(v => v.name === metricName);
    if (metricData.length === 0) return null;

    const values = metricData.map(m => m.value);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const latest = metricData[metricData.length - 1];

    return {
      avg: avg.toFixed(2),
      min: min.toFixed(2),
      max: max.toFixed(2),
      latest: latest.value.toFixed(2),
      rating: latest.rating,
    };
  }, [webVitals]);

  // Load data on mount and set up polling
  useEffect(() => {
    loadStoredData();

    // Poll for updates every 5 seconds
    const interval = setInterval(loadStoredData, 5000);

    return () => clearInterval(interval);
  }, [loadStoredData]);

  // Metric thresholds
  const thresholds = {
    FCP: { good: 1800, poor: 3000, unit: 'ms' },
    LCP: { good: 2500, poor: 4000, unit: 'ms' },
    FID: { good: 100, poor: 300, unit: 'ms' },
    CLS: { good: 0.1, poor: 0.25, unit: '' },
    TTFB: { good: 800, poor: 1800, unit: 'ms' },
    INP: { good: 200, poor: 500, unit: 'ms' },
  };

  // Get rating color
  const getRatingColor = (rating: string | undefined) => {
    switch (rating) {
      case 'good': return 'text-green-600 bg-green-50';
      case 'needs-improvement': return 'text-yellow-600 bg-yellow-50';
      case 'poor': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <>
      <SEO
        title={`Performance Dashboard - ${siteConfig.name}`}
        description="Monitor real-time performance metrics and Web Vitals"
        noIndex={true}
      />

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Performance Dashboard</h1>
                <p className="text-sm text-gray-600 mt-1">Real-time performance monitoring</p>
              </div>

              <button
                onClick={() => router.push('/admin')}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Back to Admin
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Budget Violations Alert */}
          {budgetViolations.length > 0 && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="font-semibold text-red-900 mb-2">Performance Budget Violations</h3>
              <ul className="space-y-1">
                {budgetViolations.map((violation, i) => (
                  <li key={i} className="text-sm text-red-700">{violation}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Core Web Vitals Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {(['FCP', 'LCP', 'FID', 'CLS', 'TTFB', 'INP'] as const).map((metric) => {
              const stats = getMetricStats(metric);
              const threshold = thresholds[metric];
              const currentValue = metrics[metric];

              return (
                <div
                  key={metric}
                  className="bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setSelectedMetric(metric)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{metric}</h3>
                      <p className="text-sm text-gray-500">
                        {metric === 'FCP' && 'First Contentful Paint'}
                        {metric === 'LCP' && 'Largest Contentful Paint'}
                        {metric === 'FID' && 'First Input Delay'}
                        {metric === 'CLS' && 'Cumulative Layout Shift'}
                        {metric === 'TTFB' && 'Time to First Byte'}
                        {metric === 'INP' && 'Interaction to Next Paint'}
                      </p>
                    </div>
                    {stats && (
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRatingColor(stats.rating)}`}>
                        {stats.rating}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Current</span>
                      <span className="text-sm font-semibold">
                        {currentValue ? `${currentValue.toFixed(2)}${threshold.unit}` : 'N/A'}
                      </span>
                    </div>

                    {stats && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Average</span>
                          <span className="text-sm">{stats.avg}{threshold.unit}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Range</span>
                          <span className="text-sm">
                            {stats.min}{threshold.unit} - {stats.max}{threshold.unit}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Threshold indicator */}
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex justify-between text-xs">
                      <span className="text-green-600">Good ≤{threshold.good}{threshold.unit}</span>
                      <span className="text-red-600">Poor ≥{threshold.poor}{threshold.unit}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Time Range Selector */}
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              {selectedMetric} Trend
            </h2>

            <div className="flex space-x-2">
              {(['1h', '24h', '7d', 'all'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                    timeRange === range
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {range === '1h' && 'Last Hour'}
                  {range === '24h' && 'Last 24h'}
                  {range === '7d' && 'Last 7 Days'}
                  {range === 'all' && 'All Time'}
                </button>
              ))}
            </div>
          </div>

          {/* Metric Chart */}
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700">Historical Data</h3>
              {webVitals.filter(v => v.name === selectedMetric).length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {filterByTimeRange(webVitals.filter(v => v.name === selectedMetric), timeRange)
                    .reverse()
                    .slice(0, 20)
                    .map((metric, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div className="flex items-center space-x-3">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRatingColor(metric.rating)}`}>
                            {metric.rating}
                          </span>
                          <span className="text-sm font-medium">
                            {metric.value.toFixed(2)}{thresholds[selectedMetric as keyof typeof thresholds].unit}
                          </span>
                          <span className="text-xs text-gray-500">{metric.page}</span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(metric.timestamp).toLocaleString('fi-FI')}
                        </span>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="h-32 flex items-center justify-center text-gray-500">
                  No data available for {selectedMetric}
                </div>
              )}
            </div>
          </div>

          {/* Long Tasks */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Long Tasks</h2>

            {longTasks.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {filterByTimeRange(longTasks, timeRange).map((task, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <span className="text-sm font-medium">{task.duration.toFixed(0)}ms</span>
                      <span className="text-xs text-gray-500 ml-2">{task.page}</span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(task.timestamp).toLocaleString('fi-FI')}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No long tasks detected</p>
            )}
          </div>

          {/* Actions */}
          <div className="mt-8 flex space-x-4">
            <button
              onClick={() => {
                localStorage.removeItem('webVitals');
                localStorage.removeItem('longTasks');
                loadStoredData();
              }}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Clear All Data
            </button>

            <button
              onClick={loadStoredData}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>
    </>
  );
}