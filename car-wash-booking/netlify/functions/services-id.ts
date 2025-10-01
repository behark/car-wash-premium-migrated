import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
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

  try {
    const id = event.path.split('/').pop();
    const serviceId = parseInt(id || '');

    if (isNaN(serviceId)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid service ID' }),
      };
    }

    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Service not found' }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        service,
      }),
    };
  } catch (error: any) {
    console.error('Get service error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to get service',
        message: error.message,
      }),
    };
  }
};

export { handler };
