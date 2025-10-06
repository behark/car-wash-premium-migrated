import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '../../../lib/prisma-simple';
import { BookingStatus } from '@prisma/client';
import {
  startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  startOfYear, endOfYear, subMonths, subWeeks, format, subDays
} from 'date-fns';

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
    const { timeRange = '30days' } = req.query;

    // Calculate date ranges
    const ranges = {
      today: { start: startOfDay(now), end: endOfDay(now) },
      week: { start: startOfWeek(now), end: endOfWeek(now) },
      month: { start: startOfMonth(now), end: endOfMonth(now) },
      year: { start: startOfYear(now), end: endOfYear(now) },
      '30days': { start: subDays(now, 30), end: now },
      '90days': { start: subDays(now, 90), end: now },
    };

    const range = ranges[timeRange as keyof typeof ranges] || ranges['30days'];

    // Revenue analytics
    const [
      totalRevenue,
      confirmedRevenue,
      bookingCounts,
      servicePopularity,
      customerRetention,
      vehicleTypeStats,
      loyaltyDistribution,
      timeSlotPopularity,
      dailyTrends
    ] = await Promise.all([
      // Total revenue (all bookings)
      prisma.booking.aggregate({
        where: {
          date: { gte: range.start, lte: range.end },
        },
        _sum: { priceCents: true },
        _count: true,
        _avg: { priceCents: true },
      }),

      // Confirmed revenue only
      prisma.booking.aggregate({
        where: {
          date: { gte: range.start, lte: range.end },
          status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
        },
        _sum: { priceCents: true },
        _count: true,
      }),

      // Booking status distribution
      prisma.booking.groupBy({
        by: ['status'],
        where: {
          date: { gte: range.start, lte: range.end },
        },
        _count: true,
      }),

      // Service popularity
      prisma.booking.groupBy({
        by: ['serviceId'],
        where: {
          date: { gte: range.start, lte: range.end },
        },
        _count: true,
        _sum: { priceCents: true },
        orderBy: { _count: { serviceId: 'desc' } },
        take: 10,
      }),

      // Customer retention (repeat customers)
      prisma.customer.aggregate({
        where: {
          visitCount: { gte: 2 },
        },
        _count: true,
        _avg: { visitCount: true, totalSpent: true },
      }),

      // Vehicle type distribution
      prisma.booking.groupBy({
        by: ['vehicleType'],
        where: {
          date: { gte: range.start, lte: range.end },
        },
        _count: true,
        _avg: { priceCents: true },
      }),

      // Loyalty tier distribution
      prisma.customer.groupBy({
        by: ['loyaltyTier'],
        _count: true,
        _avg: { loyaltyPoints: true, totalSpent: true },
      }),

      // Time slot popularity
      prisma.booking.groupBy({
        by: ['startTime'],
        where: {
          date: { gte: range.start, lte: range.end },
        },
        _count: true,
      }),

      // Daily booking trends (last 30 days)
      Promise.all(
        Array.from({ length: 30 }, (_, i) => {
          const date = subDays(now, i);
          const dayStart = startOfDay(date);
          const dayEnd = endOfDay(date);

          return prisma.booking.aggregate({
            where: {
              date: { gte: dayStart, lte: dayEnd },
            },
            _count: true,
            _sum: { priceCents: true },
          }).then(result => ({
            date: format(date, 'yyyy-MM-dd'),
            bookings: result._count,
            revenue: result._sum.priceCents || 0,
          }));
        })
      ),
    ]);

    // Get service details for popularity analysis
    const services = await prisma.service.findMany();
    const serviceMap = services.reduce((acc, service) => {
      acc[service.id] = service;
      return acc;
    }, {} as Record<number, any>);

    // Format service popularity with names
    const formattedServicePopularity = servicePopularity.map(item => ({
      serviceId: item.serviceId,
      serviceName: serviceMap[item.serviceId]?.titleFi || 'Unknown Service',
      bookings: item._count,
      revenue: item._sum.priceCents || 0,
      averagePrice: item._sum.priceCents ? Math.round((item._sum.priceCents / item._count) / 100) : 0,
    }));

    // Calculate conversion rate
    const totalBookings = bookingCounts.reduce((sum, item) => sum + item._count, 0);
    const completedBookings = bookingCounts.find(item => item.status === 'COMPLETED')?._count || 0;
    const conversionRate = totalBookings > 0 ? (completedBookings / totalBookings) * 100 : 0;

    // Customer metrics
    const totalCustomers = await prisma.customer.count();
    const newCustomersThisMonth = await prisma.customer.count({
      where: {
        joinDate: { gte: startOfMonth(now), lte: endOfMonth(now) },
      },
    });

    const analytics = {
      timeRange: timeRange,
      dateRange: {
        start: range.start.toISOString(),
        end: range.end.toISOString(),
      },
      revenue: {
        total: Math.round((totalRevenue._sum.priceCents || 0) / 100),
        confirmed: Math.round((confirmedRevenue._sum.priceCents || 0) / 100),
        average: Math.round((totalRevenue._avg.priceCents || 0) / 100),
        growth: 0, // TODO: Calculate vs previous period
      },
      bookings: {
        total: totalRevenue._count,
        confirmed: confirmedRevenue._count,
        conversionRate: Math.round(conversionRate * 100) / 100,
        statusDistribution: bookingCounts.map(item => ({
          status: item.status,
          count: item._count,
          percentage: Math.round((item._count / totalBookings) * 100),
        })),
      },
      customers: {
        total: totalCustomers,
        newThisMonth: newCustomersThisMonth,
        averageVisits: Math.round((customerRetention._avg.visitCount || 0) * 100) / 100,
        averageSpent: Math.round((customerRetention._avg.totalSpent || 0) / 100),
        repeatCustomers: customerRetention._count,
        retentionRate: totalCustomers > 0 ? Math.round((customerRetention._count / totalCustomers) * 100) : 0,
      },
      services: {
        popularity: formattedServicePopularity,
        totalServices: services.length,
      },
      vehicles: {
        distribution: vehicleTypeStats.map(item => ({
          type: item.vehicleType,
          count: item._count,
          averagePrice: Math.round((item._avg.priceCents || 0) / 100),
          percentage: Math.round((item._count / totalBookings) * 100),
        })),
      },
      loyalty: {
        distribution: loyaltyDistribution.map(item => ({
          tier: item.loyaltyTier,
          customers: item._count,
          averagePoints: Math.round(item._avg.loyaltyPoints || 0),
          averageSpent: Math.round((item._avg.totalSpent || 0) / 100),
        })),
      },
      trends: {
        dailyBookings: dailyTrends.reverse(), // Show oldest to newest
        popularTimeSlots: timeSlotPopularity
          .sort((a, b) => b._count - a._count)
          .slice(0, 10)
          .map(item => ({
            time: item.startTime,
            bookings: item._count,
          })),
      },
    };

    res.status(200).json({
      success: true,
      analytics,
    });

  } catch (error: any) {
    console.error('Analytics endpoint error:', error);
    res.status(500).json({
      error: 'Failed to fetch analytics',
      message: error.message,
    });
  }
}