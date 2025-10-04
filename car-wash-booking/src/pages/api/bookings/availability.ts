import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma-simple';
import { BookingStatus } from '@prisma/client';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { date, serviceId } = req.query;

    if (!date || !serviceId) {
      return res.status(400).json({
        error: 'Missing required parameters: date and serviceId'
      });
    }

    const parsedServiceId = parseInt(serviceId as string);
    if (isNaN(parsedServiceId)) {
      return res.status(400).json({
        error: 'Invalid serviceId'
      });
    }

    // Get service
    const service = await prisma.service.findUnique({
      where: { id: parsedServiceId },
    });

    if (!service) {
      return res.status(404).json({
        error: 'Service not found'
      });
    }

    // Get date range
    const targetDate = new Date(date as string);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Get existing bookings
    const existingBookings = await prisma.booking.findMany({
      where: {
        serviceId: parsedServiceId,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: {
          in: [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS],
        },
      },
      select: {
        startTime: true,
        endTime: true,
      },
    });

    // Generate time slots (9 AM to 6 PM)
    const timeSlots = [];
    const businessStart = 9;
    const businessEnd = 18;

    for (let hour = businessStart; hour < businessEnd; hour++) {
      const slotTime = `${hour.toString().padStart(2, '0')}:00`;
      const slotEndMinutes = hour * 60 + service.durationMinutes;

      // Check if slot would exceed business hours
      if (slotEndMinutes > businessEnd * 60) {
        continue;
      }

      // Check for conflicts
      const isBooked = existingBookings.some((booking) => {
        const [bookingStartHour, bookingStartMinute] = booking.startTime.split(':').map(Number);
        const [bookingEndHour, bookingEndMinute] = booking.endTime.split(':').map(Number);

        const bookingStart = bookingStartHour * 60 + bookingStartMinute;
        const bookingEnd = bookingEndHour * 60 + bookingEndMinute;
        const slotStart = hour * 60;
        const slotEnd = slotStart + service.durationMinutes;

        return (
          (slotStart >= bookingStart && slotStart < bookingEnd) ||
          (slotEnd > bookingStart && slotEnd <= bookingEnd) ||
          (slotStart <= bookingStart && slotEnd >= bookingEnd)
        );
      });

      // Check if slot is in the past
      const now = new Date();
      const isToday = targetDate.toDateString() === now.toDateString();
      const currentHour = now.getHours();
      const isPast = isToday && hour <= currentHour;

      timeSlots.push({
        time: slotTime,
        available: !isBooked && !isPast,
      });
    }

    res.status(200).json({
      success: true,
      data: {
        date: date as string,
        serviceId: parsedServiceId,
        service: {
          titleFi: service.titleFi,
          durationMinutes: service.durationMinutes,
        },
        timeSlots,
        summary: {
          total: timeSlots.length,
          available: timeSlots.filter(s => s.available).length,
        },
      },
    });
  } catch (error: any) {
    console.error('Availability endpoint error:', error);

    res.status(500).json({
      error: 'Failed to check availability',
      message: error.message,
    });
  }
}