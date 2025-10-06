import twilio from 'twilio';
import { logger } from './logger';

function validateWhatsAppConfig(): { isValid: boolean; error?: string } {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid) {
    return { isValid: false, error: 'TWILIO_ACCOUNT_SID not configured' };
  }

  if (!accountSid.startsWith('AC')) {
    return { isValid: false, error: 'TWILIO_ACCOUNT_SID appears to be invalid' };
  }

  if (!authToken || authToken.length < 20) {
    return { isValid: false, error: 'TWILIO_AUTH_TOKEN not configured or too short' };
  }

  if (!fromNumber || !fromNumber.startsWith('whatsapp:')) {
    return { isValid: false, error: 'TWILIO_WHATSAPP_FROM not configured or invalid format (should start with whatsapp:)' };
  }

  return { isValid: true };
}

export async function sendWhatsApp(
  to: string,
  body: string
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  // Enhanced logging for debugging
  console.log('🔍 WhatsApp Debug - Starting send process...');
  console.log('📱 Target phone:', to);
  console.log('📝 Message preview:', body.substring(0, 50) + '...');

  const validation = validateWhatsAppConfig();

  if (!validation.isValid) {
    const errorMsg = `WhatsApp service not configured: ${validation.error}`;
    console.log('❌ WhatsApp Config Error:', errorMsg);
    logger.warn(errorMsg);

    // Return gracefully instead of throwing - allows site to work without WhatsApp
    return { success: false, error: validation.error };
  }

  console.log('✅ WhatsApp config validation passed');

  try {
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID as string,
      process.env.TWILIO_AUTH_TOKEN as string
    );

    // Format the phone number for WhatsApp
    const whatsappTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

    const message = await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_FROM as string,
      to: whatsappTo,
      body,
    });

    logger.info('WhatsApp message sent successfully', {
      to: whatsappTo,
      messageId: message.sid,
      timestamp: new Date().toISOString()
    });

    return { success: true, messageId: message.sid };
  } catch (error: any) {
    const errorMsg = `Failed to send WhatsApp message to ${to}`;
    logger.error(errorMsg, {
      error: error.message,
      code: error.code,
      status: error.status
    });

    if (process.env.NODE_ENV === 'production') {
      throw new Error('Failed to send WhatsApp notification');
    }

    return { success: false, error: error.message };
  }
}

export function generateBookingConfirmationWhatsApp(
  customerName: string,
  confirmationCode: string,
  serviceName: string,
  date: string,
  time: string,
  price: string,
  loyaltyInfo?: {
    tier: string;
    points: number;
    totalPoints: number;
    discount?: number;
    savings?: string;
  }
) {
  const loyaltySection = loyaltyInfo ? `

🎁 *Kanta-asiakasedut:*
• *Taso:* ${loyaltyInfo.tier}
• *Pisteet tästä varauksesta:* +${loyaltyInfo.points}
• *Pisteesi yhteensä:* ${loyaltyInfo.totalPoints}${loyaltyInfo.discount ? `
• *Asiakasalennus:* ${(loyaltyInfo.discount * 100).toFixed(0)}%` : ''}${loyaltyInfo.savings ? `
• *Säästit:* ${loyaltyInfo.savings}` : ''}` : '';

  return `🚗 *Varaus vahvistettu!*

Hei ${customerName}!

Varauksesi on vahvistettu:
• *Palvelu:* ${serviceName}
• *Päivä:* ${date}
• *Aika:* ${time}
• *Hinta:* ${price}
• *Vahvistuskoodi:* ${confirmationCode}${loyaltySection}

📍 *Autopesu Kiilto & Loisto*
Läkkiseränttie 15, Helsinki
📞 044 960 8148
🕒 MA-PE 08:00-18:00, LA 10:00-16:00

Nähdään pesulassa! ✨`;
}

export function generateBookingReminderWhatsApp(
  customerName: string,
  serviceName: string,
  date: string,
  time: string
) {
  return `🔔 *Muistutus huomenna*

Hei ${customerName}!

Muistutus varauksestasi huomenna:
• *Palvelu:* ${serviceName}
• *Aika:* ${date} klo ${time}

📍 Autopesu Kiilto & Loisto
Läkkiseränttie 15, Helsinki

Jos tarvitset muutoksia, soita: 044 960 8148`;
}

export function generateAdminNotificationWhatsApp(
  customerName: string,
  serviceName: string,
  date: string,
  time: string,
  confirmationCode: string
) {
  return `🆕 *Uusi varaus*

Asiakas: ${customerName}
Palvelu: ${serviceName}
Päivä: ${date}
Aika: ${time}
Koodi: ${confirmationCode}

Vahvista varaus admin-paneelista.`;
}