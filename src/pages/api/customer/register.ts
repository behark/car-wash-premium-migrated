/**
 * Customer Registration API
 */

import { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { prisma } from '../../../lib/database/config';
import { logger } from '../../../lib/logger';

const registerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Validate request body
    const validatedData = registerSchema.parse(req.body);
    const { name, email, phone, password } = validatedData;

    // Check if customer already exists
    const existingCustomer = await prisma.customer.findUnique({
      where: { email },
    });

    if (existingCustomer) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create customer record
    const customer = await prisma.customer.create({
      data: {
        name,
        email,
        phone: phone || null,
        loyaltyPoints: 0,
        totalSpent: 0,
        visitCount: 0,
        loyaltyTier: 'BRONZE',
        joinDate: new Date(),
        isActive: true,
      },
    });

    // Create user record for authentication
    await prisma.user.create({
      data: {
        name,
        email,
        role: 'CUSTOMER',
        passwordHash,
      },
    });

    logger.info('New customer registered', {
      customerId: customer.id,
      email: customer.email,
      name: customer.name,
    });

    // Return success (don't include sensitive data)
    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        loyaltyTier: customer.loyaltyTier,
        joinDate: customer.joinDate,
      },
    });
  } catch (error) {
    logger.error('Customer registration error:', {
      error: error instanceof Error ? error.message : String(error),
      body: req.body,
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    res.status(500).json({ error: 'Internal server error' });
  }
}