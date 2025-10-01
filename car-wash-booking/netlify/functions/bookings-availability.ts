import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Copy the checkAvailability logic from src/lib/booking.ts
async function checkAvailability(date: Date, serviceId: number) {
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
  });

  if (!service) {
    throw new Error('Service not found');
  }

  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const existingBookings = await prisma.booking.findMany({
    where: {
      serviceId,
      date: {
        gte: startOfDay,
        lte: endOfDay,
      },
      status: {
        in: ['PENDING', 'CONFIRMED'],
      },
    },
    select: {
      startTime: true,
      endTime: true,
    },
  });

  const businessHours = {
    start: '09:00',
    end: '18:00',
  };

  const timeSlots: { time: string; available: boolean }[] = [];
  const [startHour] = businessHours.start.split(':').map(Number);
  const [endHour] = businessHours.end.split(':').map(Number);

  for (let hour = startHour; hour < endHour; hour++) {
    const time = `${hour.toString().padStart(2, '0')}:00`;

    const isBooked = existingBookings.some(booking => {
      const bookingStart = booking.startTime;
      const bookingEnd = booking.endTime;
      return time >= bookingStart && time < bookingEnd;
    });

    timeSlots.push({
      time,
      available: !isBooked && service.capacity > 0,
    });
  }

  return timeSlots;
}

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
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

  try {
    const dateStr = event.queryStringParameters?.date;
    const serviceIdStr = event.queryStringParameters?.serviceId;

    if (!dateStr || !serviceIdStr) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required parameters' }),
      };
    }

    const date = new Date(dateStr);
    const serviceId = parseInt(serviceIdStr);

    if (isNaN(serviceId)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid service ID' }),
      };
    }

    const timeSlots = await checkAvailability(date, serviceId);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        date: date.toISOString(),
        serviceId,
        timeSlots,
      }),
    };
  } catch (error: any) {
    console.error('Availability check error:', error);

    if (error.message === 'Service not found') {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Service not found' }),
      };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to check availability',
        message: error.message,
      }),
    };
  }
};

export { handler };
