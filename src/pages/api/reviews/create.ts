import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma-simple';
import { z } from 'zod';

const createReviewSchema = z.object({
  bookingId: z.number().optional(),
  confirmationCode: z.string().optional(),
  customerName: z.string().min(2).max(100),
  customerEmail: z.string().email(),
  rating: z.number().min(1).max(5),
  title: z.string().min(3).max(200),
  content: z.string().min(10).max(1000),
  serviceRating: z.number().min(1).max(5).optional(),
  staffRating: z.number().min(1).max(5).optional(),
  facilityRating: z.number().min(1).max(5).optional(),
  recommendToFriend: z.boolean().optional(),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const validatedData = createReviewSchema.parse(req.body);

    // Check if booking exists (if provided)
    let booking = null;
    if (validatedData.bookingId) {
      booking = await prisma.booking.findUnique({
        where: { id: validatedData.bookingId },
        include: { service: true },
      });
    } else if (validatedData.confirmationCode) {
      booking = await prisma.booking.findUnique({
        where: { confirmationCode: validatedData.confirmationCode },
        include: { service: true },
      });
    }

    // Create review
    const review = await prisma.testimonial.create({
      data: {
        name: validatedData.customerName,
        contentFi: validatedData.content,
        contentEn: validatedData.content, // For now, use same content
        rating: validatedData.rating,
        approved: false, // Requires admin approval
        // Additional fields for enhanced reviews
        title: validatedData.title,
        customerEmail: validatedData.customerEmail,
        serviceRating: validatedData.serviceRating,
        staffRating: validatedData.staffRating,
        facilityRating: validatedData.facilityRating,
        recommendToFriend: validatedData.recommendToFriend,
        bookingId: booking?.id,
        serviceId: booking?.serviceId,
      },
    });

    // If customer exists, update their review count
    if (validatedData.customerEmail) {
      try {
        await prisma.customer.updateMany({
          where: { email: validatedData.customerEmail },
          data: {
            // Could add review count or last review date
            notes: `Jätti arvostelun: ${validatedData.rating}/5 tähteä`,
          },
        });
      } catch (error) {
        console.log('Could not update customer review info:', error);
      }
    }

    // Send notification to admin about new review
    console.log(`📝 New review submitted by ${validatedData.customerName}: ${validatedData.rating}/5 stars`);

    res.status(201).json({
      success: true,
      message: 'Arvostelu lähetetty onnistuneesti! Se näkyy sivustolla hyväksynnän jälkeen.',
      data: {
        reviewId: review.id,
        status: 'pending_approval',
      },
    });

  } catch (error: any) {
    console.error('Review creation error:', error);

    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Invalid review data',
        details: error.errors,
      });
    }

    res.status(500).json({
      error: 'Failed to submit review',
      message: error.message,
    });
  }
}