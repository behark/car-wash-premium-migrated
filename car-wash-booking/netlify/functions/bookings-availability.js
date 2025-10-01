const { PrismaClient } = require('@prisma/client');
const { format, addMinutes, startOfDay, endOfDay } = require('date-fns');

const prisma = new PrismaClient();

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle OPTIONS request for CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { date, serviceId } = event.queryStringParameters || {};

    if (!date || !serviceId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Missing required parameters',
          message: 'Both date and serviceId are required'
        }),
      };
    }

    // Parse the date
    const requestedDate = new Date(date);
    const dayOfWeek = requestedDate.getDay();

    // Get business hours for the requested day
    const businessHours = await prisma.businessHours.findUnique({
      where: { dayOfWeek },
    });

    if (!businessHours || !businessHours.isOpen) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          available: false,
          message: 'We are closed on this day',
          slots: []
        }),
      };
    }

    // Get service details
    const service = await prisma.service.findUnique({
      where: { id: parseInt(serviceId) },
    });

    if (!service) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Service not found' }),
      };
    }

    // Generate time slots
    const startHour = parseInt(businessHours.startTime.split(':')[0]);
    const startMinute = parseInt(businessHours.startTime.split(':')[1]);
    const endHour = parseInt(businessHours.endTime.split(':')[0]);
    const endMinute = parseInt(businessHours.endTime.split(':')[1]);

    const slots = [];
    const slotDuration = 30; // 30-minute slots
    let currentHour = startHour;
    let currentMinute = startMinute;

    while (currentHour < endHour || (currentHour === endHour && currentMinute < endMinute)) {
      const slotTime = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;

      // Check for break time
      if (businessHours.breakStart && businessHours.breakEnd) {
        const [breakStartHour, breakStartMinute] = businessHours.breakStart.split(':').map(Number);
        const breakStartTotalMinutes = breakStartHour * 60 + breakStartMinute;
        const [breakEndHour, breakEndMinute] = businessHours.breakEnd.split(':').map(Number);
        const breakEndTotalMinutes = breakEndHour * 60 + breakEndMinute;
        const currentTotalMinutes = currentHour * 60 + currentMinute;

        if (currentTotalMinutes >= breakStartTotalMinutes && currentTotalMinutes < breakEndTotalMinutes) {
          currentMinute += slotDuration;
          if (currentMinute >= 60) {
            currentHour += Math.floor(currentMinute / 60);
            currentMinute = currentMinute % 60;
          }
          continue;
        }
      }

      // Check if slot is available (not booked)
      const startTime = new Date(requestedDate);
      startTime.setHours(currentHour, currentMinute, 0, 0);
      const endTime = addMinutes(startTime, service.durationMinutes);

      // Check for overlapping bookings
      // A booking overlaps if:
      // 1. It starts before our slot ends AND
      // 2. It ends after our slot starts
      const slotEndTime = format(endTime, 'HH:mm');

      const conflictingBookings = await prisma.booking.findMany({
        where: {
          date: {
            gte: startOfDay(requestedDate),
            lte: endOfDay(requestedDate),
          },
          status: {
            notIn: ['CANCELLED', 'NO_SHOW'],
          },
          OR: [
            // Booking starts before our slot ends and ends after our slot starts
            {
              AND: [
                { startTime: { lt: slotEndTime } },
                { endTime: { gt: slotTime } },
              ],
            },
          ],
        },
      });

      slots.push({
        time: slotTime,
        available: conflictingBookings.length === 0,
      });

      // Move to next slot
      currentMinute += slotDuration;
      if (currentMinute >= 60) {
        currentHour += Math.floor(currentMinute / 60);
        currentMinute = currentMinute % 60;
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        available: true,
        date: date,
        serviceId: serviceId,
        timeSlots: slots,
      }),
    };
  } catch (error) {
    console.error('Availability API error:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      }),
    };
  } finally {
    await prisma.$disconnect();
  }
};