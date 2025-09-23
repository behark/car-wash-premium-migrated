/**
 * QR Code Generation Library
 * Generates QR codes for bookings, contact info, and quick actions
 */

import QRCode from 'qrcode';

export interface BookingQRData {
  bookingId: number;
  confirmationCode: string;
  customerEmail: string;
  serviceName: string;
  date: string;
  time: string;
  url: string;
}

export interface ContactQRData {
  name: string;
  phone: string;
  email: string;
  website: string;
  address: string;
}

export interface WiFiQRData {
  ssid: string;
  password: string;
  security: 'WPA' | 'WEP' | 'nopass';
  hidden?: boolean;
}

/**
 * Generate QR code for booking confirmation
 */
export async function generateBookingQR(
  bookingData: BookingQRData,
  options: {
    size?: number;
    format?: 'png' | 'svg';
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  } = {}
): Promise<string> {
  const {
    size = 256,
    format = 'png',
    errorCorrectionLevel = 'M',
  } = options;

  // Create structured data for the QR code
  const qrData = {
    type: 'booking',
    id: bookingData.bookingId,
    code: bookingData.confirmationCode,
    email: bookingData.customerEmail,
    service: bookingData.serviceName,
    date: bookingData.date,
    time: bookingData.time,
    url: bookingData.url,
    generated: new Date().toISOString(),
  };

  const qrCodeOptions = {
    width: size,
    height: size,
    errorCorrectionLevel,
    type: format === 'svg' ? 'svg' : 'image/png',
    quality: 0.92,
    margin: 1,
    color: {
      dark: '#1976d2',  // Blue color for the QR code
      light: '#FFFFFF', // White background
    },
  };

  try {
    if (format === 'svg') {
      return await QRCode.toString(JSON.stringify(qrData), {
        ...qrCodeOptions,
        type: 'svg',
      });
    } else {
      return (await QRCode.toDataURL(JSON.stringify(qrData), qrCodeOptions as any)) as unknown as string;
    }
  } catch (error) {
    console.error('Failed to generate booking QR code:', error);
    throw new Error('QR code generation failed');
  }
}

/**
 * Generate QR code for contact information (vCard)
 */
export async function generateContactQR(
  contactData: ContactQRData,
  options: {
    size?: number;
    format?: 'png' | 'svg';
  } = {}
): Promise<string> {
  const { size = 256, format = 'png' } = options;

  // Create vCard format
  const vCard = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${contactData.name}`,
    `TEL:${contactData.phone}`,
    `EMAIL:${contactData.email}`,
    `URL:${contactData.website}`,
    `ADR:;;${contactData.address};;;;`,
    'END:VCARD'
  ].join('\n');

  const qrCodeOptions = {
    width: size,
    height: size,
    errorCorrectionLevel: 'M' as const,
    type: format === 'svg' ? 'svg' : 'image/png',
    quality: 0.92,
    margin: 1,
    color: {
      dark: '#1976d2',
      light: '#FFFFFF',
    },
  };

  try {
    if (format === 'svg') {
      return await QRCode.toString(vCard, {
        ...qrCodeOptions,
        type: 'svg',
      });
    } else {
      return (await QRCode.toDataURL(vCard, qrCodeOptions as any)) as unknown as string;
    }
  } catch (error) {
    console.error('Failed to generate contact QR code:', error);
    throw new Error('Contact QR code generation failed');
  }
}

/**
 * Generate QR code for WiFi connection
 */
export async function generateWiFiQR(
  wifiData: WiFiQRData,
  options: {
    size?: number;
    format?: 'png' | 'svg';
  } = {}
): Promise<string> {
  const { size = 256, format = 'png' } = options;

  // Create WiFi QR format
  const wifiString = `WIFI:T:${wifiData.security};S:${wifiData.ssid};P:${wifiData.password};H:${wifiData.hidden ? 'true' : 'false'};;`;

  const qrCodeOptions = {
    width: size,
    height: size,
    errorCorrectionLevel: 'M' as const,
    type: format === 'svg' ? 'svg' : 'image/png',
    quality: 0.92,
    margin: 1,
    color: {
      dark: '#1976d2',
      light: '#FFFFFF',
    },
  };

  try {
    if (format === 'svg') {
      return await QRCode.toString(wifiString, {
        ...qrCodeOptions,
        type: 'svg',
      });
    } else {
      return (await QRCode.toDataURL(wifiString, qrCodeOptions as any)) as unknown as string;
    }
  } catch (error) {
    console.error('Failed to generate WiFi QR code:', error);
    throw new Error('WiFi QR code generation failed');
  }
}

/**
 * Generate QR code for URL/website
 */
export async function generateUrlQR(
  url: string,
  options: {
    size?: number;
    format?: 'png' | 'svg';
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  } = {}
): Promise<string> {
  const {
    size = 256,
    format = 'png',
    errorCorrectionLevel = 'M',
  } = options;

  const qrCodeOptions = {
    width: size,
    height: size,
    errorCorrectionLevel,
    type: format === 'svg' ? 'svg' : 'image/png',
    quality: 0.92,
    margin: 1,
    color: {
      dark: '#1976d2',
      light: '#FFFFFF',
    },
  };

  try {
    if (format === 'svg') {
      return await QRCode.toString(url, {
        ...qrCodeOptions,
        type: 'svg',
      });
    } else {
      return (await QRCode.toDataURL(url, qrCodeOptions as any)) as unknown as string;
    }
  } catch (error) {
    console.error('Failed to generate URL QR code:', error);
    throw new Error('URL QR code generation failed');
  }
}

/**
 * Generate QR code for SMS message
 */
export async function generateSmsQR(
  phoneNumber: string,
  message: string,
  options: {
    size?: number;
    format?: 'png' | 'svg';
  } = {}
): Promise<string> {
  const { size = 256, format = 'png' } = options;

  const smsString = `sms:${phoneNumber}?body=${encodeURIComponent(message)}`;

  const qrCodeOptions = {
    width: size,
    height: size,
    errorCorrectionLevel: 'M' as const,
    type: format === 'svg' ? 'svg' : 'image/png',
    quality: 0.92,
    margin: 1,
    color: {
      dark: '#1976d2',
      light: '#FFFFFF',
    },
  };

  try {
    if (format === 'svg') {
      return await QRCode.toString(smsString, {
        ...qrCodeOptions,
        type: 'svg',
      });
    } else {
      return (await QRCode.toDataURL(smsString, qrCodeOptions as any)) as unknown as string;
    }
  } catch (error) {
    console.error('Failed to generate SMS QR code:', error);
    throw new Error('SMS QR code generation failed');
  }
}

/**
 * Generate QR code for calendar event
 */
export async function generateCalendarEventQR(
  event: {
    title: string;
    start: Date;
    end: Date;
    description?: string;
    location?: string;
  },
  options: {
    size?: number;
    format?: 'png' | 'svg';
  } = {}
): Promise<string> {
  const { size = 256, format = 'png' } = options;

  // Format dates for iCal format
  const formatDate = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  // Create iCal format
  const icalString = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//KiiltoLoisto//Car Wash Booking//EN',
    'BEGIN:VEVENT',
    `DTSTART:${formatDate(event.start)}`,
    `DTEND:${formatDate(event.end)}`,
    `SUMMARY:${event.title}`,
    event.description ? `DESCRIPTION:${event.description}` : '',
    event.location ? `LOCATION:${event.location}` : '',
    'END:VEVENT',
    'END:VCALENDAR'
  ].filter(Boolean).join('\n');

  const qrCodeOptions = {
    width: size,
    height: size,
    errorCorrectionLevel: 'M' as const,
    type: format === 'svg' ? 'svg' : 'image/png',
    quality: 0.92,
    margin: 1,
    color: {
      dark: '#1976d2',
      light: '#FFFFFF',
    },
  };

  try {
    if (format === 'svg') {
      return await QRCode.toString(icalString, {
        ...qrCodeOptions,
        type: 'svg',
      });
    } else {
      return (await QRCode.toDataURL(icalString, qrCodeOptions as any)) as unknown as string;
    }
  } catch (error) {
    console.error('Failed to generate calendar QR code:', error);
    throw new Error('Calendar QR code generation failed');
  }
}

/**
 * Parse QR code data (for scanning functionality)
 */
export function parseBookingQRData(qrData: string): BookingQRData | null {
  try {
    const parsed = JSON.parse(qrData);

    if (parsed.type === 'booking' && parsed.id && parsed.code) {
      return {
        bookingId: parsed.id,
        confirmationCode: parsed.code,
        customerEmail: parsed.email,
        serviceName: parsed.service,
        date: parsed.date,
        time: parsed.time,
        url: parsed.url,
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Generate QR code for quick booking with pre-filled service
 */
export async function generateQuickBookingQR(
  serviceId: number,
  serviceName: string,
  options: {
    size?: number;
    format?: 'png' | 'svg';
  } = {}
): Promise<string> {
  const { size = 256, format = 'png' } = options;

  const bookingUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://kiiltoloisto.fi'}/booking?service=${serviceId}`;

  return generateUrlQR(bookingUrl, { size, format });
}

/**
 * Utility function to download QR code as file
 */
export function downloadQRCode(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * React hook for QR code generation
 */
export function useQRCode() {
  const generateBookingQRCode = async (
    bookingData: BookingQRData,
    options?: { size?: number; format?: 'png' | 'svg' }
  ) => {
    return generateBookingQR(bookingData, options);
  };

  const generateContactQRCode = async (
    contactData: ContactQRData,
    options?: { size?: number; format?: 'png' | 'svg' }
  ) => {
    return generateContactQR(contactData, options);
  };

  const generateUrlQRCode = async (
    url: string,
    options?: { size?: number; format?: 'png' | 'svg' }
  ) => {
    return generateUrlQR(url, options);
  };

  const downloadQR = (dataUrl: string, filename: string) => {
    downloadQRCode(dataUrl, filename);
  };

  return {
    generateBookingQRCode,
    generateContactQRCode,
    generateUrlQRCode,
    downloadQR,
  };
}

export default {
  generateBookingQR,
  generateContactQR,
  generateWiFiQR,
  generateUrlQR,
  generateSmsQR,
  generateCalendarEventQR,
  generateQuickBookingQR,
  parseBookingQRData,
  downloadQRCode,
  useQRCode,
};