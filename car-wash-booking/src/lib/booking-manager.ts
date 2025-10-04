/**
 * Enhanced Booking Manager - Inspired by TastyIgniter's BookingManager
 * Provides advanced booking management with time slot generation, bay assignment,
 * capacity management, and status workflow
 */

import { prisma } from './prisma';
import { BookingStatus, PaymentStatus, AutomationEvent } from '@prisma/client';
import {
  format,
  addMinutes,
  parseISO,
  startOfDay,
  endOfDay,
  addHours,
  differenceInHours,
  isBefore,
  isAfter
} from 'date-fns';
import { EventEmitter } from 'events';

export interface TimeSlot {
  time: string;
  available: boolean;
  capacity?: number;
  remainingCapacity?: number;
  bayId?: number;
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
  guestCount?: number;
}

export interface BookingConfig {
  intervalMinutes: number;
  leadTimeHours: number;
  maxAdvanceDays: number;
  cancellationDeadlineHours: number;
  allowCustomerCancellation: boolean;
  enableAutoBayAssignment: boolean;
  autoConfirmBookings: boolean;
}

// Event emitter for booking lifecycle events
export const bookingEvents = new EventEmitter();

/**
 * Get booking configuration from database or defaults
 */
export async function getBookingConfig(): Promise<BookingConfig> {
  const configs = await prisma.bookingConfiguration.findMany();

  const configMap = configs.reduce((acc, config) => {
    acc[config.key] = config;
    return acc;
  }, {} as Record<string, any>);

  return {
    intervalMinutes: configMap['intervalMinutes']?.intervalMinutes || 30,
    leadTimeHours: configMap['leadTime']?.leadTimeHours || 2,
    maxAdvanceDays: configMap['maxAdvanceDays']?.maxAdvanceDays || 30,
    cancellationDeadlineHours: configMap['cancellationDeadline']?.cancellationDeadlineHours || 24,
    allowCustomerCancellation: configMap['allowCancellation']?.allowCustomerCancellation !== false,
    enableAutoBayAssignment: configMap['autoBayAssignment']?.enableAutoBayAssignment !== false,
    autoConfirmBookings: configMap['autoConfirm']?.autoConfirmBookings || false,
  };
}

/**
 * Generate time slots for a given date and service
 * Inspired by TastyIgniter's makeTimeSlots method
 */
export async function makeTimeSlots(
  date: Date,
  serviceId: number,
  config?: BookingConfig
): Promise<TimeSlot[]> {
  const bookingConfig = config || await getBookingConfig();

  const service = await prisma.service.findUnique({
    where: { id: serviceId },
  });

  if (!service) {
    throw new Error('Service not found');
  }

  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);
  const now = new Date();
  const minBookingTime = addHours(now, bookingConfig.leadTimeHours);

  // Check if day is a holiday
  const holiday = await prisma.holiday.findFirst({
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

  // Get business hours for this day
  const dayOfWeek = date.getDay();
  const businessHours = await prisma.businessHours.findUnique({
    where: { dayOfWeek },
  });

  if (!businessHours || !businessHours.isOpen) {
    return [];
  }

  // Get existing bookings for the day
  const existingBookings = await prisma.booking.findMany({
    where: {
      date: {
        gte: dayStart,
        lte: dayEnd,
      },
      status: {
        notIn: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW],
      },
    },
    include: {
      assignedBay: true,
    },
  });

  // Get all available bays
  const bays = await prisma.washBay.findMany({
    where: { isEnabled: true },
  });

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

    // Skip if slot is before minimum booking time (current time + lead time)
    if (isBefore(currentTime, minBookingTime)) {
      currentTime = addMinutes(currentTime, bookingConfig.intervalMinutes);
      continue;
    }

    // Check for break periods
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
        currentTime = addMinutes(currentTime, bookingConfig.intervalMinutes);
        continue;
      }
    }

    // Calculate capacity for this slot
    const totalCapacity = bays.length;
    const bookedCount = existingBookings.filter(booking => {
      const bookingStart = parseISO(`${format(booking.date, 'yyyy-MM-dd')}T${booking.startTime}`);
      const bookingEnd = addMinutes(bookingStart, booking.duration);

      return (
        (currentTime >= bookingStart && currentTime < bookingEnd) ||
        (slotEndTime > bookingStart && slotEndTime <= bookingEnd) ||
        (currentTime <= bookingStart && slotEndTime >= bookingEnd)
      );
    }).length;

    const remainingCapacity = totalCapacity - bookedCount;

    if (slotEndTime <= endTime) {
      timeSlots.push({
        time: timeString,
        available: remainingCapacity > 0,
        capacity: totalCapacity,
        remainingCapacity,
      });
    }

    currentTime = addMinutes(currentTime, bookingConfig.intervalMinutes);
  }

  return timeSlots;
}

/**
 * Get next available bookable bay for a given time
 * Inspired by TastyIgniter's getNextBookableTable
 */
export async function getNextBookableBay(
  date: Date,
  startTime: string,
  duration: number,
  vehicleSize: number = 2
): Promise<number | null> {
  const bays = await prisma.washBay.findMany({
    where: {
      isEnabled: true,
      minCapacity: { lte: vehicleSize },
      maxCapacity: { gte: vehicleSize },
    },
    orderBy: {
      bayNumber: 'asc',
    },
  });

  const startDateTime = parseISO(`${format(date, 'yyyy-MM-dd')}T${startTime}`);
  const endDateTime = addMinutes(startDateTime, duration);

  for (const bay of bays) {
    // Check if bay is available for this time slot
    const overlappingBooking = await prisma.booking.findFirst({
      where: {
        assignedBayId: bay.id,
        date: date,
        status: {
          notIn: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW],
        },
        OR: [
          {
            AND: [
              { startTime: { lte: startTime } },
              { endTime: { gt: startTime } },
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

    if (!overlappingBooking) {
      return bay.id;
    }
  }

  return null;
}

/**
 * Auto-assign a bay to a booking
 * Inspired by TastyIgniter's autoAssignTable
 */
export async function autoAssignBay(bookingId: number): Promise<boolean> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { service: true },
  });

  if (!booking) {
    throw new Error('Booking not found');
  }

  if (booking.assignedBayId) {
    return true; // Already assigned
  }

  // Determine vehicle size from vehicleType
  const vehicleSize = getVehicleSizeFromType(booking.vehicleType);

  const bayId = await getNextBookableBay(
    booking.date,
    booking.startTime,
    booking.duration,
    vehicleSize
  );

  if (bayId) {
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        assignedBayId: bayId,
        assignedAt: new Date(),
        assignedBy: 'system',
      },
    });

    // Emit event
    bookingEvents.emit('booking.assigned', { bookingId, bayId });

    return true;
  }

  return false;
}

/**
 * Create a new booking with enhanced features
 */
export async function saveReservation(data: BookingData): Promise<any> {
  const config = await getBookingConfig();

  const service = await prisma.service.findUnique({
    where: { id: data.serviceId },
  });

  if (!service) {
    throw new Error('Service not found');
  }

  const startDateTime = new Date(data.date);
  const [hours, minutes] = data.startTime.split(':').map(Number);
  startDateTime.setHours(hours, minutes, 0, 0);

  const endDateTime = addMinutes(startDateTime, service.durationMinutes);

  // Check for overlapping bookings
  const overlappingBooking = await prisma.booking.findFirst({
    where: {
      date: data.date,
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

  const confirmationCode = generateConfirmationCode();
  const initialStatus = config.autoConfirmBookings ? BookingStatus.CONFIRMED : BookingStatus.PENDING;

  const booking = await prisma.booking.create({
    data: {
      serviceId: data.serviceId,
      vehicleType: data.vehicleType,
      date: data.date,
      startTime: format(startDateTime, 'HH:mm'),
      endTime: format(endDateTime, 'HH:mm'),
      duration: service.durationMinutes,
      priceCents: service.priceCents,
      status: initialStatus,
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone,
      licensePlate: data.licensePlate,
      notes: data.notes,
      paymentStatus: PaymentStatus.PENDING,
      confirmationCode,
      guestCount: data.guestCount || 1,
      statusHistory: JSON.stringify([{
        status: initialStatus,
        timestamp: new Date().toISOString(),
        changedBy: 'system',
        reason: 'Initial booking creation',
      }]),
    },
    include: {
      service: true,
    },
  });

  // Auto-assign bay if enabled
  if (config.enableAutoBayAssignment) {
    await autoAssignBay(booking.id);
  }

  // Create status history entry
  await prisma.bookingStatusHistory.create({
    data: {
      bookingId: booking.id,
      toStatus: initialStatus,
      changedBy: 'system',
      changedByType: 'system',
      reason: 'Initial booking creation',
    },
  });

  // Emit booking created event
  bookingEvents.emit('booking.created', { booking });

  return booking;
}

/**
 * Check if booking can be cancelled
 * Inspired by TastyIgniter's isCancelable
 */
export async function isCancelable(bookingId: number): Promise<boolean> {
  const config = await getBookingConfig();

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
  });

  if (!booking) {
    return false;
  }

  if (booking.status === BookingStatus.CANCELLED || booking.status === BookingStatus.COMPLETED) {
    return false;
  }

  const bookingDateTime = parseISO(`${format(booking.date, 'yyyy-MM-dd')}T${booking.startTime}`);
  const now = new Date();
  const hoursUntilBooking = differenceInHours(bookingDateTime, now);

  return hoursUntilBooking >= config.cancellationDeadlineHours;
}

/**
 * Mark booking as cancelled with reason
 * Inspired by TastyIgniter's markAsCanceled
 */
export async function markAsCanceled(
  bookingId: number,
  reason?: string,
  canceledBy: string = 'customer'
): Promise<any> {
  const canCancel = await isCancelable(bookingId);

  if (!canCancel) {
    throw new Error('Booking cannot be cancelled at this time');
  }

  const booking = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: BookingStatus.CANCELLED,
      cancelledAt: new Date(),
      cancellationReason: reason,
    },
    include: {
      service: true,
    },
  });

  // Create status history entry
  await prisma.bookingStatusHistory.create({
    data: {
      bookingId: booking.id,
      fromStatus: booking.status,
      toStatus: BookingStatus.CANCELLED,
      changedBy: canceledBy,
      changedByType: canceledBy === 'system' ? 'system' : 'customer',
      reason: reason || 'Cancelled by customer',
    },
  });

  // Emit cancellation event
  bookingEvents.emit('booking.cancelled', { booking, reason, canceledBy });

  return booking;
}

/**
 * Update booking status with history tracking
 */
export async function updateBookingStatus(
  bookingId: number,
  newStatus: BookingStatus,
  changedBy: string = 'system',
  reason?: string,
  notes?: string
): Promise<any> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
  });

  if (!booking) {
    throw new Error('Booking not found');
  }

  const oldStatus = booking.status;

  const updateData: any = { status: newStatus };

  if (newStatus === BookingStatus.CANCELLED && !booking.cancelledAt) {
    updateData.cancelledAt = new Date();
  } else if (newStatus === BookingStatus.COMPLETED && !booking.completedAt) {
    updateData.completedAt = new Date();
  }

  const updatedBooking = await prisma.booking.update({
    where: { id: bookingId },
    data: updateData,
    include: {
      service: true,
      assignedBay: true,
      assignedStaff: true,
    },
  });

  // Create status history entry
  await prisma.bookingStatusHistory.create({
    data: {
      bookingId: booking.id,
      fromStatus: oldStatus,
      toStatus: newStatus,
      changedBy,
      changedByType: changedBy.includes('@') ? 'admin' : 'system',
      reason: reason,
      notes: notes,
    },
  });

  // Emit status changed event
  bookingEvents.emit('booking.statusChanged', {
    booking: updatedBooking,
    oldStatus,
    newStatus,
    changedBy,
  });

  return updatedBooking;
}

/**
 * Helper function to generate confirmation code
 */
function generateConfirmationCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Helper function to determine vehicle size from type
 */
function getVehicleSizeFromType(vehicleType: string): number {
  const type = vehicleType.toLowerCase();
  if (type.includes('pieni') || type.includes('small')) return 1;
  if (type.includes('suuri') || type.includes('large') || type.includes('paketti')) return 3;
  return 2; // Default to medium
}

/**
 * Check if specific time slots are fully booked
 * Inspired by TastyIgniter's isTimeslotsFullyBookedOn
 */
export async function isTimeslotsFullyBookedOn(
  date: Date,
  timeSlots: string[],
  serviceId: number
): Promise<boolean> {
  const slots = await makeTimeSlots(date, serviceId);

  for (const time of timeSlots) {
    const slot = slots.find(s => s.time === time);
    if (slot && slot.available) {
      return false; // At least one slot is available
    }
  }

  return true; // All requested slots are fully booked
}

/**
 * Get booking statistics for a date
 */
export async function getDailyBookingStats(date: Date) {
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  const bookings = await prisma.booking.findMany({
    where: {
      date: {
        gte: dayStart,
        lte: dayEnd,
      },
    },
    include: {
      service: true,
      assignedBay: true,
      assignedStaff: true,
    },
  });

  return {
    total: bookings.length,
    pending: bookings.filter(b => b.status === BookingStatus.PENDING).length,
    confirmed: bookings.filter(b => b.status === BookingStatus.CONFIRMED).length,
    inProgress: bookings.filter(b => b.status === BookingStatus.IN_PROGRESS).length,
    completed: bookings.filter(b => b.status === BookingStatus.COMPLETED).length,
    cancelled: bookings.filter(b => b.status === BookingStatus.CANCELLED).length,
    noShow: bookings.filter(b => b.status === BookingStatus.NO_SHOW).length,
    revenue: bookings
      .filter(b => b.paymentStatus === PaymentStatus.PAID)
      .reduce((sum, b) => sum + b.priceCents, 0) / 100,
    bookings,
  };
}
