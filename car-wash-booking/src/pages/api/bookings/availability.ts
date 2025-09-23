import type { NextApiRequest, NextApiResponse } from 'next';
import { checkAvailability } from '../../../lib/booking';
import { z } from 'zod';

const availabilitySchema = z.object({
  date: z.string().transform(str => new Date(str)),
  serviceId: z.number(),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { date, serviceId } = availabilitySchema.parse(req.query);

    const timeSlots = await checkAvailability(date, Number(serviceId));

    res.status(200).json({
      success: true,
      date: date.toISOString(),
      serviceId,
      timeSlots,
    });
  } catch (error: any) {
    console.error('Availability check error:', error);

    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Invalid input data',
        details: error.errors,
      });
    }

    if (error.message === 'Service not found') {
      return res.status(404).json({ error: 'Service not found' });
    }

    res.status(500).json({
      error: 'Failed to check availability',
      message: error.message,
    });
  }
}