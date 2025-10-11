/**
 * Enhanced Booking Service
 * Enterprise-grade booking logic with transaction patterns and error handling
 */

import { BookingStatus, PaymentStatus, PrismaClient } from '@prisma/client';
import { format, addMinutes, parseISO, startOfDay, endOfDay } from 'date-fns';
import {
  executeDbRead,
  // executeDbTransaction is not used in this file
  transactionManager,
  createBookingSaga,
  type SagaDefinition,
  type TransactionResult,
} from '../prisma';
import { logger } from '../logger';

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

export interface PaymentData {
  paymentMethodId: string;
  amount: number;
  currency: string;
  customerEmail: string;
  metadata?: Record<string, any>;
}

export interface BookingOptions {
  skipAvailabilityCheck?: boolean;
  requirePayment?: boolean;
  sendConfirmation?: boolean;
  userId?: string;
}

export interface TimeSlot {
  time: string;
  available: boolean;
  capacity?: number;
  bookedCount?: number;
}

export class BookingService {
  /**
   * Check availability for a service on a specific date
   */
  async checkAvailability(
    date: Date,
    serviceId: number,
    options: { includeCapacity?: boolean } = {}
  ): Promise<TimeSlot[]> {
    return executeDbRead(async client => {
      // Get service details
      const service = await client.service.findUnique({
        where: { id: serviceId, isActive: true },
      });

      if (!service) {
        throw new Error('Service not found or inactive');
      }

      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);

      // Get existing bookings for the day
      const existingBookings = await client.booking.findMany({
        where: {
          serviceId,
          date: {
            gte: dayStart,
            lte: dayEnd,
          },
          status: {
            notIn: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW],
          },
        },
      });

      // Get business hours for the day
      const dayOfWeek = date.getDay();
      const businessHours = await client.businessHours.findUnique({
        where: { dayOfWeek },
      });

      if (!businessHours || !businessHours.isOpen) {
        return [];
      }

      // Check for holidays
      const holiday = await client.holiday.findFirst({
        where: {
          date: {
            gte: dayStart,
            lte: dayEnd,
          },
        },
      });

      if (holiday) {
        return [];
      }

      // Generate time slots
      return this.generateTimeSlots(
        date,
        service,
        businessHours,
        existingBookings,
        options.includeCapacity
      );
    }, 'check_availability');
  }

  /**
   * Create a booking with full transaction support
   */
  async createBooking(
    bookingData: BookingData,
    paymentData?: PaymentData,
    options: BookingOptions = {}
  ): Promise<TransactionResult> {
    if (options.requirePayment && !paymentData) {
      throw new Error('Payment data is required when requirePayment is true');
    }

    if (paymentData) {
      // Use saga pattern for booking with payment
      const saga = createBookingSaga(bookingData, paymentData);
      return transactionManager.executeSaga(saga, {
        userId: options.userId,
        metadata: {
          skipAvailabilityCheck: options.skipAvailabilityCheck,
          sendConfirmation: options.sendConfirmation,
        },
      });
    } else {
      // Simple transaction for booking without payment
      return transactionManager.executeSimpleTransaction(
        async tx => {
          return this.createBookingInternal(tx, bookingData, options);
        },
        {
          name: 'create_booking_simple',
          userId: options.userId,
          metadata: options,
        }
      );
    }
  }

  /**
   * Update booking status with transaction support
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
  ): Promise<TransactionResult> {
    return transactionManager.executeSimpleTransaction(
      async tx => {
        // Get current booking
        const currentBooking = await tx.booking.findUnique({
          where: { id: bookingId },
          include: { service: true },
        });

        if (!currentBooking) {
          throw new Error('Booking not found');
        }

        // Validate status transition
        this.validateStatusTransition(currentBooking.status, status);

        // Prepare update data
        const updateData: any = { status };

        if (options.adminNotes) {
          updateData.adminNotes = options.adminNotes;
        }

        if (status === BookingStatus.CANCELLED) {
          updateData.cancelledAt = new Date();
        } else if (status === BookingStatus.COMPLETED) {
          updateData.completedAt = new Date();
        }

        // Update booking
        const updatedBooking = await tx.booking.update({
          where: { id: bookingId },
          data: updateData,
          include: { service: true },
        });

        // Create status history record
        await tx.bookingStatusHistory.create({
          data: {
            bookingId,
            fromStatus: currentBooking.status,
            toStatus: status,
            changedBy: options.userId || 'system',
            changedByType: options.userId ? 'admin' : 'system',
            reason: options.reason,
            notes: options.adminNotes,
            metadata: options.metadata,
          },
        });

        return updatedBooking;
      },
      {
        name: 'update_booking_status',
        userId: options.userId,
        metadata: { bookingId, fromStatus: status, ...options },
      }
    );
  }

  /**
   * Cancel booking with optional refund processing
   */
  async cancelBooking(
    bookingId: number,
    options: {
      reason?: string;
      refundAmount?: number;
      userId?: string;
      customerInitiated?: boolean;
    } = {}
  ): Promise<TransactionResult> {
    const saga: SagaDefinition = {
      name: 'cancel_booking',
      steps: [
        {
          name: 'validate_cancellation',
          execute: async (tx, _context) => {
            const booking = await tx.booking.findUnique({
              where: { id: bookingId },
              include: { service: true },
            });

            if (!booking) {
              throw new Error('Booking not found');
            }

            if (booking.status === BookingStatus.CANCELLED) {
              throw new Error('Booking is already cancelled');
            }

            if (booking.status === BookingStatus.COMPLETED) {
              throw new Error('Cannot cancel completed booking');
            }

            // Check cancellation deadline
            const now = new Date();
            const bookingDateTime = new Date(booking.date);
            const [hours, minutes] = booking.startTime.split(':').map(Number);
            bookingDateTime.setHours(hours, minutes);

            const hoursUntilBooking =
              (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
            const cancellationDeadline = 24; // 24 hours default

            if (hoursUntilBooking < cancellationDeadline && !options.userId) {
              throw new Error(
                `Cancellation deadline passed. Must cancel at least ${cancellationDeadline} hours in advance.`
              );
            }

            return booking;
          },
        },
        {
          name: 'update_booking_status',
          execute: async (tx, _context) => {
            const booking = _context.stepResults.validate_cancellation;

            const updatedBooking = await tx.booking.update({
              where: { id: bookingId },
              data: {
                status: BookingStatus.CANCELLED,
                cancelledAt: new Date(),
                cancellationReason: options.reason,
              },
            });

            // Create status history
            await tx.bookingStatusHistory.create({
              data: {
                bookingId,
                fromStatus: booking.status,
                toStatus: BookingStatus.CANCELLED,
                changedBy: options.userId || booking.customerEmail,
                changedByType: options.customerInitiated ? 'customer' : 'admin',
                reason: options.reason,
                metadata: { customerInitiated: options.customerInitiated },
              },
            });

            return updatedBooking;
          },
          compensate: async (tx, context, updatedBooking) => {
            if (updatedBooking) {
              const originalBooking = context.stepResults.validate_cancellation;
              await tx.booking.update({
                where: { id: bookingId },
                data: {
                  status: originalBooking.status,
                  cancelledAt: null,
                  cancellationReason: null,
                },
              });
            }
          },
        },
        {
          name: 'process_refund',
          execute: async (tx, _context) => {
            const booking = _context.stepResults.validate_cancellation;

            if (booking.paymentStatus === PaymentStatus.PAID && options.refundAmount) {
              // Process refund (mock implementation)
              const refund = await this.processRefund(
                booking.paymentIntentId!,
                options.refundAmount
              );

              await tx.booking.update({
                where: { id: bookingId },
                data: {
                  paymentStatus: PaymentStatus.REFUNDED,
                },
              });

              return refund;
            }

            return null;
          },
          compensate: async (_tx, _context, refund) => {
            if (refund) {
              // Reverse refund (mock)
              await this.reverseRefund(refund.id);
            }
          },
        },
        {
          name: 'send_cancellation_notification',
          execute: async (_tx, _context) => {
            const booking = _context.stepResults.validate_cancellation;

            // Send cancellation email
            await this.sendCancellationNotification(booking, options.reason);

            return { sent: true };
          },
          retryable: true,
        },
      ],
    };

    return transactionManager.executeSaga(saga, {
      userId: options.userId,
      metadata: options,
    });
  }

  /**
   * Get bookings with enhanced filtering and pagination
   */
  async getBookings(
    filters: {
      customerId?: string;
      serviceId?: number;
      status?: BookingStatus[];
      dateFrom?: Date;
      dateTo?: Date;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<any[]> {
    return executeDbRead(async client => {
      const where: any = {};

      if (filters.customerId) {
        where.customerEmail = filters.customerId;
      }

      if (filters.serviceId) {
        where.serviceId = filters.serviceId;
      }

      if (filters.status && filters.status.length > 0) {
        where.status = { in: filters.status };
      }

      if (filters.dateFrom || filters.dateTo) {
        where.date = {};
        if (filters.dateFrom) {
          where.date.gte = startOfDay(filters.dateFrom);
        }
        if (filters.dateTo) {
          where.date.lte = endOfDay(filters.dateTo);
        }
      }

      return client.booking.findMany({
        where,
        include: {
          service: true,
          statusHistoryLog: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
        orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
        take: filters.limit || 50,
        skip: filters.offset || 0,
      });
    }, 'get_bookings');
  }

  /**
   * Get daily statistics
   */
  async getDailyStats(date: Date): Promise<any> {
    return executeDbRead(async client => {
      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);

      const bookings = await client.booking.findMany({
        where: {
          date: {
            gte: dayStart,
            lte: dayEnd,
          },
        },
        include: { service: true },
      });

      const stats = {
        total: bookings.length,
        confirmed: bookings.filter(b => b.status === BookingStatus.CONFIRMED).length,
        completed: bookings.filter(b => b.status === BookingStatus.COMPLETED).length,
        cancelled: bookings.filter(b => b.status === BookingStatus.CANCELLED).length,
        pending: bookings.filter(b => b.status === BookingStatus.PENDING).length,
        revenue:
          bookings
            .filter(b => b.paymentStatus === PaymentStatus.PAID)
            .reduce((sum, b) => sum + b.priceCents, 0) / 100,
        averageBookingValue:
          bookings.length > 0
            ? bookings.reduce((sum, b) => sum + b.priceCents, 0) / bookings.length / 100
            : 0,
      };

      return stats;
    }, 'get_daily_stats');
  }

  // Private helper methods

  private async createBookingInternal(
    tx: PrismaClient,
    bookingData: BookingData,
    options: BookingOptions
  ): Promise<any> {
    // Get service
    const service = await tx.service.findUnique({
      where: { id: bookingData.serviceId, isActive: true },
    });

    if (!service) {
      throw new Error('Service not found or inactive');
    }

    // Check availability if not skipped
    if (!options.skipAvailabilityCheck) {
      const startDateTime = new Date(bookingData.date);
      const [hours, minutes] = bookingData.startTime.split(':').map(Number);
      startDateTime.setHours(hours, minutes, 0, 0);

      const endDateTime = addMinutes(startDateTime, service.durationMinutes);

      const overlappingBooking = await tx.booking.findFirst({
        where: {
          serviceId: bookingData.serviceId,
          date: bookingData.date,
          status: {
            notIn: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW],
          },
          OR: [
            {
              AND: [
                { startTime: { lte: format(startDateTime, 'HH:mm') } },
                { endTime: { gt: format(startDateTime, 'HH:mm') } },
              ],
            },
            {
              AND: [
                { startTime: { lt: format(endDateTime, 'HH:mm') } },
                { endTime: { gte: format(endDateTime, 'HH:mm') } },
              ],
            },
          ],
        },
      });

      if (overlappingBooking) {
        throw new Error('Time slot is not available');
      }
    }

    // Generate confirmation code
    const confirmationCode = this.generateConfirmationCode();

    // Create booking
    const booking = await tx.booking.create({
      data: {
        serviceId: bookingData.serviceId,
        vehicleType: bookingData.vehicleType,
        date: bookingData.date,
        startTime: bookingData.startTime,
        endTime: format(
          addMinutes(
            parseISO(`${format(bookingData.date, 'yyyy-MM-dd')}T${bookingData.startTime}`),
            service.durationMinutes
          ),
          'HH:mm'
        ),
        duration: service.durationMinutes,
        priceCents: service.priceCents,
        status: options.requirePayment ? BookingStatus.PENDING : BookingStatus.CONFIRMED,
        customerName: bookingData.customerName,
        customerEmail: bookingData.customerEmail,
        customerPhone: bookingData.customerPhone,
        licensePlate: bookingData.licensePlate,
        notes: bookingData.notes,
        paymentStatus: PaymentStatus.PENDING,
        confirmationCode,
      },
      include: { service: true },
    });

    return booking;
  }

  private generateTimeSlots(
    date: Date,
    service: any,
    businessHours: any,
    existingBookings: any[],
    includeCapacity = false
  ): TimeSlot[] {
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

      // Check for break times
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

      // Count existing bookings for this time slot
      const bookedCount = existingBookings.filter(booking => {
        const bookingStart = parseISO(`${format(booking.date, 'yyyy-MM-dd')}T${booking.startTime}`);
        const bookingEnd = addMinutes(bookingStart, booking.duration);

        return (
          (currentTime >= bookingStart && currentTime < bookingEnd) ||
          (slotEndTime > bookingStart && slotEndTime <= bookingEnd) ||
          (currentTime <= bookingStart && slotEndTime >= bookingEnd)
        );
      }).length;

      const isAvailable = bookedCount < service.capacity;

      if (slotEndTime <= endTime) {
        const slot: TimeSlot = {
          time: timeString,
          available: isAvailable,
        };

        if (includeCapacity) {
          slot.capacity = service.capacity;
          slot.bookedCount = bookedCount;
        }

        timeSlots.push(slot);
      }

      currentTime = addMinutes(currentTime, 30);
    }

    return timeSlots;
  }

  private validateStatusTransition(fromStatus: BookingStatus, toStatus: BookingStatus): void {
    const validTransitions: Record<BookingStatus, BookingStatus[]> = {
      [BookingStatus.PENDING]: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED],
      [BookingStatus.CONFIRMED]: [
        BookingStatus.IN_PROGRESS,
        BookingStatus.CANCELLED,
        BookingStatus.NO_SHOW,
      ],
      [BookingStatus.IN_PROGRESS]: [BookingStatus.COMPLETED, BookingStatus.CANCELLED],
      [BookingStatus.COMPLETED]: [], // Cannot transition from completed
      [BookingStatus.CANCELLED]: [], // Cannot transition from cancelled
      [BookingStatus.NO_SHOW]: [], // Cannot transition from no-show
    };

    if (!validTransitions[fromStatus]?.includes(toStatus)) {
      throw new Error(`Invalid status transition from ${fromStatus} to ${toStatus}`);
    }
  }

  private generateConfirmationCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // Mock methods for external integrations
  private async processRefund(paymentIntentId: string, amount: number): Promise<{ id: string }> {
    logger.info('Processing refund', { paymentIntentId, amount });
    return { id: `re_${Date.now()}` };
  }

  private async reverseRefund(refundId: string): Promise<void> {
    logger.info('Reversing refund', { refundId });
  }

  private async sendCancellationNotification(booking: any, reason?: string): Promise<void> {
    logger.info('Sending cancellation notification', {
      bookingId: booking.id,
      customerEmail: booking.customerEmail,
      reason,
    });
  }
}

// Export singleton instance
export const bookingService = new BookingService();
