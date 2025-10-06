import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '../../../lib/prisma-simple';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check authentication
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get all customers with their booking data
    const customers = await prisma.customer.findMany({
      orderBy: [
        { totalSpent: 'desc' },
        { loyaltyPoints: 'desc' },
      ],
      include: {
        _count: {
          select: {
            bookings: true,
          },
        },
      },
    });

    // Format customer data
    const formattedCustomers = customers.map(customer => ({
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      loyaltyPoints: customer.loyaltyPoints,
      totalSpent: customer.totalSpent,
      visitCount: customer.visitCount,
      loyaltyTier: customer.loyaltyTier,
      lastVisit: customer.lastVisit?.toISOString(),
      joinDate: customer.joinDate.toISOString(),
      notes: customer.notes,
      bookingCount: customer._count.bookings,
    }));

    // Calculate summary statistics
    const summary = {
      totalCustomers: customers.length,
      loyaltyDistribution: {
        BRONZE: customers.filter(c => c.loyaltyTier === 'BRONZE').length,
        SILVER: customers.filter(c => c.loyaltyTier === 'SILVER').length,
        GOLD: customers.filter(c => c.loyaltyTier === 'GOLD').length,
        PLATINUM: customers.filter(c => c.loyaltyTier === 'PLATINUM').length,
      },
      totalLoyaltyPoints: customers.reduce((sum, c) => sum + c.loyaltyPoints, 0),
      totalCustomerValue: customers.reduce((sum, c) => sum + c.totalSpent, 0),
      averageCustomerValue: customers.length > 0
        ? Math.round(customers.reduce((sum, c) => sum + c.totalSpent, 0) / customers.length)
        : 0,
      repeatCustomers: customers.filter(c => c.visitCount >= 2).length,
      retentionRate: customers.length > 0
        ? Math.round((customers.filter(c => c.visitCount >= 2).length / customers.length) * 100)
        : 0,
    };

    res.status(200).json({
      success: true,
      customers: formattedCustomers,
      summary,
    });

  } catch (error: any) {
    console.error('Customers endpoint error:', error);
    res.status(500).json({
      error: 'Failed to fetch customers',
      message: error.message,
    });
  }
}