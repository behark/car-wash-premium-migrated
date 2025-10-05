/**
 * Cached Booking Service
 * High-performance booking service with intelligent caching
 */

import { BookingStatus, PaymentStatus } from '@prisma/client';
import { format, startOfDay, endOfDay } from 'date-fns';
import { BookingService, type BookingData, type PaymentData, type BookingOptions } from './booking-service';
import { cacheService } from '../cache/cache-service';
import { executeDbRead } from '../prisma';
import { logger } from '../logger';

export class CachedBookingService extends BookingService {
  private readonly cacheService = cacheService;

  /**
   * Check availability with intelligent caching
   */
  async checkAvailability(
    date: Date,
    serviceId: number,
    options: { includeCapacity?: boolean; skipCache?: boolean } = {}
  ) {
    const dateString = format(date, 'yyyy-MM-dd');
    const cacheKey = `availability:${serviceId}:${dateString}:${options.includeCapacity ? 'detailed' : 'simple'}`;

    return this.cacheService.cacheAside(
      cacheKey,
      async () => {
        logger.debug('Cache miss - fetching availability from database', {
          serviceId,
          date: dateString,
        });

        return super.checkAvailability(date, serviceId, options);
      },
      {
        ttl: 300, // 5 minutes cache
        tags: ['availability', `service:${serviceId}`, `date:${dateString}`],
        skipCache: options.skipCache,
        refreshThreshold: 60, // Refresh when TTL < 1 minute
        backgroundRefresh: true,
      }
    );
  }

  /**
   * Get service with caching
   */
  async getService(serviceId: number, options: { skipCache?: boolean } = {}) {
    const cacheKey = { prefix: 'service', id: serviceId };

    return this.cacheService.get(
      cacheKey,
      async () => {
        logger.debug('Cache miss - fetching service from database', { serviceId });

        return executeDbRead(
          async (client) => {
            return client.service.findUnique({
              where: { id: serviceId, isActive: true },
            });
          },
          'get_service_cached'
        );
      },
      {
        ttl: 3600, // 1 hour cache
        tags: ['services', `service:${serviceId}`],
        skipCache: options.skipCache,
      }
    );
  }

  /**
   * Get all services with caching
   */
  async getServices(options: {
    includeInactive?: boolean;
    skipCache?: boolean;
  } = {}) {
    const cacheKey = {
      prefix: 'services',
      id: 'all',
      suffix: options.includeInactive ? 'with_inactive' : 'active_only',
    };

    return this.cacheService.get(
      cacheKey,
      async () => {
        logger.debug('Cache miss - fetching services from database', {
          includeInactive: options.includeInactive,
        });

        return executeDbRead(
          async (client) => {
            const where = options.includeInactive ? {} : { isActive: true };

            return client.service.findMany({
              where,
              orderBy: { titleFi: 'asc' },
            });
          },
          'get_services_cached'
        );
      },
      {
        ttl: 1800, // 30 minutes cache
        tags: ['services'],
        skipCache: options.skipCache,
      }
    );
  }

  /**
   * Get bookings with caching for frequently accessed data
   */
  async getBookings(filters: {
    customerId?: string;
    serviceId?: number;
    status?: BookingStatus[];
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
    offset?: number;
    skipCache?: boolean;
  } = {}) {
    // Only cache simple, common queries
    const shouldCache = this.shouldCacheBookingQuery(filters);

    if (!shouldCache || filters.skipCache) {
      return super.getBookings(filters);
    }

    const cacheKey = this.buildBookingQueryCacheKey(filters);

    return this.cacheService.get(
      cacheKey,
      async () => {
        logger.debug('Cache miss - fetching bookings from database', { filters });
        return super.getBookings(filters);
      },
      {
        ttl: 180, // 3 minutes cache for booking queries
        tags: this.getBookingQueryTags(filters),
      }
    );
  }

  /**
   * Get daily stats with caching
   */
  async getDailyStats(
    date: Date,
    options: { skipCache?: boolean } = {}
  ) {
    const dateString = format(date, 'yyyy-MM-dd');
    const cacheKey = { prefix: 'stats', id: 'daily', suffix: dateString };

    return this.cacheService.get(
      cacheKey,
      async () => {
        logger.debug('Cache miss - calculating daily stats', { date: dateString });
        return super.getDailyStats(date);
      },
      {
        ttl: 900, // 15 minutes cache
        tags: ['stats', `date:${dateString}`],
        skipCache: options.skipCache,
      }
    );
  }

  /**
   * Create booking with cache invalidation
   */
  async createBooking(
    bookingData: BookingData,
    paymentData?: PaymentData,
    options: BookingOptions = {}
  ) {
    const result = await super.createBooking(bookingData, paymentData, options);

    if (result.success) {
      // Invalidate relevant caches
      await this.invalidateBookingCaches(bookingData);
    }

    return result;
  }

  /**
   * Update booking status with cache invalidation
   */
  async updateBookingStatus(
    bookingId: number,
    status: BookingStatus,
    options: {
      adminNotes?: string;
      userId?: string;
      reason?: string;
      metadata?: Record<string, any>;
    } = {}
  ) {
    const result = await super.updateBookingStatus(bookingId, status, options);

    if (result.success && result.result) {
      // Invalidate relevant caches
      await this.invalidateBookingRelatedCaches(result.result);
    }

    return result;
  }

  /**
   * Cancel booking with cache invalidation
   */
  async cancelBooking(
    bookingId: number,
    options: {
      reason?: string;
      refundAmount?: number;
      userId?: string;
      customerInitiated?: boolean;
    } = {}
  ) {
    // Get booking details first for cache invalidation
    const booking = await this.getBookingById(bookingId);

    const result = await super.cancelBooking(bookingId, options);

    if (result.success && booking) {
      // Invalidate relevant caches
      await this.invalidateBookingRelatedCaches(booking);
    }

    return result;
  }

  /**
   * Batch availability check with caching
   */
  async getBatchAvailability(
    requests: Array<{
      serviceId: number;
      date: Date;
      includeCapacity?: boolean;
    }>,
    options: { skipCache?: boolean } = {}
  ) {
    const cacheKeys = requests.map(req => ({
      key: `availability:${req.serviceId}:${format(req.date, 'yyyy-MM-dd')}:${req.includeCapacity ? 'detailed' : 'simple'}`,
      request: req,
    }));

    return this.cacheService.mget(
      cacheKeys.map(item => item.key),
      async (missingKeys) => {
        logger.debug('Batch availability cache miss', {
          missingCount: missingKeys.length,
          totalRequested: requests.length,
        });

        const result = new Map();

        // Process missing keys
        const missingRequests = cacheKeys
          .filter(item => missingKeys.includes(item.key))
          .map(item => item.request);

        const availabilityPromises = missingRequests.map(async (req) => {
          const availability = await super.checkAvailability(
            req.date,
            req.serviceId,
            { includeCapacity: req.includeCapacity }
          );

          const key = `availability:${req.serviceId}:${format(req.date, 'yyyy-MM-dd')}:${req.includeCapacity ? 'detailed' : 'simple'}`;
          result.set(key, availability);

          // Cache individually for future requests
          await this.cacheService.set(
            key,
            availability,
            {
              ttl: 300,
              tags: ['availability', `service:${req.serviceId}`, `date:${format(req.date, 'yyyy-MM-dd')}`],
            }
          );

          return { key, availability };
        });

        await Promise.all(availabilityPromises);
        return result;
      },
      {
        skipCache: options.skipCache,
      }
    );
  }

  /**
   * Warm up critical caches
   */
  async warmupCaches(options: {
    services?: boolean;
    todayAvailability?: boolean;
    upcomingDaysAvailability?: number;
    onProgress?: (completed: number, total: number) => void;
  } = {}) {
    const warmupItems: Array<{
      key: string;
      fetcher: () => Promise<any>;
      options?: any;
    }> = [];

    // Warm up services cache
    if (options.services !== false) {
      warmupItems.push({
        key: 'services:all:active_only',
        fetcher: () => this.getServices({ skipCache: true }),
        options: { ttl: 1800, tags: ['services'] },
      });
    }

    // Warm up today's availability
    if (options.todayAvailability !== false) {
      const services = await this.getServices({ skipCache: true });
      const today = new Date();

      if (services) {
        for (const service of services) {
          warmupItems.push({
            key: `availability:${service.id}:${format(today, 'yyyy-MM-dd')}:simple`,
            fetcher: () => this.checkAvailability(today, service.id, { skipCache: true }),
            options: {
              ttl: 300,
              tags: ['availability', `service:${service.id}`, `date:${format(today, 'yyyy-MM-dd')}`],
            },
          });
        }
      }
    }

    // Warm up upcoming days availability
    if (options.upcomingDaysAvailability && options.upcomingDaysAvailability > 0) {
      const services = await this.getServices({ skipCache: true });
      const days = options.upcomingDaysAvailability;

      if (services) {
        for (let dayOffset = 1; dayOffset <= days; dayOffset++) {
          const date = new Date();
          date.setDate(date.getDate() + dayOffset);

          for (const service of services) {
            warmupItems.push({
              key: `availability:${service.id}:${format(date, 'yyyy-MM-dd')}:simple`,
              fetcher: () => this.checkAvailability(date, service.id, { skipCache: true }),
              options: {
                ttl: 300,
                tags: ['availability', `service:${service.id}`, `date:${format(date, 'yyyy-MM-dd')}`],
              },
            });
          }
        }
      }
    }

    logger.info('Starting cache warmup', { totalItems: warmupItems.length });

    await this.cacheService.warmup(warmupItems, {
      batchSize: 5,
      concurrency: 2,
      onProgress: options.onProgress,
      onError: (error, key) => {
        logger.warn('Cache warmup item failed', { key, error: error.message });
      },
    });
  }

  /**
   * Get cache health and performance metrics
   */
  getCacheHealth() {
    return this.cacheService.getHealthStats();
  }

  /**
   * Manually invalidate all booking-related caches
   */
  async invalidateAllBookingCaches(): Promise<void> {
    await Promise.all([
      this.cacheService.invalidateByTags(['availability']),
      this.cacheService.invalidateByTags(['stats']),
      this.cacheService.invalidateByTags(['bookings']),
    ]);

    logger.info('All booking-related caches invalidated');
  }

  // Private helper methods

  private async getBookingById(bookingId: number) {
    return executeDbRead(
      async (client) => {
        return client.booking.findUnique({
          where: { id: bookingId },
          include: { service: true },
        });
      },
      'get_booking_by_id'
    );
  }

  private async invalidateBookingCaches(bookingData: BookingData): Promise<void> {
    const dateString = format(bookingData.date, 'yyyy-MM-dd');

    await Promise.all([
      // Invalidate availability for the service and date
      this.cacheService.invalidateByTags([
        `service:${bookingData.serviceId}`,
        `date:${dateString}`,
        'availability',
      ]),
      // Invalidate daily stats
      this.cacheService.invalidateByTags([`date:${dateString}`, 'stats']),
      // Invalidate booking queries that might include this booking
      this.cacheService.invalidateByTags(['bookings']),
    ]);

    logger.debug('Booking caches invalidated', {
      serviceId: bookingData.serviceId,
      date: dateString,
    });
  }

  private async invalidateBookingRelatedCaches(booking: any): Promise<void> {
    const dateString = format(booking.date, 'yyyy-MM-dd');

    await Promise.all([
      // Invalidate availability
      this.cacheService.invalidateByTags([
        `service:${booking.serviceId}`,
        `date:${dateString}`,
        'availability',
      ]),
      // Invalidate stats
      this.cacheService.invalidateByTags([`date:${dateString}`, 'stats']),
      // Invalidate booking queries
      this.cacheService.invalidateByTags(['bookings']),
    ]);

    logger.debug('Booking-related caches invalidated', {
      bookingId: booking.id,
      serviceId: booking.serviceId,
      date: dateString,
    });
  }

  private shouldCacheBookingQuery(filters: any): boolean {
    // Only cache simple queries without complex filters
    const complexFilters = ['customerId', 'dateFrom', 'dateTo', 'offset'];
    const hasComplexFilters = complexFilters.some(filter => filters[filter] !== undefined);

    // Cache queries for specific services with basic status filters
    const isCacheable = !hasComplexFilters &&
      (filters.serviceId !== undefined || filters.status !== undefined) &&
      (!filters.limit || filters.limit <= 50);

    return isCacheable;
  }

  private buildBookingQueryCacheKey(filters: any): string {
    const keyParts = ['bookings'];

    if (filters.serviceId) {
      keyParts.push(`service:${filters.serviceId}`);
    }

    if (filters.status) {
      keyParts.push(`status:${filters.status.join(',')}`);
    }

    if (filters.limit) {
      keyParts.push(`limit:${filters.limit}`);
    }

    return keyParts.join(':');
  }

  private getBookingQueryTags(filters: any): string[] {
    const tags = ['bookings'];

    if (filters.serviceId) {
      tags.push(`service:${filters.serviceId}`);
    }

    return tags;
  }
}

// Export singleton instance
export const cachedBookingService = new CachedBookingService();