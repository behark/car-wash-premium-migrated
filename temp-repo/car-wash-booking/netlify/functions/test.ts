/**
 * Test Endpoint
 * GET /api/test
 *
 * Simple health check endpoint to verify API functionality
 */

import { createGetHandler } from './lib/request-handler';

/**
 * Test endpoint handler
 * Returns a simple status message with timestamp
 */
export const handler = createGetHandler(
  {}, // No validation needed for this simple endpoint
  async () => {
    return {
      message: 'API is working correctly!',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
    };
  }
);