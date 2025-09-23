import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  // Validate database URL format
  if (isProduction && process.env.DATABASE_URL.includes('file:')) {
    throw new Error('SQLite database not allowed in production. Use PostgreSQL.');
  }

  const client = new PrismaClient({
    log: isProduction
      ? [{ emit: 'event', level: 'error' }]
      : [
          { emit: 'event', level: 'query' },
          { emit: 'event', level: 'error' },
          { emit: 'event', level: 'warn' }
        ],
    errorFormat: isProduction ? 'minimal' : 'pretty',
  });

  // Add logging listeners
  if (isProduction) {
    client.$on('error', (e) => {
      logger.error('Database error', {
        target: e.target,
        timestamp: e.timestamp,
        message: e.message
      });
    });
  } else {
    client.$on('query', (e) => {
      logger.debug('Database query', {
        query: e.query,
        duration: `${e.duration}ms`,
        timestamp: e.timestamp
      });
    });

    client.$on('error', (e) => {
      logger.error('Database error', e);
    });

    client.$on('warn', (e) => {
      logger.warn('Database warning', e);
    });
  }

  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Graceful shutdown
process.on('beforeExit', async () => {
  logger.info('Closing database connection...');
  await prisma.$disconnect();
});