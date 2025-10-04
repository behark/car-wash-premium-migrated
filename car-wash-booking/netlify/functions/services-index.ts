/**
 * Services Listing Endpoint - Simplified Version
 * GET /api/services?active=true
 */

import { Handler, HandlerEvent } from '@netlify/functions';
import { PrismaClient } from '@prisma/client';

const handler: Handler = async (event: HandlerEvent) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  let prisma: PrismaClient | null = null;

  try {
    // Create Prisma client (same pattern as health endpoint)
    prisma = new PrismaClient();

    // Get query parameter
    const active = event.queryStringParameters?.active;

    // Build where clause
    const whereClause = active === 'true' ? { isActive: true } :
                       active === 'false' ? { isActive: false } :
                       {}; // No filter if not specified

    // Fetch services
    const services = await prisma.service.findMany({
      where: whereClause,
      orderBy: { priceCents: 'asc' },
    });

    // Format services
    const formattedServices = services.map(service => ({
      id: service.id,
      titleFi: service.titleFi,
      titleEn: service.titleEn,
      descriptionFi: service.descriptionFi,
      descriptionEn: service.descriptionEn,
      durationMinutes: service.durationMinutes,
      priceCents: service.priceCents,
      price: (service.priceCents / 100).toFixed(2),
      isActive: service.isActive,
      createdAt: service.createdAt.toISOString(),
      updatedAt: service.updatedAt.toISOString(),
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: formattedServices,
        meta: {
          total: formattedServices.length,
          active: formattedServices.filter(s => s.isActive).length,
          timestamp: new Date().toISOString(),
        },
      }),
    };
  } catch (error: any) {
    console.error('Services endpoint error:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Failed to fetch services',
        message: error.message,
        timestamp: new Date().toISOString(),
      }),
    };
  } finally {
    if (prisma) {
      await prisma.$disconnect().catch(err =>
        console.error('Failed to disconnect Prisma:', err)
      );
    }
  }
};

export { handler };