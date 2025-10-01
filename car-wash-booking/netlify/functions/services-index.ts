import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

const createServiceSchema = z.object({
  titleFi: z.string().min(2),
  titleEn: z.string().min(2),
  descriptionFi: z.string().min(10),
  descriptionEn: z.string().min(10),
  priceCents: z.number().min(0),
  durationMinutes: z.number().min(15),
  capacity: z.number().min(1).default(1),
  image: z.string().url().optional(),
  isActive: z.boolean().default(true),
});

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle OPTIONS request for CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  if (event.httpMethod === 'GET') {
    try {
      const active = event.queryStringParameters?.active;

      const services = await prisma.service.findMany({
        where: active === 'true' ? { isActive: true } : undefined,
        orderBy: { priceCents: 'asc' },
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          services,
        }),
      };
    } catch (error: any) {
      console.error('Get services error:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Failed to get services',
          message: error.message,
        }),
      };
    }
  } else if (event.httpMethod === 'POST') {
    // Admin authentication would need to be handled differently in serverless
    // For now, we'll disable POST to services (admin functionality)
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({ error: 'Admin operations not available in serverless mode' }),
    };
  } else {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }
};

export { handler };
