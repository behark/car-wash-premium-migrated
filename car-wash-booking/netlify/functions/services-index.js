const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

exports.handler = async (event, context) => {
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

  try {
    if (event.httpMethod === 'GET') {
      // Get query parameters
      const { active } = event.queryStringParameters || {};

      // Fetch services with optional active filter
      const services = await prisma.service.findMany({
        where: active === 'true' ? { isActive: true } : undefined,
        orderBy: { priceCents: 'asc' },
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(services),
      };
    }

    if (event.httpMethod === 'POST') {
      // For now, return method not allowed for POST in production
      // This would typically require authentication
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' }),
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  } catch (error) {
    console.error('Service API error:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      }),
    };
  } finally {
    await prisma.$disconnect();
  }
};