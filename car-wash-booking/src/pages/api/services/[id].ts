import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { z } from 'zod';

const updateServiceSchema = z.object({
  titleFi: z.string().min(2).optional(),
  titleEn: z.string().min(2).optional(),
  descriptionFi: z.string().min(10).optional(),
  descriptionEn: z.string().min(10).optional(),
  priceCents: z.number().min(0).optional(),
  durationMinutes: z.number().min(15).optional(),
  capacity: z.number().min(1).optional(),
  image: z.string().url().optional(),
  isActive: z.boolean().optional(),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid service ID' });
  }

  const serviceId = parseInt(id);

  if (isNaN(serviceId)) {
    return res.status(400).json({ error: 'Invalid service ID' });
  }

  if (req.method === 'GET') {
    try {
      const service = await prisma.service.findUnique({
        where: { id: serviceId },
      });

      if (!service) {
        return res.status(404).json({ error: 'Service not found' });
      }

      res.status(200).json({
        success: true,
        service,
      });
    } catch (error: any) {
      console.error('Get service error:', error);
      res.status(500).json({
        error: 'Failed to get service',
        message: error.message,
      });
    }
  } else if (req.method === 'PATCH') {
    const session = await getServerSession(req, res, authOptions);

    if (!session || (session.user as any)?.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    try {
      const validatedData = updateServiceSchema.parse(req.body);

      const service = await prisma.service.update({
        where: { id: serviceId },
        data: validatedData,
      });

      res.status(200).json({
        success: true,
        service,
      });
    } catch (error: any) {
      console.error('Update service error:', error);

      if (error.name === 'ZodError') {
        return res.status(400).json({
          error: 'Invalid input data',
          details: error.errors,
        });
      }

      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Service not found' });
      }

      res.status(500).json({
        error: 'Failed to update service',
        message: error.message,
      });
    }
  } else if (req.method === 'DELETE') {
    const session = await getServerSession(req, res, authOptions);

    if (!session || (session.user as any)?.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    try {
      const hasBookings = await prisma.booking.findFirst({
        where: { serviceId },
      });

      if (hasBookings) {
        await prisma.service.update({
          where: { id: serviceId },
          data: { isActive: false },
        });

        return res.status(200).json({
          success: true,
          message: 'Service deactivated (has existing bookings)',
        });
      }

      await prisma.service.delete({
        where: { id: serviceId },
      });

      res.status(200).json({
        success: true,
        message: 'Service deleted successfully',
      });
    } catch (error: any) {
      console.error('Delete service error:', error);

      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Service not found' });
      }

      res.status(500).json({
        error: 'Failed to delete service',
        message: error.message,
      });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}