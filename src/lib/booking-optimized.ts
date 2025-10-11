/**
 * Optimized booking system queries for production performance
 * Implements caching, connection pooling, and query optimization
 */

import { prisma } from './prisma';
import { BookingStatus, PaymentStatus } from '@prisma/client';
import { format, addMinutes, parseISO, startOfDay, endOfDay } from 'date-fns';
import Redis from 'ioredis';
import { logger } from './logger';

// Redis cache configuration
const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;

// Cache configuration
const CACHE_TTL = {
  AVAILABILITY: 300,      // 5 minutes
  BUSINESS_HOURS: 86400,  // 24 hours
  SERVICE_LIST: 3600,     // 1 hour
  HOLIDAYS: 604800,       // 1 week
  DAILY_STATS: 900,       // 15 minutes
};

// Cache key patterns
const getCacheKey = {
  availability: (date: string, serviceId: number) => `availability:${date}:${serviceId}`,
  businessHours: (dayOfWeek: number) => `business_hours:${dayOfWeek}`,
  services: () => 'services:active',
  holidays: (year: number, month: number) => `holidays:${year}:${month}`,
  dailyStats: (date: string) => `stats:${date}`,
  bookingLock: (date: string, time: string) => `lock:booking:${date}:${time}`,
};

export interface TimeSlot {
  time: string;
  available: boolean;
  capacity?: number;
}

export interface BookingData {
  serviceId: number;
  vehicleType: string;
  date: Date;
  startTime: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  licensePlate?: string;
  notes?: string;
}

/**
 * Generate unique confirmation code
 */
export function generateConfirmationCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Get data from cache or database with fallback
 */
async function getCachedOrFetch<T>(
  key: string,
  ttl: number,
  fetchFn: () => Promise<T>
): Promise<T> {
  if (!redis) {
    return fetchFn();
  }

  try {
    // Try cache first
    const cached = await redis.get(key);
    if (cached) {
      logger.debug(`Cache hit: ${key}`);
      return JSON.parse(cached);
    }

    // Fetch from database
    const data = await fetchFn();

    // Store in cache
    await redis.setex(key, ttl, JSON.stringify(data));
    logger.debug(`Cache miss, stored: ${key}`);

    return data;
  } catch (error) {
    logger.error('Cache error, falling back to database', { error: error instanceof Error ? error.message : String(error) });
    return fetchFn();
  }
}

/**
 * Invalidate cache keys matching pattern
 */
async function invalidateCache(pattern: string): Promise<void> {
  if (!redis) return;

  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
      logger.debug(`Invalidated ${keys.length} cache keys matching: ${pattern}`);
    }
  } catch (error) {
    logger.error('Cache invalidation error', { error: error instanceof Error ? error.message : String(error) });
  }
}

/**
 * Optimized availability check using database function and caching
 */
export async function checkAvailability(date: Date, serviceId: number): Promise<TimeSlot[]> {
  const dateStr = format(date, 'yyyy-MM-dd');
  const cacheKey = getCacheKey.availability(dateStr, serviceId);

  return getCachedOrFetch(cacheKey, CACHE_TTL.AVAILABILITY, async () => {
    // Use optimized database function if available
    try {
      const slots = await prisma.$queryRaw<Array<{ slot_time: string; is_available: boolean }>>`
        SELECT * FROM get_available_slots(${date}::date, ${serviceId}::integer)
      `;

      return slots.map(slot => ({
        time: slot.slot_time.substring(0, 5), // Format as HH:mm
        available: slot.is_available,
      }));
    } catch (error) {
      // Fallback to application-level logic if function doesn't exist
      logger.warn('Database function not available, using fallback', { error: error instanceof Error ? error.message : String(error) });
      return checkAvailabilityFallback(date, serviceId);
    }
  });
}

/**
 * Fallback availability check (original implementation)
 */
async function checkAvailabilityFallback(date: Date, serviceId: number): Promise<TimeSlot[]> {
  const [service, businessHours, holidays, existingBookings] = await Promise.all([
    // Get service details
    prisma.service.findUnique({
      where: { id: serviceId },
    }),

    // Get business hours (cached)
    getCachedOrFetch(
      getCacheKey.businessHours(date.getDay()),
      CACHE_TTL.BUSINESS_HOURS,
      () => prisma.businessHours.findUnique({
        where: { dayOfWeek: date.getDay() },
      })
    ),

    // Check holidays (cached)
    getCachedOrFetch(
      getCacheKey.holidays(date.getFullYear(), date.getMonth()),
      CACHE_TTL.HOLIDAYS,
      () => prisma.holiday.findFirst({
        where: {
          date: {
            gte: startOfDay(date),
            lte: endOfDay(date),
          },
        },
      })
    ),

    // Get existing bookings
    prisma.booking.findMany({
      where: {
        date: {
          gte: startOfDay(date),
          lte: endOfDay(date),
        },
        status: {
          notIn: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW],
        },
      },
      select: {
        startTime: true,
        endTime: true,
        duration: true,
      },
    }),
  ]);

  if (!service) {
    throw new Error('Service not found');
  }

  if (!businessHours?.isOpen || holidays) {
    return [];
  }

  const timeSlots: TimeSlot[] = [];
  const startHour = parseInt(businessHours.startTime.split(':')[0]);
  const startMinute = parseInt(businessHours.startTime.split(':')[1]);
  const endHour = parseInt(businessHours.endTime.split(':')[0]);
  const endMinute = parseInt(businessHours.endTime.split(':')[1]);

  let currentTime = new Date(date);
  currentTime.setHours(startHour, startMinute, 0, 0);

  const endTime = new Date(date);
  endTime.setHours(endHour, endMinute, 0, 0);


  while (currentTime < endTime) {
    const timeString = format(currentTime, 'HH:mm');
    const slotEndTime = addMinutes(currentTime, service.durationMinutes);

    // Check break times
    if (businessHours.breakStart && businessHours.breakEnd) {
      const breakStart = new Date(date);
      const [breakStartHour, breakStartMinute] = businessHours.breakStart.split(':').map(Number);
      breakStart.setHours(breakStartHour, breakStartMinute, 0, 0);

      const breakEnd = new Date(date);
      const [breakEndHour, breakEndMinute] = businessHours.breakEnd.split(':').map(Number);
      breakEnd.setHours(breakEndHour, breakEndMinute, 0, 0);

      if (
        (currentTime >= breakStart && currentTime < breakEnd) ||
        (slotEndTime > breakStart && slotEndTime <= breakEnd)
      ) {
        currentTime = addMinutes(currentTime, 30);
        continue;
      }
    }

    // Quick lookup for availability
    const isBooked = existingBookings.some(booking => {
      const bookingStart = parseISO(`${format(date, 'yyyy-MM-dd')}T${booking.startTime}`);
      const bookingEnd = parseISO(`${format(date, 'yyyy-MM-dd')}T${booking.endTime}`);

      return (
        (currentTime >= bookingStart && currentTime < bookingEnd) ||
        (slotEndTime > bookingStart && slotEndTime <= bookingEnd) ||
        (currentTime <= bookingStart && slotEndTime >= bookingEnd)
      );
    });

    if (slotEndTime <= endTime) {
      timeSlots.push({
        time: timeString,
        available: !isBooked,
      });
    }

    currentTime = addMinutes(currentTime, 30);
  }

  return timeSlots;
}

/**
 * Create booking with optimistic locking and race condition prevention
 */
export async function createBooking(data: BookingData) {
  const lockKey = getCacheKey.bookingLock(
    format(data.date, 'yyyy-MM-dd'),
    data.startTime
  );

  // Try to acquire lock (if Redis available)
  if (redis) {
    const lockAcquired = await redis.set(lockKey, '1', 'EX', 10, 'NX');
    if (!lockAcquired) {
      throw new Error('Another booking is being processed for this time slot');
    }
  }

  try {
    // Use transaction for atomicity
    const booking = await prisma.$transaction(async (tx) => {
      // Get service
      const service = await tx.service.findUnique({
        where: { id: data.serviceId },
      });

      if (!service) {
        throw new Error('Service not found');
      }

      const startDateTime = new Date(data.date);
      const [hours, minutes] = data.startTime.split(':').map(Number);
      startDateTime.setHours(hours, minutes, 0, 0);

      const endDateTime = addMinutes(startDateTime, service.durationMinutes);

      // Check for overlapping bookings with row-level locking
      const overlappingBooking = await tx.$queryRaw`
        SELECT id FROM "Booking"
        WHERE date = ${data.date}::date
          AND status NOT IN ('CANCELLED', 'NO_SHOW')
          AND (
            (${format(startDateTime, 'HH:mm')} >= "startTime" AND ${format(startDateTime, 'HH:mm')} < "endTime")
            OR (${format(endDateTime, 'HH:mm')} > "startTime" AND ${format(endDateTime, 'HH:mm')} <= "endTime")
            OR (${format(startDateTime, 'HH:mm')} <= "startTime" AND ${format(endDateTime, 'HH:mm')} >= "endTime")
          )
        FOR UPDATE
        LIMIT 1
      `;

      if (Array.isArray(overlappingBooking) && overlappingBooking.length > 0) {
        throw new Error('Time slot is not available');
      }

      // Generate unique confirmation code
      let confirmationCode: string;
      let attempts = 0;
      do {
        confirmationCode = generateConfirmationCode();
        const existing = await tx.booking.findUnique({
          where: { confirmationCode },
        });
        if (!existing) break;
        attempts++;
      } while (attempts < 10);

      if (attempts >= 10) {
        throw new Error('Failed to generate unique confirmation code');
      }

      // Create booking
      const newBooking = await tx.booking.create({
        data: {
          serviceId: data.serviceId,
          vehicleType: data.vehicleType,
          date: data.date,
          startTime: format(startDateTime, 'HH:mm'),
          endTime: format(endDateTime, 'HH:mm'),
          duration: service.durationMinutes,
          priceCents: service.priceCents,
          status: BookingStatus.PENDING,
          customerName: data.customerName,
          customerEmail: data.customerEmail,
          customerPhone: data.customerPhone,
          licensePlate: data.licensePlate,
          notes: data.notes,
          paymentStatus: PaymentStatus.PENDING,
          confirmationCode,
        },
        include: {
          service: true,
        },
      });

      return newBooking;
    }, {
      isolationLevel: 'Serializable', // Prevent race conditions
      maxWait: 5000,
      timeout: 10000,
    });

    // Invalidate availability cache for this date
    await invalidateCache(`availability:${format(data.date, 'yyyy-MM-dd')}:*`);

    return booking;
  } finally {
    // Release lock
    if (redis) {
      await redis.del(lockKey);
    }
  }
}

/**
 * Update booking status with cache invalidation
 */
export async function updateBookingStatus(
  bookingId: number,
  status: BookingStatus,
  adminNotes?: string
) {
  const booking = await prisma.$transaction(async (tx) => {
    // Get current booking for cache invalidation
    const currentBooking = await tx.booking.findUnique({
      where: { id: bookingId },
      select: { date: true },
    });

    if (!currentBooking) {
      throw new Error('Booking not found');
    }

    const updateData: any = { status };

    if (adminNotes) {
      updateData.adminNotes = adminNotes;
    }

    if (status === BookingStatus.CANCELLED) {
      updateData.cancelledAt = new Date();
    } else if (status === BookingStatus.COMPLETED) {
      updateData.completedAt = new Date();
    }

    const updatedBooking = await tx.booking.update({
      where: { id: bookingId },
      data: updateData,
      include: {
        service: true,
      },
    });

    return updatedBooking;
  });

  // Invalidate relevant caches
  await invalidateCache(`availability:${format(booking.date, 'yyyy-MM-dd')}:*`);
  await invalidateCache(`stats:${format(booking.date, 'yyyy-MM-dd')}`);

  return booking;
}

/**
 * Get booking by confirmation code with caching
 */
export async function getBookingByConfirmationCode(code: string) {
  const cacheKey = `booking:confirmation:${code}`;

  return getCachedOrFetch(cacheKey, 300, async () => {
    const booking = await prisma.booking.findUnique({
      where: { confirmationCode: code },
      include: {
        service: true,
      },
    });

    return booking;
  });
}

/**
 * Get upcoming bookings with optimized query
 */
export async function getUpcomingBookings(limit = 10) {
  const bookings = await prisma.booking.findMany({
    where: {
      date: {
        gte: new Date(),
      },
      status: {
        notIn: [BookingStatus.CANCELLED, BookingStatus.COMPLETED],
      },
    },
    orderBy: [
      { date: 'asc' },
      { startTime: 'asc' },
    ],
    take: limit,
    include: {
      service: {
        select: {
          id: true,
          titleFi: true,
          titleEn: true,
          priceCents: true,
          durationMinutes: true,
        },
      },
    },
  });

  return bookings;
}

/**
 * Get today's bookings with caching
 */
export async function getTodaysBookings() {
  const today = new Date();
  const cacheKey = `bookings:today:${format(today, 'yyyy-MM-dd')}`;

  return getCachedOrFetch(cacheKey, 60, async () => {
    const bookings = await prisma.booking.findMany({
      where: {
        date: {
          gte: startOfDay(today),
          lte: endOfDay(today),
        },
        status: {
          notIn: [BookingStatus.CANCELLED],
        },
      },
      orderBy: [
        { startTime: 'asc' },
      ],
      include: {
        service: {
          select: {
            id: true,
            titleFi: true,
            titleEn: true,
            priceCents: true,
            durationMinutes: true,
          },
        },
      },
    });

    return bookings;
  });
}

/**
 * Get daily statistics using materialized view or cached aggregation
 */
export async function getDailyStats(date: Date) {
  const dateStr = format(date, 'yyyy-MM-dd');
  const cacheKey = getCacheKey.dailyStats(dateStr);

  return getCachedOrFetch(cacheKey, CACHE_TTL.DAILY_STATS, async () => {
    try {
      // Try to use materialized view first
      const stats = await prisma.$queryRaw<Array<{
        total_bookings: bigint;
        confirmed_bookings: bigint;
        completed_bookings: bigint;
        cancelled_bookings: bigint;
        daily_revenue: number;
        unique_customers: bigint;
      }>>`
        SELECT * FROM booking_daily_stats
        WHERE date = ${date}::date
      `;

      if (stats.length > 0) {
        const stat = stats[0];
        return {
          total: Number(stat.total_bookings),
          confirmed: Number(stat.confirmed_bookings),
          completed: Number(stat.completed_bookings),
          cancelled: Number(stat.cancelled_bookings),
          revenue: stat.daily_revenue,
          uniqueCustomers: Number(stat.unique_customers),
        };
      }
    } catch (error) {
      logger.warn('Materialized view not available, using fallback', { error: error instanceof Error ? error.message : String(error) });
    }

    // Fallback to regular aggregation
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);

    const [bookings, uniqueCustomers] = await Promise.all([
      prisma.booking.findMany({
        where: {
          date: {
            gte: dayStart,
            lte: dayEnd,
          },
        },
        select: {
          status: true,
          paymentStatus: true,
          priceCents: true,
        },
      }),
      prisma.booking.groupBy({
        by: ['customerEmail'],
        where: {
          date: {
            gte: dayStart,
            lte: dayEnd,
          },
        },
        _count: true,
      }),
    ]);

    const stats = {
      total: bookings.length,
      confirmed: bookings.filter(b => b.status === BookingStatus.CONFIRMED).length,
      completed: bookings.filter(b => b.status === BookingStatus.COMPLETED).length,
      cancelled: bookings.filter(b => b.status === BookingStatus.CANCELLED).length,
      revenue: bookings
        .filter(b => b.paymentStatus === PaymentStatus.PAID)
        .reduce((sum, b) => sum + b.priceCents, 0) / 100,
      uniqueCustomers: uniqueCustomers.length,
    };

    return stats;
  });
}

/**
 * Batch update booking statuses (for admin operations)
 */
export async function batchUpdateBookingStatus(
  bookingIds: number[],
  status: BookingStatus
) {
  const result = await prisma.booking.updateMany({
    where: {
      id: {
        in: bookingIds,
      },
    },
    data: {
      status,
      updatedAt: new Date(),
    },
  });

  // Invalidate all relevant caches
  await invalidateCache('availability:*');
  await invalidateCache('stats:*');
  await invalidateCache('bookings:today:*');

  return result;
}

/**
 * Get booking analytics for dashboard
 */
export async function getBookingAnalytics(startDate: Date, endDate: Date) {
  const cacheKey = `analytics:${format(startDate, 'yyyy-MM-dd')}:${format(endDate, 'yyyy-MM-dd')}`;

  return getCachedOrFetch(cacheKey, 3600, async () => {
    const analytics = await prisma.$queryRaw<Array<{
      date: Date;
      total_bookings: bigint;
      total_revenue: number;
      avg_booking_value: number;
      popular_service: string;
    }>>`
      SELECT
        date::date,
        COUNT(*) as total_bookings,
        SUM(CASE WHEN "paymentStatus" = 'PAID' THEN "priceCents" ELSE 0 END) / 100.0 as total_revenue,
        AVG(CASE WHEN "paymentStatus" = 'PAID' THEN "priceCents" ELSE NULL END) / 100.0 as avg_booking_value,
        (
          SELECT s."titleEn"
          FROM "Service" s
          WHERE s.id = (
            SELECT "serviceId"
            FROM "Booking" b2
            WHERE b2.date = b.date
            GROUP BY "serviceId"
            ORDER BY COUNT(*) DESC
            LIMIT 1
          )
        ) as popular_service
      FROM "Booking" b
      WHERE date >= ${startDate}::date
        AND date <= ${endDate}::date
      GROUP BY date
      ORDER BY date ASC
    `;

    return analytics.map(row => ({
      date: row.date,
      totalBookings: Number(row.total_bookings),
      totalRevenue: row.total_revenue,
      avgBookingValue: row.avg_booking_value,
      popularService: row.popular_service,
    }));
  });
}

/**
 * Clean up expired cache entries
 */
export async function cleanupCache() {
  if (!redis) return;

  try {
    // Get all keys and check TTL
    const keys = await redis.keys('*');
    let cleaned = 0;

    for (const key of keys) {
      const ttl = await redis.ttl(key);
      if (ttl === -1) {
        // Key exists but has no expiry, set default expiry
        await redis.expire(key, 86400); // 24 hours default
        cleaned++;
      }
    }

    logger.info(`Cache cleanup completed, ${cleaned} keys updated`);
  } catch (error) {
    logger.error('Cache cleanup error', { error: error instanceof Error ? error.message : String(error) });
  }
}

// Schedule cache cleanup every 6 hours
if (redis && process.env.NODE_ENV === 'production') {
  setInterval(() => {
    cleanupCache().catch(error => logger.error('Scheduled cache cleanup failed', error));
  }, 6 * 60 * 60 * 1000);
}