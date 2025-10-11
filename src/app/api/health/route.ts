/**
 * Simple Health Check API Endpoint
 * GET /api/health
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma-simple';

export async function GET() {
  try {
    // Simple database connectivity check
    await prisma.$queryRaw`SELECT 1`;

    const memUsage = process.memoryUsage();
    const memUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const memTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      checks: {
        database: {
          status: 'pass',
          message: 'Database connection successful'
        }
      },
      memory: {
        used: memUsedMB,
        total: memTotalMB,
        percentage: Math.round((memUsedMB / memTotalMB) * 100)
      },
      version: '1.0.0'
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
        checks: {
          database: {
            status: 'fail',
            message: 'Database connection failed'
          }
        }
      },
      { status: 503 }
    );
  }
}