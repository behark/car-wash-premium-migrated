import { NextResponse } from 'next/server';

export async function GET() {
  const timestamp = new Date().toISOString();
  const uptime = Math.floor(process.uptime());

  // System information
  const memUsage = process.memoryUsage();
  const memUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const memTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);

  // Simple health response for the booking system
  const response = {
    status: 'healthy',
    timestamp,
    uptime,
    version: '2.0.0', // Updated version with simple booking system
    environment: process.env.NODE_ENV || 'development',
    system: {
      memory: {
        used: memUsedMB,
        total: memTotalMB,
        percentage: Math.round((memUsedMB / memTotalMB) * 100),
      },
      node: {
        version: process.version,
        platform: process.platform,
      }
    },
    booking: {
      email: !!process.env.SMTP_HOST,
      whatsapp: !!process.env.TWILIO_ACCOUNT_SID,
    }
  };

  return NextResponse.json(response);
}