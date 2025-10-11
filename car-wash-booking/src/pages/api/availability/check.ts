/**
 * Real-Time Availability Checking API
 * Optimized with Redis caching and conflict detection
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { prisma } from '../../../lib/database/config';
import { redisService } from '../../../lib/redis-service';
import { logger } from '../../../lib/logger';

const availabilitySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  serviceId: z.number().int().positive().optional(),
  duration: z.number().int().positive().default(60), // minutes
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Validate query parameters
    const query = {
      date: req.query.date as string,
      serviceId: req.query.serviceId ? parseInt(req.query.serviceId as string) : undefined,
      duration: req.query.duration ? parseInt(req.query.duration as string) : 60,
    };

    const validatedQuery = availabilitySchema.parse(query);
    const { date, serviceId, duration } = validatedQuery;

    // Check if date is in the past
    const requestedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (requestedDate < today) {
      return res.status(400).json({
        error: 'Cannot check availability for past dates',
      });
    }

    // Generate cache key
    const cacheKey = `availability:${date}${serviceId ? `:service:${serviceId}` : ''}:duration:${duration}`;

    // Try to get from cache first
    let availabilityData = await redisService.get(cacheKey);

    if (!availabilityData) {
      // Query database for time slots
      availabilityData = await getAvailabilityFromDatabase(date, serviceId, duration);

      // Cache for 2 minutes (short TTL due to real-time nature)
      await redisService.set(cacheKey, availabilityData, { ttl: 120 });
    }

    // Add metadata
    const response = {
      date,
      serviceId,
      duration,
      availability: availabilityData,
      metadata: {
        cached: !!availabilityData,
        timestamp: new Date().toISOString(),
        timezone: 'Europe/Helsinki',
      },
    };

    res.status(200).json(response);
  } catch (error) {
    logger.error('Availability check error:', {
      error: error instanceof Error ? error.message : String(error),
      query: req.query,
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request parameters',
        details: error.errors,
      });
    }

    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getAvailabilityFromDatabase(
  date: string,
  serviceId?: number,
  duration: number = 60
) {
  const requestedDate = new Date(date);

  // Get business hours for the day
  const dayOfWeek = requestedDate.getDay();
  const businessHours = await prisma.businessHours.findUnique({
    where: { dayOfWeek },
  });

  if (!businessHours || !businessHours.isOpen) {
    return {
      isBusinessDay: false,
      timeSlots: [],
      message: 'Business is closed on this day',
    };
  }

  // Check for holidays
  const holiday = await prisma.holiday.findUnique({
    where: { date: requestedDate },
  });

  if (holiday) {
    return {
      isBusinessDay: false,
      isHoliday: true,
      holidayName: holiday.name,
      timeSlots: [],
      message: `Business is closed for ${holiday.name}`,
    };
  }

  // Get all time slots for the date
  const timeSlots = await prisma.timeSlot.findMany({
    where: {
      date: requestedDate,
      isAvailable: true,
    },
    include: {
      bookings: {
        where: {
          status: {
            in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'],
          },
          ...(serviceId && { serviceId }),
        },
        include: {
          service: {
            select: {
              id: true,
              titleFi: true,
              durationMinutes: true,
            },
          },
        },
      },
    },
    orderBy: { startTime: 'asc' },
  });

  // Get available wash bays
  const washBays = await prisma.washBay.findMany({
    where: { isEnabled: true },
    include: {
      bookings: {
        where: {
          date: requestedDate,
          status: {
            in: ['CONFIRMED', 'IN_PROGRESS'],
          },
        },
      },
    },
  });

  // Calculate availability for each time slot
  const availabilitySlots = timeSlots.map(slot => {
    const currentBookings = slot.bookings.length;
    const availableCapacity = slot.maxCapacity - currentBookings;

    // Calculate bay availability
    const bookedBayIds = slot.bookings
      .filter(booking => booking.assignedBayId)
      .map(booking => booking.assignedBayId);

    const availableBays = washBays.filter(bay =>
      !bookedBayIds.includes(bay.id)
    );

    // Check if this slot can accommodate the requested duration
    const slotDuration = calculateSlotDuration(slot.startTime, slot.endTime);
    const canAccommodateDuration = slotDuration >= duration;

    return {
      id: slot.id,
      startTime: slot.startTime,
      endTime: slot.endTime,
      maxCapacity: slot.maxCapacity,
      currentBookings,
      availableCapacity,
      isAvailable: availableCapacity > 0 && availableBays.length > 0 && canAccommodateDuration,
      availableBays: availableBays.length,
      totalBays: washBays.length,
      canAccommodateDuration,
      requestedDuration: duration,
      slotDuration,
      isHoliday: slot.isHoliday,
      notes: slot.notes,
      conflicts: [],
    };
  });

  // Add conflict detection
  const slotsWithConflicts = await addConflictDetection(availabilitySlots, requestedDate, serviceId);

  return {
    isBusinessDay: true,
    isHoliday: false,
    businessHours: {
      open: businessHours.startTime,
      close: businessHours.endTime,
      breakStart: businessHours.breakStart,
      breakEnd: businessHours.breakEnd,
    },
    timeSlots: slotsWithConflicts,
    summary: {
      totalSlots: slotsWithConflicts.length,
      availableSlots: slotsWithConflicts.filter(slot => slot.isAvailable).length,
      fullyBookedSlots: slotsWithConflicts.filter(slot => slot.availableCapacity === 0).length,
      totalCapacity: slotsWithConflicts.reduce((sum, slot) => sum + slot.maxCapacity, 0),
      bookedCapacity: slotsWithConflicts.reduce((sum, slot) => sum + slot.currentBookings, 0),
    },
  };
}

function calculateSlotDuration(startTime: string, endTime: string): number {
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);

  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;

  return endMinutes - startMinutes;
}

async function addConflictDetection(
  slots: any[],
  date: Date,
  serviceId?: number
) {
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  return slots.map(slot => {
    const conflicts = [];

    // Check if time has passed (for today only)
    if (isToday) {
      const [slotHour, slotMinute] = slot.startTime.split(':').map(Number);
      const slotTime = new Date(date);
      slotTime.setHours(slotHour, slotMinute, 0, 0);

      if (slotTime <= now) {
        conflicts.push({
          type: 'time_passed',
          message: 'This time slot has already passed',
        });
      }
    }

    // Check capacity conflicts
    if (slot.availableCapacity <= 0) {
      conflicts.push({
        type: 'capacity_full',
        message: 'This time slot is fully booked',
      });
    }

    // Check bay availability
    if (slot.availableBays <= 0) {
      conflicts.push({
        type: 'no_bays',
        message: 'No wash bays available for this time slot',
      });
    }

    // Check duration compatibility
    if (!slot.canAccommodateDuration) {
      conflicts.push({
        type: 'duration_mismatch',
        message: `Time slot is ${slot.slotDuration} minutes, but ${slot.requestedDuration} minutes requested`,
      });
    }

    return {
      ...slot,
      conflicts,
      isAvailable: slot.isAvailable && conflicts.length === 0,
    };
  });
}