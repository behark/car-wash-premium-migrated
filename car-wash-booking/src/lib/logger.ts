/**
 * Enhanced Logger
 * Wrapper around structured logger for backward compatibility and convenience
 */

import { structuredLogger, type LogContext } from './logging/structured-logger';

/**
 * Enhanced logger with structured logging and correlation ID support
 */
class Logger {
  private structuredLogger = structuredLogger;

  /**
   * Debug logging
   */
  debug(message: string, metadata?: Record<string, any>): void {
    this.structuredLogger.debug(message, metadata);
  }

  /**
   * Info logging
   */
  info(message: string, metadata?: Record<string, any>): void {
    this.structuredLogger.info(message, metadata);
  }

  /**
   * Warning logging
   */
  warn(message: string, metadata?: Record<string, any>): void {
    this.structuredLogger.warn(message, metadata);
  }

  /**
   * Error logging
   */
  error(message: string, error?: Error | any, metadata?: Record<string, any>): void {
    if (error && typeof error === 'object' && !metadata) {
      // If second parameter is metadata object (not Error)
      if (!('message' in error) && !('stack' in error)) {
        this.structuredLogger.error(message, undefined, error);
        return;
      }
    }

    this.structuredLogger.error(message, error, metadata);
  }

  /**
   * Fatal logging
   */
  fatal(message: string, error?: Error | any, metadata?: Record<string, any>): void {
    this.structuredLogger.fatal(message, error, metadata);
  }

  /**
   * Create child logger with context
   */
  child(context: Partial<LogContext>) {
    return this.structuredLogger.child(context);
  }

  /**
   * Execute with correlation context
   */
  withContext<T>(context: LogContext, fn: () => T): T {
    return this.structuredLogger.withContext(context, fn);
  }

  /**
   * Set correlation ID
   */
  withCorrelationId(correlationId?: string) {
    return this.structuredLogger.withCorrelationId(correlationId);
  }

  /**
   * Set request ID
   */
  withRequestId(requestId?: string) {
    return this.structuredLogger.withRequestId(requestId);
  }

  /**
   * Set user context
   */
  withUser(userId: string, sessionId?: string) {
    return this.structuredLogger.withUser(userId, sessionId);
  }

  /**
   * Set operation context
   */
  withOperation(operation: string, component?: string) {
    return this.structuredLogger.withOperation(operation, component);
  }

  /**
   * Start performance measurement
   */
  startPerformance(operationId: string): void {
    this.structuredLogger.startPerformance(operationId);
  }

  /**
   * End performance measurement
   */
  endPerformance(operationId: string, message?: string, metadata?: Record<string, any>) {
    return this.structuredLogger.endPerformance(operationId, message, metadata);
  }

  /**
   * Measure async function performance
   */
  async measureAsync<T>(
    operationId: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    return this.structuredLogger.measureAsync(operationId, fn, metadata);
  }

  /**
   * Measure sync function performance
   */
  measure<T>(
    operationId: string,
    fn: () => T,
    metadata?: Record<string, any>
  ): T {
    return this.structuredLogger.measure(operationId, fn, metadata);
  }

  /**
   * Create audit log
   */
  audit(action: string, resource: string, userId?: string, metadata?: Record<string, any>): void {
    this.structuredLogger.audit(action, resource, userId, metadata);
  }

  /**
   * Create security log
   */
  security(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    metadata?: Record<string, any>
  ): void {
    this.structuredLogger.security(event, severity, metadata);
  }

  /**
   * Flush logs immediately
   */
  async flush(): Promise<void> {
    return this.structuredLogger.flush();
  }

  /**
   * Get current context
   */
  getContext(): LogContext {
    return this.structuredLogger.getContext();
  }

  /**
   * Get underlying structured logger
   */
  getStructuredLogger() {
    return this.structuredLogger;
  }
}

// Export singleton instance
export const logger = new Logger();