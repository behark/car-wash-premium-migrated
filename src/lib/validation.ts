// Phone number validation utilities

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  formatted?: string;
}

// Finnish phone number validation
export function validatePhoneNumber(phone: string): ValidationResult {
  if (!phone || phone.trim() === '') {
    return {
      isValid: false,
      error: 'Puhelinnumero on pakollinen'
    };
  }

  // Remove all spaces, hyphens, and parentheses
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');

  // Finnish and Kosovo mobile number patterns
  const patterns = [
    // Finnish patterns
    /^\+358[4-5]\d{8}$/, // +358 40/41/42/43/44/45/46/47/48/49/50 format
    /^358[4-5]\d{8}$/, // 358 without +
    /^0[4-5]\d{8}$/, // 040/041/042... format
    /^[4-5]\d{8}$/, // 40/41/42... format (will be converted to +358)

    // Kosovo patterns
    /^\+383[4-9]\d{7}$/, // +383 4x/5x/6x/7x/8x/9x format (8 digits total)
    /^383[4-9]\d{7}$/, // 383 without +
    /^0[4-9]\d{7}$/, // 04x/05x/06x/07x/08x/09x format
    /^[4-9]\d{7}$/ // 4x/5x/6x/7x/8x/9x format (will be converted to +383)
  ];

  let isValid = false;
  let formatted = cleanPhone;

  for (const pattern of patterns) {
    if (pattern.test(cleanPhone)) {
      isValid = true;

      // Format to international format
      if (cleanPhone.startsWith('+358') || cleanPhone.startsWith('+383')) {
        formatted = cleanPhone;
      } else if (cleanPhone.startsWith('358')) {
        formatted = '+' + cleanPhone;
      } else if (cleanPhone.startsWith('383')) {
        formatted = '+' + cleanPhone;
      } else if (cleanPhone.startsWith('0')) {
        // Determine if it's Finnish (9 digits after 0) or Kosovo (8 digits after 0)
        if (cleanPhone.length === 10) { // Finnish format 0xxxxxxxxx
          formatted = '+358' + cleanPhone.substring(1);
        } else if (cleanPhone.length === 9) { // Kosovo format 0xxxxxxxx
          formatted = '+383' + cleanPhone.substring(1);
        }
      } else if (/^[4-5]\d{8}$/.test(cleanPhone)) {
        // Finnish mobile pattern
        formatted = '+358' + cleanPhone;
      } else if (/^[4-9]\d{7}$/.test(cleanPhone)) {
        // Kosovo mobile pattern
        formatted = '+383' + cleanPhone;
      }
      break;
    }
  }

  if (!isValid) {
    return {
      isValid: false,
      error: 'Virheellinen puhelinnumero. Käytä muotoa +358 40 123 4567 tai +383 44 123 456'
    };
  }

  return {
    isValid: true,
    formatted
  };
}

// Email validation
export function validateEmail(email: string): ValidationResult {
  if (!email || email.trim() === '') {
    return {
      isValid: false,
      error: 'Sähköposti on pakollinen'
    };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    return {
      isValid: false,
      error: 'Virheellinen sähköpostiosoite'
    };
  }

  return {
    isValid: true,
    formatted: email.toLowerCase().trim()
  };
}

// Name validation
export function validateName(name: string): ValidationResult {
  if (!name || name.trim() === '') {
    return {
      isValid: false,
      error: 'Nimi on pakollinen'
    };
  }

  const trimmedName = name.trim();

  if (trimmedName.length < 2) {
    return {
      isValid: false,
      error: 'Nimi on liian lyhyt'
    };
  }

  if (trimmedName.length > 50) {
    return {
      isValid: false,
      error: 'Nimi on liian pitkä'
    };
  }

  // Check for valid characters (letters, spaces, hyphens, apostrophes)
  const nameRegex = /^[a-zA-ZäöåÄÖÅ\s\-']+$/;

  if (!nameRegex.test(trimmedName)) {
    return {
      isValid: false,
      error: 'Nimi sisältää virheellisiä merkkejä'
    };
  }

  return {
    isValid: true,
    formatted: trimmedName
  };
}

// Format phone number for display
export function formatPhoneForDisplay(phone: string): string {
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');

  if (cleanPhone.startsWith('+358')) {
    const number = cleanPhone.substring(4);
    if (number.length === 9) {
      return `+358 ${number.substring(0, 2)} ${number.substring(2, 5)} ${number.substring(5)}`;
    }
  }

  return phone;
}