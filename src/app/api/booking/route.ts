import { NextRequest, NextResponse } from 'next/server';
import { validatePhoneNumber, validateEmail, validateName } from '@/lib/validation';
import { sendBookingConfirmationEmail, sendBusinessNotificationEmail } from '@/lib/email';

interface BookingData {
  date: string;
  time: string;
  service: {
    titleFi: string;
    price: number;
    duration: number;
  };
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  vehicleType: string;
  specialRequests: string;
}

export async function POST(request: NextRequest) {
  try {
    const bookingData: BookingData = await request.json();

    // Validate required fields
    if (!bookingData.customerName || !bookingData.customerPhone || !bookingData.customerEmail) {
      return NextResponse.json(
        { error: 'Missing required customer information' },
        { status: 400 }
      );
    }

    // Validate customer name
    const nameValidation = validateName(bookingData.customerName);
    if (!nameValidation.isValid) {
      return NextResponse.json(
        { error: nameValidation.error },
        { status: 400 }
      );
    }

    // Validate phone number
    const phoneValidation = validatePhoneNumber(bookingData.customerPhone);
    if (!phoneValidation.isValid) {
      return NextResponse.json(
        { error: phoneValidation.error },
        { status: 400 }
      );
    }

    // Validate email
    const emailValidation = validateEmail(bookingData.customerEmail);
    if (!emailValidation.isValid) {
      return NextResponse.json(
        { error: emailValidation.error },
        { status: 400 }
      );
    }

    // Use formatted/sanitized values
    const validatedData = {
      ...bookingData,
      customerName: nameValidation.formatted!,
      customerPhone: phoneValidation.formatted!,
      customerEmail: emailValidation.formatted!
    };

    // Generate booking ID
    const bookingId = `BK${Date.now()}`;

    // Prepare email data
    const emailData = {
      customerName: validatedData.customerName,
      customerEmail: validatedData.customerEmail,
      service: validatedData.service,
      date: validatedData.date,
      time: validatedData.time,
      vehicleType: validatedData.vehicleType,
      specialRequests: validatedData.specialRequests,
      bookingId
    };

    // 🚀 FIRE-AND-FORGET: Send notifications in background (don't await)
    console.log('Starting background notifications for booking:', bookingId);

    // Fire notifications in background without waiting
    Promise.allSettled([
      // Customer email confirmation
      sendBookingConfirmationEmail(emailData)
        .then(() => console.log('✅ Customer email sent successfully'))
        .catch(error => console.error('❌ Customer email failed:', error)),

      // Business email notification
      sendBusinessNotificationEmail(emailData)
        .then(() => console.log('✅ Business email sent successfully'))
        .catch(error => console.error('❌ Business email failed:', error)),

      // WhatsApp business notification (if configured)
      (async () => {
        if (process.env.BUSINESS_WHATSAPP_NUMBER && process.env.TWILIO_ACCOUNT_SID) {
          try {
            const twilio = (await import('twilio')).default;
            const client = twilio(
              process.env.TWILIO_ACCOUNT_SID,
              process.env.TWILIO_AUTH_TOKEN
            );

            const businessMessage = `New Car Wash Booking

Date: ${new Date(validatedData.date).toLocaleDateString('fi-FI')} at ${validatedData.time}
Service: ${validatedData.service.titleFi} (€${validatedData.service.price})
Customer: ${validatedData.customerName}
Phone: ${validatedData.customerPhone}
Email: ${validatedData.customerEmail}
Vehicle: ${validatedData.vehicleType}
Booking ID: ${bookingId}

${validatedData.specialRequests ? `Notes: ${validatedData.specialRequests}` : 'No special requests'}`;

            await client.messages.create({
              from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
              to: `whatsapp:${process.env.BUSINESS_WHATSAPP_NUMBER}`,
              body: businessMessage
            });

            console.log('✅ WhatsApp business notification sent successfully');
          } catch (error) {
            console.error('❌ WhatsApp business notification failed:', error);
          }
        }
      })()
    ]).then(() => {
      console.log('🎉 All background notifications completed for booking:', bookingId);
    });

    return NextResponse.json({
      success: true,
      message: 'Booking confirmed! Notifications are being sent in background.',
      bookingId
    });

  } catch (error) {
    console.error('Booking error:', error);

    // Handle Twilio-specific errors
    if (error instanceof Error && error.message.includes('phone number')) {
      return NextResponse.json(
        { error: 'Invalid phone number format. Please use international format (e.g., +358401234567)' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to process booking. Please try again.' },
      { status: 500 }
    );
  }
}