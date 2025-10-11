// Basic error tracking functionality

/**
 * Tracks an error for monitoring purposes
 * @param error Error object or string message
 * @param metadata Optional metadata to include with the error
 */
export function trackError(error: Error | string, metadata?: Record<string, any>): void {
  // Simple implementation that just logs the error
  // In a production environment, this could send to an external service like Sentry
  const errorMessage = typeof error === 'string' ? error : error.message;

  console.error('[Error Tracking]', errorMessage, {
    ...(typeof error !== 'string' ? { stack: error.stack } : {}),
    ...(metadata || {}),
  });

  // Add integration with other monitoring systems here if needed
}

/**
 * Tracks a performance metric
 * @param name Name of the metric
 * @param value Value of the metric
 * @param tags Optional tags to associate with the metric
 */
export function trackMetric(name: string, value: number, tags?: Record<string, string>): void {
  // Simple implementation - in production this would send to a monitoring service
  console.log('[Metric]', name, value, tags || {});
}

/**
 * Records the start of a timed operation for performance tracking
 * @param name Name of the operation
 * @returns A function to call when the operation completes
 */
export function trackTiming(name: string): () => void {
  const startTime = performance.now();

  return () => {
    const duration = performance.now() - startTime;
    trackMetric(`${name}_duration`, duration);
  };
}

export default {
  trackError,
  trackMetric,
  trackTiming,
};
