import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { z } from 'zod';

const createServiceSchema = z.object({
  titleFi: z.string().min(2),
  titleEn: z.string().min(2),
  descriptionFi: z.string().min(10),
  descriptionEn: z.string().min(10),
  priceCents: z.number().min(0),
  durationMinutes: z.number().min(15),
  capacity: z.number().min(1).default(1),
  image: z.string().url().optional(),
  isActive: z.boolean().default(true),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'GET') {
    try {
      const { active } = req.query;

      const services = await prisma.service.findMany({
        where: active === 'true' ? { isActive: true } : undefined,
        orderBy: { priceCents: 'asc' },
      });

      res.status(200).json({
        success: true,
        services,
      });
    } catch (error: any) {
      console.error('Get services error:', error);
      res.status(500).json({
        error: 'Failed to get services',
        message: error.message,
      });
    }
  } else if (req.method === 'POST') {
    const session = await getServerSession(req, res, authOptions);

    if (!session || (session.user as any)?.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    try {
      const validatedData = createServiceSchema.parse(req.body);

      const service = await prisma.service.create({
        data: validatedData,
      });

      res.status(201).json({
        success: true,
        service,
      });
    } catch (error: any) {
      console.error('Create service error:', error);

      if (error.name === 'ZodError') {
        return res.status(400).json({
          error: 'Invalid input data',
          details: error.errors,
        });
      }

      res.status(500).json({
        error: 'Failed to create service',
        message: error.message,
      });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}