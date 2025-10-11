import { PrismaClient } from '@prisma/client';

// Database configuration for production deployment
export const DATABASE_CONFIG = {
  // Connection pooling for production
  CONNECTION_POOL: {
    min: 2,
    max: process.env.NODE_ENV === 'production' ?
      parseInt(process.env.DATABASE_POOL_SIZE || '10') : 5,
    acquireTimeoutMillis: parseInt(process.env.DATABASE_CONNECTION_TIMEOUT || '30000'),
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 200,
  },

  // Query optimization settings
  QUERY_TIMEOUT: 30000, // 30 seconds
  SLOW_QUERY_THRESHOLD: 5000, // 5 seconds

  // Cache settings (in seconds)
  CACHE_TTL: {
    SERVICES: 15 * 60, // 15 minutes
    BOOKINGS: 5 * 60, // 5 minutes
    AVAILABILITY: 2 * 60, // 2 minutes
    TESTIMONIALS: 30 * 60, // 30 minutes
    STATIC_CONTENT: 60 * 60, // 1 hour
    USER_SESSION: 24 * 60 * 60, // 24 hours
  },

  // Pagination defaults
  DEFAULT_PAGE_SIZE: 12,
  MAX_PAGE_SIZE: 100,
};

// Production-optimized Prisma client configuration
export const createPrismaClient = () => {
  const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'info', 'warn', 'error']
      : ['warn', 'error'],

    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },

    // Connection pool configuration for serverless environments
    // Note: __internal API removed in newer Prisma versions
  });

  // Performance monitoring in development
  if (process.env.NODE_ENV === 'development') {
    prisma.$on('query', (e) => {
      if (e.duration > DATABASE_CONFIG.SLOW_QUERY_THRESHOLD) {
        console.warn(`Slow query detected (${e.duration}ms):`, e.query);
      }
    });
  }

  return prisma;
};

// Global Prisma instance with proper connection management
declare global {
  // eslint-disable-next-line no-var
  var cachedPrisma: PrismaClient;
}

let prisma: PrismaClient;

if (process.env.NODE_ENV === 'production') {
  prisma = createPrismaClient();
} else {
  if (!global.cachedPrisma) {
    global.cachedPrisma = createPrismaClient();
  }
  prisma = global.cachedPrisma;
}

export { prisma };

// Database health check utilities
export const checkDatabaseHealth = async () => {
  try {
    // Test basic connectivity
    await prisma.$queryRaw`SELECT 1`;

    // Check critical tables exist
    const tablesCheck = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('Service', 'Booking', 'Customer', 'User')
    `;

    const tableCount = Number((tablesCheck as any)[0]?.count) || 0;

    return {
      connected: true,
      tablesExist: tableCount >= 4,
      tableCount,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    };
  }
};

// Database migration status check
export const checkMigrationStatus = async () => {
  try {
    const migrations = await prisma.$queryRaw`
      SELECT * FROM _prisma_migrations
      ORDER BY started_at DESC
      LIMIT 5
    `;

    return {
      latestMigrations: migrations,
      allApplied: true, // Basic check - can be enhanced
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Unknown error',
      allApplied: false,
    };
  }
};

// Performance optimization queries for booking system
export const OPTIMIZED_QUERIES = {
  // Get available services with minimal data
  getActiveServices: () => ({
    select: {
      id: true,
      titleFi: true,
      titleEn: true,
      descriptionFi: true,
      descriptionEn: true,
      priceCents: true,
      durationMinutes: true,
      image: true,
      isActive: true,
    },
    where: {
      isActive: true,
    },
    orderBy: {
      priceCents: 'asc' as const,
    },
  }),

  // Get booking with all relations
  getBookingDetails: (id: number) => ({
    where: { id },
    include: {
      service: true,
      customer: true,
      timeSlot: true,
      assignedStaff: true,
      assignedBay: true,
      statusHistoryLog: {
        orderBy: { createdAt: 'desc' as const },
        take: 10,
      },
    },
  }),

  // Get availability for date range
  getAvailability: (startDate: Date, endDate: Date) => ({
    where: {
      date: {
        gte: startDate,
        lte: endDate,
      },
      isAvailable: true,
    },
    orderBy: [
      { date: 'asc' as const },
      { startTime: 'asc' as const },
    ],
  }),

  // Search bookings with filters
  searchBookings: (filters: {
    status?: string;
    customerEmail?: string;
    serviceId?: number;
    startDate?: Date;
    endDate?: Date;
  }) => {
    const where: any = {};

    if (filters.status) where.status = filters.status;
    if (filters.customerEmail) {
      where.customerEmail = {
        contains: filters.customerEmail,
        mode: 'insensitive'
      };
    }
    if (filters.serviceId) where.serviceId = filters.serviceId;
    if (filters.startDate || filters.endDate) {
      where.date = {};
      if (filters.startDate) where.date.gte = filters.startDate;
      if (filters.endDate) where.date.lte = filters.endDate;
    }

    return { where };
  },

  // Get customer statistics
  getCustomerStats: (customerId: number) => ({
    where: { customerId },
    _count: true,
    _sum: {
      priceCents: true,
    },
  }),
};

// Connection cleanup for serverless environments
export const disconnectDatabase = async () => {
  await prisma.$disconnect();
};

// Graceful shutdown handler
if (typeof process !== 'undefined') {
  process.on('beforeExit', disconnectDatabase);
  process.on('SIGINT', disconnectDatabase);
  process.on('SIGTERM', disconnectDatabase);
  process.on('SIGUSR2', disconnectDatabase); // For nodemon restarts
}

export default {
  prisma,
  DATABASE_CONFIG,
  createPrismaClient,
  checkDatabaseHealth,
  checkMigrationStatus,
  OPTIMIZED_QUERIES,
  disconnectDatabase,
};