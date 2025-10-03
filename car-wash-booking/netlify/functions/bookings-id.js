const { PrismaClient } = require('@prisma/client');
const { format } = require('date-fns');

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
    // Get booking ID from query parameters
    const bookingId = event.queryStringParameters?.id;

    if (!bookingId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Missing booking ID',
          message: 'Please provide a booking ID'
        }),
      };
    }

    // Fetch booking by confirmation code or ID
    const booking = await prisma.booking.findFirst({
      where: {
        OR: [
          { confirmationCode: bookingId },
          { id: isNaN(parseInt(bookingId)) ? undefined : parseInt(bookingId) }
        ]
      },
      include: {
        service: true,
      },
    });

    if (!booking) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          error: 'Booking not found',
          message: 'No booking found with the provided ID'
        }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        booking: {
          id: booking.id,
          confirmationCode: booking.confirmationCode,
          service: {
            id: booking.service.id,
            titleFi: booking.service.titleFi,
            titleEn: booking.service.titleEn,
            descriptionFi: booking.service.descriptionFi,
            descriptionEn: booking.service.descriptionEn,
          },
          vehicleType: booking.vehicleType,
          date: format(booking.date, 'yyyy-MM-dd'),
          startTime: booking.startTime,
          endTime: booking.endTime,
          duration: booking.duration,
          customerName: booking.customerName,
          customerEmail: booking.customerEmail,
          customerPhone: booking.customerPhone,
          licensePlate: booking.licensePlate,
          notes: booking.notes,
          status: booking.status,
          paymentStatus: booking.paymentStatus,
          price: (booking.priceCents / 100).toFixed(2),
          createdAt: booking.createdAt,
        },
      }),
    };
  } catch (error) {
    console.error('Booking fetch error:', error);

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
