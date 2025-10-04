import { Handler } from '@netlify/functions';

const handler: Handler = async () => {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    env: {
      DATABASE_URL: process.env.DATABASE_URL ? 'SET (length: ' + process.env.DATABASE_URL.length + ')' : 'MISSING',
      NODE_ENV: process.env.NODE_ENV || 'not set',
    },
    prisma: {
      clientExists: false,
      canImport: false,
      error: null as string | null,
    }
  };

  // Try to import Prisma
  try {
    const { PrismaClient } = await import('@prisma/client');
    diagnostics.prisma.clientExists = true;
    diagnostics.prisma.canImport = true;

    // Try to create client
    const prisma = new PrismaClient();
    await prisma.$connect();
    await prisma.$disconnect();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...diagnostics, status: 'OK', message: 'All systems operational' }, null, 2),
    };
  } catch (error: any) {
    diagnostics.prisma.error = error.message;

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...diagnostics, status: 'ERROR', error: error.message }, null, 2),
    };
  }
};

export { handler };
