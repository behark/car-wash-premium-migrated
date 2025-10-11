import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '../../../lib/prisma-simple';
import { BookingStatus } from '@prisma/client';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

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

    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const weekStart = startOfWeek(now);
    const weekEnd = endOfWeek(now);
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    // Get dashboard statistics
    const [
      todayBookings,
      weekBookings,
      monthBookings,
      pendingBookings,
      recentBookings
    ] = await Promise.all([
      // Today's bookings count
      prisma.booking.count({
        where: {
          date: {
            gte: todayStart,
            lte: todayEnd,
          },
        },
      }),

      // This week's bookings count
      prisma.booking.count({
        where: {
          date: {
            gte: weekStart,
            lte: weekEnd,
          },
        },
      }),

      // This month's revenue calculation
      prisma.booking.aggregate({
        where: {
          date: {
            gte: monthStart,
            lte: monthEnd,
          },
          status: {
            in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED],
          },
        },
        _sum: {
          priceCents: true,
        },
      }),

      // Pending bookings count
      prisma.booking.count({
        where: {
          status: BookingStatus.PENDING,
        },
      }),

      // Recent bookings (last 10)
      prisma.booking.findMany({
        take: 10,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          service: true,
        },
      }),
    ]);

    const monthRevenue = Math.round((monthBookings._sum.priceCents || 0) / 100);

    const stats = {
      todayBookings,
      weekBookings,
      monthRevenue,
      pendingBookings,
    };

    const formattedRecentBookings = recentBookings.map(booking => ({
      id: booking.id,
      confirmationCode: booking.confirmationCode,
      customerName: booking.customerName,
      customerEmail: booking.customerEmail,
      customerPhone: booking.customerPhone,
      date: booking.date.toISOString(),
      startTime: booking.startTime,
      endTime: booking.endTime,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      service: {
        titleFi: booking.service.titleFi,
        priceCents: booking.service.priceCents,
      },
    }));

    res.status(200).json({
      success: true,
      stats,
      recentBookings: formattedRecentBookings,
    });

  } catch (error: any) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      error: 'Failed to fetch dashboard statistics',
      message: error.message,
    });
  }
}