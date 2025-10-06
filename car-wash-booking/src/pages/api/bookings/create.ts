import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma-simple';
import { BookingStatus, PaymentStatus } from '@prisma/client';
import { format, addMinutes } from 'date-fns';
import { sendWhatsApp, generateBookingConfirmationWhatsApp, generateAdminNotificationWhatsApp } from '../../../lib/whatsapp';
import { sendSMS, generateBookingConfirmationSMS } from '../../../lib/sms';

// Simple confirmation code generator
function generateConfirmationCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
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
    } = req.body;

    // Basic validation
    if (!serviceId || !vehicleType || !date || !startTime || !customerName || !customerEmail || !customerPhone) {
      return res.status(400).json({
        error: 'Missing required fields'
      });
    }

    // Get service
    const service = await prisma.service.findUnique({
      where: { id: parseInt(serviceId) },
    });

    if (!service) {
      return res.status(404).json({
        error: 'Service not found'
      });
    }

    const startDateTime = new Date(date);
    const [hours, minutes] = startTime.split(':').map(Number);
    startDateTime.setHours(hours, minutes, 0, 0);

    const endDateTime = addMinutes(startDateTime, service.durationMinutes);

    // Check for overlapping bookings
    const overlappingBooking = await prisma.booking.findFirst({
      where: {
        date: new Date(date),
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
      return res.status(409).json({
        error: 'Time slot is not available'
      });
    }

    const confirmationCode = generateConfirmationCode();

    // Create the booking
    const booking = await prisma.booking.create({
      data: {
        serviceId: parseInt(serviceId),
        vehicleType,
        date: new Date(date),
        startTime: format(startDateTime, 'HH:mm'),
        endTime: format(endDateTime, 'HH:mm'),
        duration: service.durationMinutes,
        priceCents: service.priceCents,
        status: BookingStatus.PENDING,
        customerName,
        customerEmail,
        customerPhone,
        licensePlate: licensePlate || null,
        notes: notes || null,
        paymentStatus: PaymentStatus.PENDING,
        confirmationCode,
      },
      include: {
        service: true,
      },
    });

    // Send notifications (non-blocking)
    const dateString = format(new Date(date), 'dd.MM.yyyy');
    const timeString = startTime;
    const priceString = `${(service.priceCents / 100).toFixed(0)}€`;

    // Send WhatsApp notification to customer
    if (customerPhone) {
      const whatsappMessage = generateBookingConfirmationWhatsApp(
        customerName,
        confirmationCode,
        service.titleFi,
        dateString,
        timeString,
        priceString
      );

      sendWhatsApp(customerPhone, whatsappMessage).catch(error => {
        console.log('WhatsApp notification failed (non-critical):', error);
      });
    }

    // Send SMS as fallback
    if (customerPhone) {
      const smsMessage = generateBookingConfirmationSMS(
        customerName,
        booking.id,
        service.titleFi,
        dateString,
        timeString
      );

      sendSMS(customerPhone, smsMessage).catch(error => {
        console.log('SMS notification failed (non-critical):', error);
      });
    }

    // Send admin notification if admin phone is configured
    const adminPhone = process.env.ADMIN_PHONE;
    if (adminPhone) {
      const adminMessage = generateAdminNotificationWhatsApp(
        customerName,
        service.titleFi,
        dateString,
        timeString,
        confirmationCode
      );

      sendWhatsApp(adminPhone, adminMessage).catch(error => {
        console.log('Admin WhatsApp notification failed (non-critical):', error);
      });
    }

    console.log('Booking created successfully for:', customerName, 'Code:', confirmationCode);

    res.status(201).json({
      success: true,
      data: {
        booking: {
          id: booking.id,
          confirmationCode: booking.confirmationCode,
          service: {
            titleFi: booking.service.titleFi,
            durationMinutes: booking.service.durationMinutes,
            priceCents: booking.service.priceCents,
          },
          date: booking.date.toISOString(),
          startTime: booking.startTime,
          endTime: booking.endTime,
          customerName: booking.customerName,
          customerEmail: booking.customerEmail,
          status: booking.status,
          paymentStatus: booking.paymentStatus,
        },
      },
    });
  } catch (error: any) {
    console.error('Booking creation error:', error);

    res.status(500).json({
      error: 'Failed to create booking',
      message: error.message,
    });
  }
}