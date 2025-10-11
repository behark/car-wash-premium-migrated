/**
 * Simple Services Endpoint for Testing
 * GET /api/services-simple
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
    // Create Prisma client
    prisma = new PrismaClient();
    await prisma.$connect();

    // Get services
    const services = await prisma.service.findMany({
      where: { isActive: true },
      orderBy: { priceCents: 'asc' },
    });

    // Format response
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
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: formattedServices,
        count: formattedServices.length,
      }),
    };
  } catch (error: any) {
    console.error('Error:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Internal server error',
        message: error.message,
      }),
    };
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
  }
};

export { handler };