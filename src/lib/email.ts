import sgMail from '@sendgrid/mail';
import { logger } from './logger';

// Initialize SendGrid if API key is available
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

function validateEmailConfig(): { isValid: boolean; error?: string } {
  const apiKey = process.env.SENDGRID_API_KEY;
  const senderEmail = process.env.SENDER_EMAIL;

  if (!apiKey) {
    return { isValid: false, error: 'SENDGRID_API_KEY not configured' };
  }

  if (!apiKey.startsWith('SG.')) {
    return { isValid: false, error: 'SENDGRID_API_KEY appears to be invalid' };
  }

  if (!senderEmail) {
    return { isValid: false, error: 'SENDER_EMAIL not configured' };
  }

  if (!senderEmail.includes('@')) {
    return { isValid: false, error: 'SENDER_EMAIL appears to be invalid' };
  }

  return { isValid: true };
}

export async function sendEmail(
  to: string,
  subject: string,
  htmlContent: string,
  textContent: string
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  // Enhanced logging for debugging
  console.log('📧 Email Debug - Starting send process...');
  console.log('📬 Target email:', to);
  console.log('📝 Subject:', subject);

  const validation = validateEmailConfig();

  if (!validation.isValid) {
    const errorMsg = `Email service not configured: ${validation.error}`;
    console.log('❌ Email Config Error:', errorMsg);
    logger.warn(errorMsg);

    // Return gracefully instead of throwing - allows site to work without email
    return { success: false, error: validation.error };
  }

  console.log('✅ Email config validation passed');

  try {
    const message = {
      to,
      from: {
        email: process.env.SENDER_EMAIL as string,
        name: 'Autopesu Kiilto & Loisto'
      },
      subject,
      text: textContent,
      html: htmlContent,
    };

    const response = await sgMail.send(message);

    logger.info('Email sent successfully', {
      to,
      subject,
      messageId: response[0].headers['x-message-id'],
      timestamp: new Date().toISOString()
    });

    console.log('✅ Email sent successfully:', response[0].headers['x-message-id']);

    return {
      success: true,
      messageId: response[0].headers['x-message-id'] as string
    };
  } catch (error: any) {
    const errorMsg = `Failed to send email to ${to}`;
    logger.error(errorMsg, {
      error: error.message,
      response: error.response?.body
    });

    console.log('❌ Email send failed:', error.message);

    if (process.env.NODE_ENV === 'production') {
      throw new Error('Failed to send email notification');
    }

    return { success: false, error: error.message };
  }
}

export async function sendBookingConfirmationEmail(
  to: string,
  booking: any,
  loyaltyInfo?: any
): Promise<{ success: boolean; error?: string }> {
  try {
    const emailTemplate = (await import('./email-templates')).bookingConfirmationTemplate(booking, loyaltyInfo);

    return await sendEmail(
      to,
      emailTemplate.subject,
      emailTemplate.html,
      emailTemplate.text
    );
  } catch (error: any) {
    console.error('Error sending booking confirmation email:', error);
    return { success: false, error: error.message };
  }
}