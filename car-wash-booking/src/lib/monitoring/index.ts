/**
 * Monitoring Module Exports
 * Enterprise monitoring and observability functionality
 */

// Performance monitoring
export {
  PerformanceMonitor,
  performanceMonitor,
  type PerformanceMetrics,
  type PerformanceAlert,
  type PerformanceThresholds,
  type OptimizationRecommendation,
} from './performance-monitor';

// Re-export existing monitoring functionality
export {
  initializeMonitoring,
  trackEvent,
  trackPageView,
  identifyUser,
  trackError,
  measurePerformance,
  useErrorHandler,
  monitorApiCall,
  monitorDatabaseQuery,
  trackFeatureFlag,
  startSession,
  endSession,
} from '../monitoring';