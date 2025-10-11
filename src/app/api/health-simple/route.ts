/**
 * Simple Health Check for Render Deployment
 * Basic endpoint to verify service is running
 * GET /api/health-simple
 */

import { NextResponse } from 'next/server';

export async function GET() {
  const timestamp = new Date().toISOString();
  const uptime = Math.floor(process.uptime());

  const response = {
    status: 'healthy',
    timestamp,
    uptime,
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'unknown',
    message: 'Car Wash Booking Service is running',
    system: {
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
      },
      node: {
        version: process.version,
        platform: process.platform,
      }
    }
  };

  return NextResponse.json(response, { status: 200 });
}