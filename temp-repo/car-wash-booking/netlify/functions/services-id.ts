/**
 * Service Details Endpoint
 * GET /api/services-id?id={serviceId}
 *
 * Retrieves details of a specific service by ID
 */

import { z } from 'zod';
import { withPrisma, withRetry } from './lib/prisma';
import { createGetHandler } from './lib/request-handler';
import { CommonErrors } from './lib/error-handler';

/**
 * Query parameter schema for service retrieval
 */
const ServiceIdQuerySchema = z.object({
  id: z.string()
    .transform(val => parseInt(val, 10))
    .refine(val => !isNaN(val) && val > 0, 'Invalid service ID'),
});

/**
 * Main handler for service details
 */
export const handler = createGetHandler<z.infer<typeof ServiceIdQuerySchema>>(
  {
    validation: {
      query: ServiceIdQuerySchema,
    },
  },
  async ({ query }) => {
    const serviceId = query!.id;

    // Fetch service using proper connection management
    const service = await withRetry(async () =>
      withPrisma(async (prisma) => {
        return await prisma.service.findUnique({
          where: { id: serviceId },
        });
      })
    );

    if (!service) {
      throw CommonErrors.notFound('Service');
    }

    // Format service for response
    return {
      id: service.id,
      titleFi: service.titleFi,
      titleEn: service.titleEn,
      descriptionFi: service.descriptionFi,
      descriptionEn: service.descriptionEn,
      durationMinutes: service.durationMinutes,
      priceCents: service.priceCents,
      price: (service.priceCents / 100).toFixed(2),
      // vehicleType: service.vehicleType, // This field doesn't exist in the Service model
      isActive: service.isActive,
      createdAt: service.createdAt.toISOString(),
      updatedAt: service.updatedAt.toISOString(),
    };
  }
);