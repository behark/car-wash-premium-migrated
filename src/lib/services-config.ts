/**
 * External Services Configuration
 * Handles optional service integrations with graceful fallbacks
 */

interface ServiceConfig {
  enabled: boolean;
  required: boolean;
  name: string;
  fallback?: string;
}

interface ServicesConfig {
  email: ServiceConfig;
  sms: ServiceConfig;
  maps: ServiceConfig;
  payments: ServiceConfig;
  monitoring: ServiceConfig;
}

// Check if service credentials are available
const hasEmailConfig = !!(process.env.SENDGRID_API_KEY && process.env.SENDER_EMAIL);
const hasSmsConfig = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
const hasMapsConfig = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
const hasPaymentsConfig = !!process.env.STRIPE_SECRET_KEY;
const hasMonitoringConfig = !!process.env.SENTRY_DSN;

export const servicesConfig: ServicesConfig = {
  email: {
    enabled: hasEmailConfig,
    required: false,
    name: 'Email Notifications (SendGrid)',
    fallback: 'Booking confirmations will be stored in database only'
  },
  sms: {
    enabled: hasSmsConfig,
    required: false,
    name: 'SMS Notifications (Twilio)',
    fallback: 'Only email notifications will be sent'
  },
  maps: {
    enabled: hasMapsConfig,
    required: false,
    name: 'Google Maps Integration',
    fallback: 'Location will be shown as text address'
  },
  payments: {
    enabled: hasPaymentsConfig,
    required: false,
    name: 'Online Payments (Stripe)',
    fallback: 'Manual payment processing will be used'
  },
  monitoring: {
    enabled: hasMonitoringConfig,
    required: false,
    name: 'Error Monitoring (Sentry)',
    fallback: 'Console logging will be used for errors'
  }
};

/**
 * Get status of all configured services
 */
export function getServicesStatus() {
  return Object.entries(servicesConfig).map(([key, config]) => ({
    service: key,
    name: config.name,
    enabled: config.enabled,
    required: config.required,
    status: config.enabled ? 'active' : 'disabled',
    fallback: config.fallback
  }));
}

/**
 * Check if core functionality is available
 */
export function isCoreSystemReady() {
  const requiredServices = Object.values(servicesConfig).filter(s => s.required);
  return requiredServices.every(s => s.enabled);
}

/**
 * Get missing optional services for setup guidance
 */
export function getMissingServices() {
  return Object.entries(servicesConfig)
    .filter(([_, config]) => !config.enabled)
    .map(([key, config]) => ({
      service: key,
      name: config.name,
      fallback: config.fallback
    }));
}

/**
 * Service feature flags for conditional rendering
 */
export const features = {
  EMAIL_NOTIFICATIONS: servicesConfig.email.enabled,
  SMS_NOTIFICATIONS: servicesConfig.sms.enabled,
  GOOGLE_MAPS: servicesConfig.maps.enabled,
  ONLINE_PAYMENTS: servicesConfig.payments.enabled,
  ERROR_MONITORING: servicesConfig.monitoring.enabled,
} as const;