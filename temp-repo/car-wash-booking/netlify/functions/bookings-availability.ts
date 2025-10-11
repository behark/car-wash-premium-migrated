/**
 * Booking Availability Endpoint - Simplified Version
 * GET /api/bookings/availability?date=YYYY-MM-DD&serviceId=1
 */

import { Handler, HandlerEvent } from '@netlify/functions';
import { PrismaClient, BookingStatus } from '@prisma/client';

const handler: Handler = async (event: HandlerEvent) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  let prisma: PrismaClient | null = null;

  try {
    const dateStr = event.queryStringParameters?.date;
    const serviceIdStr = event.queryStringParameters?.serviceId;

    if (!dateStr || !serviceIdStr) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Missing required parameters: date and serviceId'
        }),
      };
    }

    const serviceId = parseInt(serviceIdStr);
    if (isNaN(serviceId)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Invalid serviceId'
        }),
      };
    }

    prisma = new PrismaClient();

    // Get service
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Service not found'
        }),
      };
    }

    // Get date range
    const date = new Date(dateStr);
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Get existing bookings
    const existingBookings = await prisma.booking.findMany({
      where: {
        serviceId,
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
      const isToday = date.toDateString() === now.toDateString();
      const currentHour = now.getHours();
      const isPast = isToday && hour <= currentHour;

      timeSlots.push({
        time: slotTime,
        available: !isBooked && !isPast,
      });
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          date: dateStr,
          serviceId,
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
      }),
    };
  } catch (error: any) {
    console.error('Availability endpoint error:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Failed to check availability',
        message: error.message,
      }),
    };
  } finally {
    if (prisma) {
      await prisma.$disconnect().catch(err =>
        console.error('Failed to disconnect Prisma:', err)
      );
    }
  }
};

export { handler };