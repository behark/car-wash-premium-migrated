/**
 * Input Validation Utilities
 * Provides comprehensive validation for user inputs
 */

import { z } from 'zod';

/**
 * Common validation patterns
 */
export const patterns = {
  email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  phone: /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/,
  url: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)$/,
  alphanumeric: /^[a-zA-Z0-9]+$/,
  letters: /^[a-zA-Z]+$/,
  numbers: /^[0-9]+$/,
  licensePlate: /^[A-Z]{2,3}-[0-9]{1,3}$/,
  postalCode: /^[0-9]{5}$/,
  date: /^\d{4}-\d{2}-\d{2}$/,
  time: /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/,
  creditCard: /^[0-9]{13,19}$/,
  cvv: /^[0-9]{3,4}$/,
};

/**
 * Password validation rules
 */
export const passwordRules = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: true,
  specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
};

/**
 * Validate email address
 */
export function validateEmail(email: string): { valid: boolean; error?: string } {
  if (!email) {
    return { valid: false, error: 'Email is required' };
  }

  if (!patterns.email.test(email)) {
    return { valid: false, error: 'Invalid email format' };
  }

  // Check for disposable email domains
  const disposableDomains = ['tempmail', 'throwaway', 'guerrilla', '10minutemail'];
  const domain = email.split('@')[1]?.toLowerCase();

  if (disposableDomains.some(d => domain?.includes(d))) {
    return { valid: false, error: 'Disposable email addresses are not allowed' };
  }

  return { valid: true };
}

/**
 * Validate phone number
 */
export function validatePhone(phone: string): { valid: boolean; error?: string } {
  if (!phone) {
    return { valid: false, error: 'Phone number is required' };
  }

  const cleaned = phone.replace(/[\s()-]/g, '');

  if (cleaned.length < 7 || cleaned.length > 15) {
    return { valid: false, error: 'Phone number must be between 7 and 15 digits' };
  }

  if (!patterns.phone.test(phone)) {
    return { valid: false, error: 'Invalid phone number format' };
  }

  return { valid: true };
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!password) {
    return { valid: false, errors: ['Password is required'] };
  }

  if (password.length < passwordRules.minLength) {
    errors.push(`Password must be at least ${passwordRules.minLength} characters long`);
  }

  if (passwordRules.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (passwordRules.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (passwordRules.requireNumber && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (passwordRules.requireSpecial) {
    const hasSpecial = passwordRules.specialChars.split('').some(char => password.includes(char));
    if (!hasSpecial) {
      errors.push('Password must contain at least one special character');
    }
  }

  // Check for common passwords
  const commonPasswords = ['password', '123456', 'admin', 'qwerty', 'letmein'];
  if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
    errors.push('Password is too common');
  }

  // Check for sequential characters
  if (/(.)\1{2,}/.test(password)) {
    errors.push('Password contains too many repeated characters');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate URL
 */
export function validateUrl(url: string): { valid: boolean; error?: string } {
  if (!url) {
    return { valid: false, error: 'URL is required' };
  }

  if (!patterns.url.test(url)) {
    return { valid: false, error: 'Invalid URL format' };
  }

  try {
    const parsed = new URL(url);

    // Only allow http(s) protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'Only HTTP(S) protocols are allowed' };
    }

    // Check for localhost in production
    if (process.env.NODE_ENV === 'production' && parsed.hostname === 'localhost') {
      return { valid: false, error: 'Localhost URLs are not allowed in production' };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL' };
  }
}

/**
 * Validate date
 */
export function validateDate(date: string): { valid: boolean; error?: string } {
  if (!date) {
    return { valid: false, error: 'Date is required' };
  }

  if (!patterns.date.test(date)) {
    return { valid: false, error: 'Invalid date format (YYYY-MM-DD)' };
  }

  const parsed = new Date(date);

  if (isNaN(parsed.getTime())) {
    return { valid: false, error: 'Invalid date' };
  }

  return { valid: true };
}

/**
 * Validate time
 */
export function validateTime(time: string): { valid: boolean; error?: string } {
  if (!time) {
    return { valid: false, error: 'Time is required' };
  }

  if (!patterns.time.test(time)) {
    return { valid: false, error: 'Invalid time format (HH:MM)' };
  }

  return { valid: true };
}

/**
 * Validate license plate (Finnish format)
 */
export function validateLicensePlate(plate: string): { valid: boolean; error?: string } {
  if (!plate) {
    return { valid: true }; // Optional field
  }

  const cleaned = plate.toUpperCase().replace(/\s/g, '');

  if (!patterns.licensePlate.test(cleaned)) {
    return { valid: false, error: 'Invalid license plate format (e.g., ABC-123)' };
  }

  return { valid: true };
}

/**
 * Validate Finnish postal code
 */
export function validatePostalCode(code: string): { valid: boolean; error?: string } {
  if (!code) {
    return { valid: false, error: 'Postal code is required' };
  }

  if (!patterns.postalCode.test(code)) {
    return { valid: false, error: 'Invalid postal code format (5 digits)' };
  }

  return { valid: true };
}

/**
 * Validate credit card number (Luhn algorithm)
 */
export function validateCreditCard(cardNumber: string): { valid: boolean; error?: string } {
  if (!cardNumber) {
    return { valid: false, error: 'Card number is required' };
  }

  const cleaned = cardNumber.replace(/\s/g, '');

  if (!patterns.creditCard.test(cleaned)) {
    return { valid: false, error: 'Invalid card number format' };
  }

  // Luhn algorithm
  let sum = 0;
  let isEven = false;

  for (let i = cleaned.length - 1; i >= 0; i--) {
    let digit = parseInt(cleaned[i], 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  if (sum % 10 !== 0) {
    return { valid: false, error: 'Invalid card number' };
  }

  return { valid: true };
}

/**
 * Validate CVV
 */
export function validateCVV(cvv: string): { valid: boolean; error?: string } {
  if (!cvv) {
    return { valid: false, error: 'CVV is required' };
  }

  if (!patterns.cvv.test(cvv)) {
    return { valid: false, error: 'Invalid CVV format (3-4 digits)' };
  }

  return { valid: true };
}

/**
 * Zod schemas for common validations
 */
export const schemas = {
  // User registration
  userRegistration: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100),
    email: z.string().email('Invalid email address'),
    password: z.string().min(passwordRules.minLength),
    phone: z.string().regex(patterns.phone, 'Invalid phone number'),
  }),

  // Booking creation
  bookingCreation: z.object({
    serviceId: z.number().positive(),
    vehicleType: z.string().min(1),
    date: z.string().regex(patterns.date),
    startTime: z.string().regex(patterns.time),
    customerName: z.string().min(2).max(100),
    customerEmail: z.string().email(),
    customerPhone: z.string().regex(patterns.phone),
    licensePlate: z.string().regex(patterns.licensePlate).optional(),
    notes: z.string().max(500).optional(),
  }),

  // Service creation
  serviceCreation: z.object({
    titleFi: z.string().min(2).max(100),
    titleEn: z.string().min(2).max(100),
    descriptionFi: z.string().min(10).max(500),
    descriptionEn: z.string().min(10).max(500),
    priceCents: z.number().positive().max(1000000),
    durationMinutes: z.number().positive().max(480),
    capacity: z.number().positive().max(10).default(1),
    image: z.string().url().optional(),
    isActive: z.boolean().default(true),
  }),

  // Payment processing
  paymentProcessing: z.object({
    amount: z.number().positive().max(1000000),
    currency: z.enum(['EUR', 'USD']),
    cardNumber: z.string().regex(patterns.creditCard),
    expiryMonth: z.number().min(1).max(12),
    expiryYear: z.number().min(new Date().getFullYear()),
    cvv: z.string().regex(patterns.cvv),
    cardholderName: z.string().min(2).max(100),
  }),

  // Contact form
  contactForm: z.object({
    name: z.string().min(2).max(100),
    email: z.string().email(),
    subject: z.string().min(5).max(200),
    message: z.string().min(10).max(1000),
    phone: z.string().regex(patterns.phone).optional(),
  }),
};

/**
 * Validate against a Zod schema
 */
export function validateWithSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { valid: boolean; data?: T; errors?: z.ZodError } {
  try {
    const validated = schema.parse(data);
    return { valid: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { valid: false, errors: error };
    }
    return { valid: false };
  }
}

/**
 * Custom validation for Finnish personal identity code (henkilötunnus)
 */
export function validateFinnishSSN(ssn: string): { valid: boolean; error?: string } {
  if (!ssn || ssn.length !== 11) {
    return { valid: false, error: 'Invalid personal identity code format' };
  }

  const centuryMarkers: { [key: string]: string } = {
    '+': '18',
    '-': '19',
    'A': '20',
  };

  const century = centuryMarkers[ssn[6]];
  if (!century) {
    return { valid: false, error: 'Invalid century marker' };
  }

  const day = parseInt(ssn.substring(0, 2), 10);
  const month = parseInt(ssn.substring(2, 4), 10);

  if (day < 1 || day > 31 || month < 1 || month > 12) {
    return { valid: false, error: 'Invalid date in personal identity code' };
  }

  const checkChars = '0123456789ABCDEFHJKLMNPRSTUVWXY';
  const checksum = parseInt(ssn.substring(0, 6) + ssn.substring(7, 10), 10) % 31;

  if (ssn[10] !== checkChars[checksum]) {
    return { valid: false, error: 'Invalid checksum in personal identity code' };
  }

  return { valid: true };
}

/**
 * Validate file upload
 */
export function validateFileUpload(
  file: { name: string; size: number; type: string },
  options: {
    maxSize?: number; // in bytes
    allowedTypes?: string[];
    allowedExtensions?: string[];
  } = {}
): { valid: boolean; error?: string } {
  const maxSize = options.maxSize || 10 * 1024 * 1024; // 10MB default
  const allowedTypes = options.allowedTypes || ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
  const allowedExtensions = options.allowedExtensions || ['.jpg', '.jpeg', '.png', '.gif', '.pdf'];

  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  if (file.size > maxSize) {
    return { valid: false, error: `File size exceeds ${maxSize / 1024 / 1024}MB` };
  }

  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    return { valid: false, error: 'File type not allowed' };
  }

  const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  if (allowedExtensions.length > 0 && !allowedExtensions.includes(extension)) {
    return { valid: false, error: 'File extension not allowed' };
  }

  // Check for double extensions (potential attack vector)
  if ((file.name.match(/\./g) || []).length > 1) {
    const parts = file.name.split('.');
    if (parts.some(part => part.length === 0)) {
      return { valid: false, error: 'Invalid file name' };
    }
  }

  return { valid: true };
}

// Export all validation functions
const validatorUtils = {
  patterns,
  passwordRules,
  validateEmail,
  validatePhone,
  validatePassword,
  validateUrl,
  validateDate,
  validateTime,
  validateLicensePlate,
  validatePostalCode,
  validateCreditCard,
  validateCVV,
  schemas,
  validateWithSchema,
  validateFinnishSSN,
  validateFileUpload,
};

export default validatorUtils;