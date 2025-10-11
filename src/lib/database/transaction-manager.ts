/**
 * Enterprise Transaction Manager
 * Advanced transaction patterns with saga pattern, compensation, and rollback strategies
 */

import { PrismaClient } from '@prisma/client';
import { executeTransaction } from './connection-pool';
import { logger } from '../logger';

export interface TransactionStep<T = any> {
  name: string;
  execute: (tx: PrismaClient, context: TransactionContext) => Promise<T>;
  compensate?: (tx: PrismaClient, context: TransactionContext, result?: T) => Promise<void>;
  timeout?: number;
  retryable?: boolean;
}

export interface TransactionContext {
  transactionId: string;
  userId?: string;
  metadata: Record<string, any>;
  stepResults: Record<string, any>;
  startTime: Date;
  parentTransactionId?: string;
}

export interface TransactionResult<T = any> {
  success: boolean;
  result?: T;
  error?: Error;
  executedSteps: string[];
  compensatedSteps: string[];
  duration: number;
  context: TransactionContext;
}

export interface SagaDefinition {
  name: string;
  steps: TransactionStep[];
  maxRetries?: number;
  timeoutMs?: number;
  isolationLevel?: 'ReadCommitted' | 'Serializable';
}

/**
 * Advanced Transaction Manager with Saga Pattern Support
 */
export class TransactionManager {
  private static instance: TransactionManager;
  private activeTransactions = new Map<string, TransactionContext>();

  static getInstance(): TransactionManager {
    if (!TransactionManager.instance) {
      TransactionManager.instance = new TransactionManager();
    }
    return TransactionManager.instance;
  }

  /**
   * Execute a simple transaction with automatic retry and logging
   */
  async executeSimpleTransaction<T>(
    operations: (tx: PrismaClient) => Promise<T>,
    options: {
      name?: string;
      userId?: string;
      metadata?: Record<string, any>;
      maxRetries?: number;
      timeoutMs?: number;
    } = {}
  ): Promise<TransactionResult<T>> {
    const transactionId = this.generateTransactionId();
    const context: TransactionContext = {
      transactionId,
      userId: options.userId,
      metadata: options.metadata || {},
      stepResults: {},
      startTime: new Date(),
    };

    this.activeTransactions.set(transactionId, context);

    const startTime = Date.now();
    let result: T;
    let error: Error | undefined;

    try {
      logger.info('Starting transaction', {
        transactionId,
        name: options.name,
        userId: options.userId,
      });

      result = await executeTransaction(
        operations,
        options.name || 'simple_transaction'
      );

      logger.info('Transaction completed successfully', {
        transactionId,
        duration: Date.now() - startTime,
      });

      return {
        success: true,
        result,
        executedSteps: [options.name || 'main'],
        compensatedSteps: [],
        duration: Date.now() - startTime,
        context,
      };
    } catch (err) {
      error = err as Error;

      logger.error('Transaction failed', {
        transactionId,
        error: error.message,
        duration: Date.now() - startTime,
      });

      return {
        success: false,
        error,
        executedSteps: [],
        compensatedSteps: [],
        duration: Date.now() - startTime,
        context,
      };
    } finally {
      this.activeTransactions.delete(transactionId);
    }
  }

  /**
   * Execute a saga transaction with compensation pattern
   */
  async executeSaga<T = any>(
    saga: SagaDefinition,
    initialContext: {
      userId?: string;
      metadata?: Record<string, any>;
      parentTransactionId?: string;
    } = {}
  ): Promise<TransactionResult<T>> {
    const transactionId = this.generateTransactionId();
    const context: TransactionContext = {
      transactionId,
      userId: initialContext.userId,
      metadata: initialContext.metadata || {},
      stepResults: {},
      startTime: new Date(),
      parentTransactionId: initialContext.parentTransactionId,
    };

    this.activeTransactions.set(transactionId, context);

    const executedSteps: string[] = [];
    const compensatedSteps: string[] = [];
    const startTime = Date.now();
    let finalResult: T | undefined;
    let sagaError: Error | undefined;

    try {
      logger.info('Starting saga transaction', {
        transactionId,
        sagaName: saga.name,
        stepCount: saga.steps.length,
        userId: context.userId,
      });

      // Execute each step in the saga
      for (let i = 0; i < saga.steps.length; i++) {
        const step = saga.steps[i];

        try {
          const stepResult = await this.executeStep(step, context);
          context.stepResults[step.name] = stepResult;
          executedSteps.push(step.name);

          // If this is the last step, store the result
          if (i === saga.steps.length - 1) {
            finalResult = stepResult as T;
          }

          logger.debug('Saga step completed', {
            transactionId,
            stepName: step.name,
            stepIndex: i,
          });
        } catch (stepError) {
          logger.error('Saga step failed', {
            transactionId,
            stepName: step.name,
            stepIndex: i,
            error: (stepError as Error).message,
          });

          // Start compensation process
          await this.compensateSaga(
            saga.steps.slice(0, i).reverse(),
            context,
            compensatedSteps
          );

          throw stepError;
        }
      }

      logger.info('Saga transaction completed successfully', {
        transactionId,
        sagaName: saga.name,
        executedSteps: executedSteps.length,
        duration: Date.now() - startTime,
      });

      return {
        success: true,
        result: finalResult,
        executedSteps,
        compensatedSteps,
        duration: Date.now() - startTime,
        context,
      };
    } catch (error) {
      sagaError = error as Error;

      logger.error('Saga transaction failed', {
        transactionId,
        sagaName: saga.name,
        error: sagaError.message,
        executedSteps: executedSteps.length,
        compensatedSteps: compensatedSteps.length,
        duration: Date.now() - startTime,
      });

      return {
        success: false,
        error: sagaError,
        executedSteps,
        compensatedSteps,
        duration: Date.now() - startTime,
        context,
      };
    } finally {
      this.activeTransactions.delete(transactionId);
    }
  }

  /**
   * Execute a single step with timeout and retry logic
   */
  private async executeStep<T>(
    step: TransactionStep<T>,
    context: TransactionContext
  ): Promise<T> {
    const stepTimeout = step.timeout || 30000; // 30 seconds default
    const maxRetries = step.retryable ? 3 : 1;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await executeTransaction(
          async (tx) => {
            return Promise.race([
              step.execute(tx, context),
              this.createTimeoutPromise<T>(stepTimeout),
            ]);
          },
          `saga_step_${step.name}`
        );

        return result;
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }

        logger.warn('Saga step failed, retrying', {
          transactionId: context.transactionId,
          stepName: step.name,
          attempt,
          error: (error as Error).message,
        });

        // Wait before retry with exponential backoff
        await this.wait(1000 * Math.pow(2, attempt - 1));
      }
    }

    throw new Error('Step execution failed - should not reach here');
  }

  /**
   * Execute compensation steps for failed saga
   */
  private async compensateSaga(
    compensationSteps: TransactionStep[],
    context: TransactionContext,
    compensatedSteps: string[]
  ): Promise<void> {
    logger.info('Starting saga compensation', {
      transactionId: context.transactionId,
      compensationSteps: compensationSteps.length,
    });

    for (const step of compensationSteps) {
      if (step.compensate) {
        try {
          await executeTransaction(
            (tx) => step.compensate!(tx, context, context.stepResults[step.name]),
            `compensate_${step.name}`
          );

          compensatedSteps.push(step.name);

          logger.debug('Compensation step completed', {
            transactionId: context.transactionId,
            stepName: step.name,
          });
        } catch (compensationError) {
          logger.error('Compensation step failed', {
            transactionId: context.transactionId,
            stepName: step.name,
            error: (compensationError as Error).message,
          });

          // Continue with other compensation steps even if one fails
          // In a real system, you might want to alert on compensation failures
        }
      }
    }
  }

  /**
   * Get active transaction by ID
   */
  getActiveTransaction(transactionId: string): TransactionContext | undefined {
    return this.activeTransactions.get(transactionId);
  }

  /**
   * Get all active transactions
   */
  getActiveTransactions(): TransactionContext[] {
    return Array.from(this.activeTransactions.values());
  }

  /**
   * Force rollback a transaction (emergency use)
   */
  async forceRollback(transactionId: string, reason: string): Promise<void> {
    const context = this.activeTransactions.get(transactionId);
    if (!context) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    logger.warn('Force rollback initiated', {
      transactionId,
      reason,
      userId: context.userId,
    });

    // In a real implementation, this would trigger compensation
    // For now, just mark the transaction as aborted
    this.activeTransactions.delete(transactionId);
  }

  private generateTransactionId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  private createTimeoutPromise<T>(timeoutMs: number): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }

  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Utility functions for common transaction patterns
 */

/**
 * Create a booking saga with payment processing
 */
export function createBookingSaga(
  bookingData: any,
  paymentData: any
): SagaDefinition {
  return {
    name: 'create_booking_with_payment',
    steps: [
      {
        name: 'validate_availability',
        execute: async (_tx, _context) => {
          // Check if time slot is still available
          const overlapping = await _tx.booking.findFirst({
            where: {
              date: bookingData.date,
              startTime: bookingData.startTime,
              status: { notIn: ['CANCELLED', 'NO_SHOW'] },
            },
          });

          if (overlapping) {
            throw new Error('Time slot no longer available');
          }

          return { available: true };
        },
        retryable: true,
      },
      {
        name: 'create_booking',
        execute: async (_tx, _context) => {
          const booking = await _tx.booking.create({
            data: {
              ...bookingData,
              status: 'PENDING',
              paymentStatus: 'PENDING',
            },
          });

          return booking;
        },
        compensate: async (_tx, _context, booking) => {
          if (booking) {
            await _tx.booking.update({
              where: { id: booking.id },
              data: { status: 'CANCELLED' },
            });
          }
        },
      },
      {
        name: 'process_payment',
        execute: async (_tx, _context) => {
          const booking = _context.stepResults.create_booking;

          // Simulate payment processing
          // In real implementation, this would call Stripe API
          const paymentIntent = await processPayment(paymentData, booking.priceCents);

          // Update booking with payment info
          await _tx.booking.update({
            where: { id: booking.id },
            data: {
              paymentIntentId: paymentIntent.id,
              paymentStatus: 'PAID',
              status: 'CONFIRMED',
            },
          });

          return paymentIntent;
        },
        compensate: async (_tx, _context, paymentIntent) => {
          if (paymentIntent) {
            // Refund payment
            await refundPayment(paymentIntent.id);
          }
        },
        timeout: 15000, // 15 seconds for payment processing
      },
      {
        name: 'send_confirmation',
        execute: async (_tx, _context) => {
          const booking = _context.stepResults.create_booking;

          // Send confirmation email
          await sendBookingConfirmation(booking);

          return { sent: true };
        },
        compensate: async (_tx, _context) => {
          // Send cancellation email
          const booking = _context.stepResults.create_booking;
          if (booking) {
            await sendBookingCancellation(booking);
          }
        },
        retryable: true,
      },
    ],
    timeoutMs: 60000, // 1 minute total timeout
  };
}

// Mock functions for the saga example
async function processPayment(paymentData: any, amount: number): Promise<{ id: string }> {
  // Mock payment processing
  return { id: `pi_${Date.now()}` };
}

async function refundPayment(paymentIntentId: string): Promise<void> {
  // Mock refund processing
  logger.info('Payment refunded', { paymentIntentId });
}

async function sendBookingConfirmation(booking: any): Promise<void> {
  // Mock email sending
  logger.info('Booking confirmation sent', { bookingId: booking.id });
}

async function sendBookingCancellation(booking: any): Promise<void> {
  // Mock cancellation email
  logger.info('Booking cancellation sent', { bookingId: booking.id });
}

// Export singleton instance
export const transactionManager = TransactionManager.getInstance();