/**
 * Google reCAPTCHA v3 Integration
 * Provides spam protection for forms and API endpoints
 */

import { NextApiRequest } from 'next';

const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;
const RECAPTCHA_SITE_KEY = process.env.RECAPTCHA_SITE_KEY;
const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

// Score thresholds for different actions
const SCORE_THRESHOLDS = {
  login: 0.5,
  booking: 0.6,
  contact: 0.4,
  payment: 0.7,
  default: 0.5,
};

/**
 * Verify reCAPTCHA token
 */
export async function verifyRecaptcha(
  token: string,
  action?: string,
  remoteIp?: string
): Promise<{
  success: boolean;
  score?: number;
  action?: string;
  challenge_ts?: string;
  hostname?: string;
  error?: string;
}> {
  if (!RECAPTCHA_SECRET_KEY) {
    console.warn('reCAPTCHA secret key not configured');
    return { success: true }; // Allow in development
  }

  if (!token) {
    return {
      success: false,
      error: 'reCAPTCHA token is missing',
    };
  }

  try {
    const params = new URLSearchParams({
      secret: RECAPTCHA_SECRET_KEY,
      response: token,
    });

    if (remoteIp) {
      params.append('remoteip', remoteIp);
    }

    const response = await fetch(RECAPTCHA_VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`reCAPTCHA API error: ${response.status}`);
    }

    const data = await response.json();

    // Check if verification was successful
    if (!data.success) {
      return {
        success: false,
        error: data['error-codes']?.join(', ') || 'Verification failed',
      };
    }

    // Check action if specified
    if (action && data.action !== action) {
      return {
        success: false,
        error: `Action mismatch: expected ${action}, got ${data.action}`,
      };
    }

    // Check score threshold
    const threshold = SCORE_THRESHOLDS[action as keyof typeof SCORE_THRESHOLDS] || SCORE_THRESHOLDS.default;
    if (data.score < threshold) {
      logSuspiciousActivity({
        type: 'low_recaptcha_score',
        score: data.score,
        threshold,
        action: data.action,
        hostname: data.hostname,
        ip: remoteIp,
      });

      return {
        success: false,
        score: data.score,
        error: `Score too low: ${data.score} < ${threshold}`,
      };
    }

    return {
      success: true,
      score: data.score,
      action: data.action,
      challenge_ts: data.challenge_ts,
      hostname: data.hostname,
    };
  } catch (error: any) {
    console.error('reCAPTCHA verification error:', error);
    return {
      success: false,
      error: error.message || 'Verification failed',
    };
  }
}

/**
 * Middleware for API routes requiring reCAPTCHA
 */
export function requireRecaptcha(action?: string, minScore?: number) {
  return async (req: NextApiRequest): Promise<{ success: boolean; error?: string }> => {
    const token = req.body.recaptchaToken || req.headers['x-recaptcha-token'];

    if (!token) {
      return {
        success: false,
        error: 'reCAPTCHA token required',
      };
    }

    const ip = getClientIp(req);
    const result = await verifyRecaptcha(token, action, ip);

    if (!result.success) {
      return result;
    }

    // Check custom minimum score if provided
    if (minScore && result.score && result.score < minScore) {
      return {
        success: false,
        error: `Score too low: ${result.score} < ${minScore}`,
      };
    }

    return { success: true };
  };
}

/**
 * Get client IP from request
 */
function getClientIp(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for'] as string;
  const ip = forwarded ? forwarded.split(',')[0] : req.socket.remoteAddress;
  return ip || '';
}

/**
 * Log suspicious activity
 */
function logSuspiciousActivity(data: any): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    ...data,
  };

  console.warn('[RECAPTCHA SUSPICIOUS]', logEntry);

  // Send to monitoring service in production
  if (process.env.NODE_ENV === 'production' && process.env.MONITORING_WEBHOOK_URL) {
    fetch(process.env.MONITORING_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'recaptcha_suspicious',
        ...logEntry,
      }),
    }).catch(console.error);
  }
}

/**
 * React Hook for reCAPTCHA
 */
export const useRecaptcha = () => {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

  const executeRecaptcha = async (action: string): Promise<string | null> => {
    if (!siteKey) {
      console.warn('reCAPTCHA site key not configured');
      return null;
    }

    if (typeof window === 'undefined' || !(window as any).grecaptcha) {
      console.error('reCAPTCHA not loaded');
      return null;
    }

    try {
      const token = await (window as any).grecaptcha.execute(siteKey, { action });
      return token;
    } catch (error) {
      console.error('reCAPTCHA execute error:', error);
      return null;
    }
  };

  return { executeRecaptcha, siteKey };
};

/**
 * Load reCAPTCHA script
 */
export function loadRecaptchaScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Not in browser environment'));
      return;
    }

    const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    if (!siteKey) {
      console.warn('reCAPTCHA site key not configured');
      resolve();
      return;
    }

    // Check if already loaded
    if ((window as any).grecaptcha) {
      resolve();
      return;
    }

    // Create script element
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      resolve();
    };

    script.onerror = () => {
      reject(new Error('Failed to load reCAPTCHA script'));
    };

    document.head.appendChild(script);
  });
}

/**
 * Honeypot field for additional spam protection
 */
export interface HoneypotField {
  name: string;
  value: string;
  timestamp: number;
}

/**
 * Create honeypot field data
 */
export function createHoneypot(): HoneypotField {
  return {
    name: '_gotcha',
    value: '',
    timestamp: Date.now(),
  };
}

/**
 * Validate honeypot field
 */
export function validateHoneypot(field: HoneypotField): boolean {
  // Check if honeypot field is filled (bot detected)
  if (field.value !== '') {
    logSuspiciousActivity({
      type: 'honeypot_triggered',
      value: field.value,
    });
    return false;
  }

  // Check submission time (too fast = bot)
  const submissionTime = Date.now() - field.timestamp;
  if (submissionTime < 3000) { // Less than 3 seconds
    logSuspiciousActivity({
      type: 'submission_too_fast',
      time: submissionTime,
    });
    return false;
  }

  return true;
}

/**
 * Rate limiting for form submissions
 */
const submissionTracking = new Map<string, number[]>();

export function checkSubmissionRate(
  identifier: string,
  maxSubmissions: number = 5,
  windowMinutes: number = 60
): boolean {
  const now = Date.now();
  const window = windowMinutes * 60 * 1000;
  const cutoff = now - window;

  // Get or create tracking array
  let submissions = submissionTracking.get(identifier) || [];

  // Remove old submissions
  submissions = submissions.filter(time => time > cutoff);

  // Check rate limit
  if (submissions.length >= maxSubmissions) {
    logSuspiciousActivity({
      type: 'form_rate_limit_exceeded',
      identifier,
      count: submissions.length,
      window: windowMinutes,
    });
    return false;
  }

  // Add current submission
  submissions.push(now);
  submissionTracking.set(identifier, submissions);

  return true;
}

/**
 * Clean up old tracking data
 */
setInterval(() => {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;

  for (const [key, submissions] of submissionTracking.entries()) {
    const recent = submissions.filter(time => time > now - oneHour);
    if (recent.length === 0) {
      submissionTracking.delete(key);
    } else {
      submissionTracking.set(key, recent);
    }
  }
}, 10 * 60 * 1000); // Clean up every 10 minutes

// Export configuration
export const recaptchaConfig = {
  siteKey: RECAPTCHA_SITE_KEY,
  thresholds: SCORE_THRESHOLDS,
};

export default {
  verifyRecaptcha,
  requireRecaptcha,
  useRecaptcha,
  loadRecaptchaScript,
  createHoneypot,
  validateHoneypot,
  checkSubmissionRate,
  recaptchaConfig,
};