import sgMail from '@sendgrid/mail';
import { siteConfig } from './siteConfig';
import { logger } from './logger';

function validateSendgridConfig(): { isValid: boolean; error?: string } {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDER_EMAIL || siteConfig.emailFrom;

  if (!apiKey) {
    return { isValid: false, error: 'SENDGRID_API_KEY not configured' };
  }

  if (!apiKey.startsWith('SG.')) {
    return { isValid: false, error: 'SENDGRID_API_KEY appears to be invalid' };
  }

  if (!fromEmail || !fromEmail.includes('@')) {
    return { isValid: false, error: 'SENDER_EMAIL not configured properly' };
  }

  return { isValid: true };
}

export async function sendBookingConfirmation(
  email: string,
  subject: string,
  html: string
): Promise<{ success: boolean; error?: string }> {
  const validation = validateSendgridConfig();

  if (!validation.isValid) {
    const errorMsg = `Email service not configured: ${validation.error}`;
    logger.warn(errorMsg);

    // Return gracefully instead of throwing - allows site to work without emails
    return { success: false, error: validation.error };
  }

  try {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY as string);

    const mailOptions = {
      to: email,
      from: process.env.SENDER_EMAIL || siteConfig.emailFrom,
      subject,
      html,
    };

    await sgMail.send(mailOptions);

    logger.info('Email sent successfully', {
      to: email,
      subject,
      timestamp: new Date().toISOString()
    });

    return { success: true };
  } catch (error: any) {
    const errorMsg = `Failed to send email to ${email}`;
    logger.error(errorMsg, {
      error: error.message,
      code: error.code,
      response: error.response?.body
    });

    if (process.env.NODE_ENV === 'production') {
      throw new Error('Failed to send confirmation email');
    }

    return { success: false, error: error.message };
  }
}

export function generateBookingConfirmationEmail(
  customerName: string,
  bookingId: number,
  serviceName: string,
  date: string,
  time: string,
  price: string
) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h1 style="color: #1e40af;">Varausvahvistus - Autopesu Kiilto & Loisto</h1>
      <p>Hei ${customerName},</p>
      <p>Kiitos varauksestasi! Varauksesi on vahvistettu.</p>
      
      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h2 style="color: #374151; margin-top: 0;">Varauksen tiedot</h2>
        <p><strong>Varausnumero:</strong> #${bookingId}</p>
        <p><strong>Palvelu:</strong> ${serviceName}</p>
        <p><strong>Päivämäärä:</strong> ${date}</p>
        <p><strong>Aika:</strong> ${time}</p>
        <p><strong>Hinta:</strong> ${price}</p>
      </div>
      
      <p>Saavu paikalle ajoissa. Jos tarvitset muutoksia varaukseen, ota yhteyttä:</p>
  <p>Puhelin: 044 960 8148<br>
      Sähköposti: info@premiumautopesu.fi</p>
      
      <p>Kiitos luottamuksestasi!</p>
  <p><strong>Autopesu Kiilto & Loisto</strong></p>
    </div>
  `;
}