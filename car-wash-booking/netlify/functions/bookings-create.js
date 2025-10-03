const { PrismaClient } = require('@prisma/client');
const { format, addMinutes } = require('date-fns');
const sgMail = require('@sendgrid/mail');

const prisma = new PrismaClient();

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

function generateConfirmationCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const body = JSON.parse(event.body);

    const {
      serviceId,
      vehicleType,
      date,
      startTime,
      customerName,
      customerEmail,
      customerPhone,
      licensePlate,
      notes
    } = body;

    // Validate required fields
    if (!serviceId || !vehicleType || !date || !startTime || !customerName || !customerEmail || !customerPhone) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Missing required fields',
          message: 'Please provide all required booking information'
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

    // Calculate end time
    const [hours, minutes] = startTime.split(':').map(Number);
    // FIX 1: Use the incoming date string to ensure the time calculation is relative to the correct day
    const startDate = new Date(date);
    startDate.setHours(hours, minutes, 0, 0);
    const endDate = addMinutes(startDate, service.durationMinutes);
    const endTime = format(endDate, 'HH:mm');

    // Generate confirmation code
    const confirmationCode = generateConfirmationCode();

    // Create booking
    const booking = await prisma.booking.create({
      data: {
        serviceId: service.id,
        vehicleType,
        date: new Date(date),
        startTime,
        endTime,
        duration: service.durationMinutes,
        customerName,
        customerEmail,
        customerPhone,
        licensePlate: licensePlate || null,
        notes: notes || null,
        confirmationCode,
        status: 'CONFIRMED',
        paymentStatus: 'PENDING',
        priceCents: service.priceCents,
      },
      include: {
        service: true,
      },
    });

    // Send confirmation email if SendGrid is configured
    if (process.env.SENDGRID_API_KEY && process.env.SENDER_EMAIL) {
      try {
        const formattedDate = format(booking.date, 'dd.MM.yyyy');

        const msg = {
          to: customerEmail,
          from: process.env.SENDER_EMAIL,
          subject: `Varausvahvistus - ${confirmationCode}`,
          text: `
Hei ${customerName},

Kiitos varauksestasi! Tässä varauksen tiedot:

Palvelu: ${service.titleFi}
Päivämäärä: ${formattedDate}
Kellonaika: ${startTime}
Vahvistuskoodi: ${confirmationCode}

Hinta: ${(service.priceCents / 100).toFixed(2)}€

Osoite:
Läkkiseränttie 15
00320 Helsinki

Terveisin,
Kiilto & Loisto
          `,
          html: `
<h2>Varausvahvistus</h2>
<p>Hei ${customerName},</p>
<p>Kiitos varauksestasi! Tässä varauksen tiedot:</p>
<ul>
  <li><strong>Palvelu:</strong> ${service.titleFi}</li>
  <li><strong>Päivämäärä:</strong> ${formattedDate}</li>
  <li><strong>Kellonaika:</strong> ${startTime}</li>
  <li><strong>Vahvistuskoodi:</strong> ${confirmationCode}</li>
  <li><strong>Hinta:</strong> ${(service.priceCents / 100).toFixed(2)}€</li>
</ul>
<p><strong>Osoite:</strong><br>
Läkkiseränttie 15<br>
00320 Helsinki</p>
<p>Terveisin,<br>Kiilto & Loisto</p>
          `,
        };

        await sgMail.send(msg);
        console.log('Confirmation email sent to:', customerEmail);
      } catch (emailError) {
        console.error('Failed to send confirmation email:', emailError);
        // Don't fail the booking if email fails
      }
    }

    // --- FIX START: Correctly return the full booking object ---
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        booking: {
          // This must match the BookingDetails interface in confirmation.tsx exactly
          id: booking.id,
          confirmationCode: booking.confirmationCode, // Use the stored code
          service: {
              // Service object is required by confirmation.tsx
              titleFi: service.titleFi,
              titleEn: service.titleEn,
              priceCents: service.priceCents,
              durationMinutes: service.durationMinutes,
          },
          date: format(booking.date, 'yyyy-MM-dd'),
          startTime: booking.startTime,
          endTime: booking.endTime, // Use the calculated end time
          customerName: booking.customerName,
          status: booking.status,
          paymentStatus: booking.paymentStatus,
        },
      }),
    };
    // --- FIX END ---
  } catch (error) {
    console.error('Booking creation error:', error);

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
