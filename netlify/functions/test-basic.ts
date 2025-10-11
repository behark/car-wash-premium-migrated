/**
 * Ultra Basic Test Function
 */

import { Handler, HandlerEvent } from '@netlify/functions';

const handler: Handler = async (event: HandlerEvent) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // Test 1: Basic response
    const basicTest = {
      message: 'Basic function works',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      databaseUrl: process.env.DATABASE_URL ? 'Set' : 'Not set',
    };

    // Test 2: Try importing Prisma
    let prismaTest = 'Failed to import';
    try {
      const { PrismaClient } = await import('@prisma/client');
      prismaTest = 'Imported successfully';

      // Test 3: Try creating client
      const prisma = new PrismaClient();
      prismaTest = 'Client created successfully';

      // Test 4: Try simple query
      await prisma.$queryRaw`SELECT 1`;
      prismaTest = 'Database query successful';

      await prisma.$disconnect();
    } catch (prismaError: any) {
      prismaTest = `Prisma error: ${prismaError.message}`;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        tests: {
          basic: basicTest,
          prisma: prismaTest,
        },
      }),
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack,
      }),
    };
  }
};

export { handler };