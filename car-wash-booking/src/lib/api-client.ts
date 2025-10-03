import { apiMonitor, retryWithBackoff } from './api-monitor';
import { logger } from './logger';
import sgMail from '@sendgrid/mail';
import Stripe from 'stripe';
import twilio from 'twilio';

// Types
export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: any[];
}

export interface SMSOptions {
  to: string;
  body: string;
}

export interface PaymentSessionOptions {
  amount: number;
  currency: string;
  customerEmail: string;
  description: string;
  metadata?: Record<string, string>;
  successUrl: string;
  cancelUrl: string;
}

// Email Service with Fallback
export class EmailService {
  private static instance: EmailService;
  private sendgridConfigured = false;
  private fallbackQueue: EmailOptions[] = [];

  private constructor() {
    this.initialize();
  }

  static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  private initialize() {
    const apiKey = process.env.SENDGRID_API_KEY;

    if (apiKey && apiKey !== 'SG.test-key-placeholder' && apiKey.startsWith('SG.')) {
      try {
        sgMail.setApiKey(apiKey);
        this.sendgridConfigured = true;
        logger.info('SendGrid initialized successfully');
      } catch (error: any) {
        logger.error('Failed to initialize SendGrid', error);
        this.sendgridConfigured = false;
      }
    } else {
      logger.warn('SendGrid not configured - email will be queued for manual processing');
    }
  }

  async sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; fallback?: boolean }> {
    // Check circuit breaker
    if (!apiMonitor.isServiceAvailable('sendgrid')) {
      return this.queueEmail(options);
    }

    if (!this.sendgridConfigured) {
      return this.queueEmail(options);
    }

    try {
      // Primary: SendGrid
      const result = await retryWithBackoff(
        async () => {
          const msg = {
            to: options.to,
            from: process.env.SENDER_EMAIL || 'noreply@kiiltoloisto.fi',
            subject: options.subject,
            text: options.text || this.stripHtml(options.html),
            html: options.html,
            attachments: options.attachments
          };

          const response = await sgMail.send(msg);
          return response[0];
        },
        'sendgrid',
        3,
        1000
      );

      logger.info('Email sent successfully', {
        to: options.to,
        subject: options.subject,
        messageId: result.headers['x-message-id']
      });

      return {
        success: true,
        messageId: result.headers['x-message-id']
      };
    } catch (error: any) {
      logger.error('Failed to send email via SendGrid', {
        error: error.message,
        to: options.to
      });

      // Fallback: Queue for manual processing
      return this.queueEmail(options);
    }
  }

  private async queueEmail(options: EmailOptions): Promise<{ success: boolean; fallback: boolean }> {
    this.fallbackQueue.push(options);

    // Store in database for admin review
    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();

      await prisma.emailQueue.create({
        data: {
          to: options.to,
          subject: options.subject,
          html: options.html,
          status: 'pending',
          createdAt: new Date()
        }
      });

      await prisma.$disconnect();
    } catch (dbError) {
      logger.error('Failed to queue email in database', dbError);
    }

    logger.warn('Email queued for manual processing', {
      to: options.to,
      subject: options.subject,
      queueLength: this.fallbackQueue.length
    });

    return {
      success: true,
      fallback: true
    };
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '');
  }

  getQueuedEmails(): EmailOptions[] {
    return [...this.fallbackQueue];
  }

  clearQueue(): void {
    this.fallbackQueue = [];
  }
}

// SMS Service with Fallback
export class SMSService {
  private static instance: SMSService;
  private twilioClient?: any;
  private twilioConfigured = false;

  private constructor() {
    this.initialize();
  }

  static getInstance(): SMSService {
    if (!SMSService.instance) {
      SMSService.instance = new SMSService();
    }
    return SMSService.instance;
  }

  private initialize() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (accountSid && authToken && accountSid.startsWith('AC')) {
      try {
        this.twilioClient = twilio(accountSid, authToken);
        this.twilioConfigured = true;
        logger.info('Twilio initialized successfully');
      } catch (error: any) {
        logger.error('Failed to initialize Twilio', error);
        this.twilioConfigured = false;
      }
    } else {
      logger.warn('Twilio not configured - SMS will use email fallback');
    }
  }

  async sendSMS(options: SMSOptions): Promise<{ success: boolean; messageId?: string; fallback?: boolean }> {
    // Check circuit breaker
    if (!apiMonitor.isServiceAvailable('twilio')) {
      return this.sendViaEmailFallback(options);
    }

    if (!this.twilioConfigured || !this.twilioClient) {
      return this.sendViaEmailFallback(options);
    }

    try {
      const result = await retryWithBackoff(
        async () => {
          const message = await this.twilioClient.messages.create({
            from: process.env.TWILIO_FROM || process.env.TWILIO_PHONE_NUMBER,
            to: options.to,
            body: options.body
          });
          return message;
        },
        'twilio',
        3,
        2000
      );

      logger.info('SMS sent successfully', {
        to: options.to,
        messageId: result.sid
      });

      return {
        success: true,
        messageId: result.sid
      };
    } catch (error: any) {
      logger.error('Failed to send SMS via Twilio', {
        error: error.message,
        to: options.to
      });

      // Fallback: Send via email
      return this.sendViaEmailFallback(options);
    }
  }

  private async sendViaEmailFallback(options: SMSOptions): Promise<{ success: boolean; fallback: boolean }> {
    // If SMS fails, log the message for manual processing
    logger.warn('SMS fallback: Message logged for manual processing', {
      to: options.to,
      message: options.body
    });

    // Store in database for admin review
    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();

      await prisma.smsQueue.create({
        data: {
          to: options.to,
          body: options.body,
          status: 'pending',
          createdAt: new Date()
        }
      });

      await prisma.$disconnect();
    } catch (dbError) {
      logger.error('Failed to queue SMS in database', dbError);
    }

    return {
      success: true,
      fallback: true
    };
  }
}

// Payment Service with Stripe
export class PaymentService {
  private static instance: PaymentService;
  private stripe?: Stripe;
  private stripeConfigured = false;

  private constructor() {
    this.initialize();
  }

  static getInstance(): PaymentService {
    if (!PaymentService.instance) {
      PaymentService.instance = new PaymentService();
    }
    return PaymentService.instance;
  }

  private initialize() {
    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (secretKey && (secretKey.startsWith('sk_test_') || secretKey.startsWith('sk_live_'))) {
      try {
        this.stripe = new Stripe(secretKey, {
          apiVersion: '2022-11-15' as any,
        });
        this.stripeConfigured = true;
        logger.info('Stripe initialized successfully', {
          mode: secretKey.startsWith('sk_test_') ? 'test' : 'live'
        });
      } catch (error: any) {
        logger.error('Failed to initialize Stripe', error);
        this.stripeConfigured = false;
      }
    } else {
      logger.warn('Stripe not configured - payments will be handled manually');
    }
  }

  async createPaymentSession(options: PaymentSessionOptions): Promise<{
    success: boolean;
    sessionId?: string;
    url?: string;
    fallback?: boolean;
  }> {
    // Check circuit breaker
    if (!apiMonitor.isServiceAvailable('stripe')) {
      return this.createManualPaymentFallback(options);
    }

    if (!this.stripeConfigured || !this.stripe) {
      return this.createManualPaymentFallback(options);
    }

    try {
      const session = await retryWithBackoff(
        async () => {
          if (!this.stripe) throw new Error('Stripe not initialized');

          return await this.stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
              {
                price_data: {
                  currency: options.currency,
                  product_data: {
                    name: options.description,
                  },
                  unit_amount: options.amount,
                },
                quantity: 1,
              },
            ],
            mode: 'payment',
            success_url: options.successUrl,
            cancel_url: options.cancelUrl,
            customer_email: options.customerEmail,
            metadata: options.metadata || {},
          });
        },
        'stripe',
        3,
        2000
      );

      logger.info('Payment session created successfully', {
        sessionId: session.id,
        amount: options.amount,
        customerEmail: options.customerEmail
      });

      return {
        success: true,
        sessionId: session.id,
        url: session.url || undefined
      };
    } catch (error: any) {
      logger.error('Failed to create payment session', {
        error: error.message,
        amount: options.amount
      });

      return this.createManualPaymentFallback(options);
    }
  }

  private async createManualPaymentFallback(options: PaymentSessionOptions): Promise<{
    success: boolean;
    fallback: boolean;
  }> {
    // Create manual payment record
    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();

      const manualPayment = await prisma.manualPayment.create({
        data: {
          amount: options.amount,
          currency: options.currency,
          customerEmail: options.customerEmail,
          description: options.description,
          status: 'pending',
          metadata: options.metadata || {},
          createdAt: new Date()
        }
      });

      await prisma.$disconnect();

      logger.warn('Manual payment record created', {
        paymentId: manualPayment.id,
        amount: options.amount,
        customerEmail: options.customerEmail
      });

      // Send email notification to admin
      const emailService = EmailService.getInstance();
      await emailService.sendEmail({
        to: process.env.ADMIN_EMAIL || 'admin@kiiltoloisto.fi',
        subject: 'Manual Payment Required',
        html: `
          <h2>Manual Payment Processing Required</h2>
          <p>Payment system is unavailable. Please process manually:</p>
          <ul>
            <li>Customer: ${options.customerEmail}</li>
            <li>Amount: ${options.amount / 100} ${options.currency.toUpperCase()}</li>
            <li>Description: ${options.description}</li>
            <li>Payment ID: ${manualPayment.id}</li>
          </ul>
        `
      });

      return {
        success: true,
        fallback: true
      };
    } catch (error: any) {
      logger.error('Failed to create manual payment fallback', error);
      throw error;
    }
  }

  async verifyWebhook(payload: string | Buffer, signature: string): Promise<any> {
    if (!this.stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
      throw new Error('Stripe webhook not configured');
    }

    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );

      return event;
    } catch (error: any) {
      logger.error('Webhook verification failed', error);
      throw error;
    }
  }
}

// Export singleton instances
export const emailService = EmailService.getInstance();
export const smsService = SMSService.getInstance();
export const paymentService = PaymentService.getInstance();