import twilio from 'twilio';
import { logger } from './logger';

function validateTwilioConfig(): { isValid: boolean; error?: string } {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM;

  if (!accountSid) {
    return { isValid: false, error: 'TWILIO_ACCOUNT_SID not configured' };
  }

  if (!accountSid.startsWith('AC')) {
    return { isValid: false, error: 'TWILIO_ACCOUNT_SID appears to be invalid' };
  }

  if (!authToken || authToken.length < 20) {
    return { isValid: false, error: 'TWILIO_AUTH_TOKEN not configured or too short' };
  }

  if (!fromNumber || !fromNumber.startsWith('+')) {
    return { isValid: false, error: 'TWILIO_FROM not configured or invalid format' };
  }

  return { isValid: true };
}

export async function sendSMS(to: string, body: string): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const validation = validateTwilioConfig();

  if (!validation.isValid) {
    const errorMsg = `SMS service not configured: ${validation.error}`;
    logger.warn(errorMsg);

    // Return gracefully instead of throwing - allows site to work without SMS
    return { success: false, error: validation.error };
  }

  try {
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID as string,
      process.env.TWILIO_AUTH_TOKEN as string
    );

    const message = await client.messages.create({
      from: process.env.TWILIO_FROM as string,
      to,
      body,
    });

    logger.info('SMS sent successfully', {
      to,
      messageId: message.sid,
      timestamp: new Date().toISOString()
    });

    return { success: true, messageId: message.sid };
  } catch (error: any) {
    const errorMsg = `Failed to send SMS to ${to}`;
    logger.error(errorMsg, {
      error: error.message,
      code: error.code,
      status: error.status
    });

    if (process.env.NODE_ENV === 'production') {
      throw new Error('Failed to send SMS notification');
    }

    return { success: false, error: error.message };
  }
}

export function generateBookingConfirmationSMS(
  customerName: string,
  bookingId: number,
  serviceName: string,
  date: string,
  time: string
) {
  return `Hei ${customerName}! Varauksesi #${bookingId} on vahvistettu. ${serviceName}, ${date} klo ${time}. Autopesu Kiilto & Loisto`;
}