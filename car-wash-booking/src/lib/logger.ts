/**
 * Simple Logger (Memory Optimized)
 * Lightweight logging solution without dependencies
 */

/**
 * Simple logger for development and debugging
 */
class Logger {
  /**
   * Debug logging
   */
  debug(message: string, metadata?: Record<string, any>): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug('DEBUG:', message, metadata || '');
    }
  }

  /**
   * Info logging
   */
  info(message: string, metadata?: Record<string, any>): void {
    console.log('INFO:', message, metadata || '');
  }

  /**
   * Warning logging
   */
  warn(message: string, metadata?: Record<string, any>): void {
    console.warn('WARN:', message, metadata || '');
  }

  /**
   * Error logging
   */
  error(message: string, metadata?: Record<string, any>): void {
    console.error('ERROR:', message, metadata || '');
  }

  /**
   * HTTP request logging
   */
  http(message: string, metadata?: Record<string, any>): void {
    if (process.env.NODE_ENV === 'development') {
      console.log('HTTP:', message, metadata || '');
    }
  }

  /**
   * Audit logging for tracking important operations
   */
  audit(
    event: string,
    category?: string,
    userId?: string | undefined,
    metadata?: Record<string, any>
  ): void {
    console.log('AUDIT:', event, category || '', userId || '', metadata || '');
  }
}

export const logger = new Logger();
export default logger;
