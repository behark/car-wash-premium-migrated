/**
 * Initialize monitoring system for the application
 */

import { trackError as trackErrorBase } from './monitoring';

/**
 * Track an application error
 */
export function trackError(error: Error | string, metadata?: Record<string, any>): void {
  trackErrorBase(error, metadata);
}

/**
 * Track an application event
 */
export function trackEvent(name: string, properties?: Record<string, any>, userId?: string): void {
  // Log event
  console.log(`[Event] ${name}`, {
    ...(properties || {}),
    ...(userId ? { userId } : {}),
  });
}

/**
 * Initialize monitoring system
 */
export function initMonitoring(): void {
  console.log('[Monitoring] System initialized');
  // Add any initialization code here
}

export default {
  trackError,
  trackEvent,
  initMonitoring,
};
