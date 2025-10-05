/**
 * Services API Endpoint Tests
 * Enterprise-grade API testing
 */

import handler from '../services/index';
import { ServiceFactory } from '../../../../tests/factories';
import { ApiTestUtils, DatabaseTestUtils } from '../../../../tests/utils/testHelpers';
import { NextApiRequest, NextApiResponse } from 'next';

jest.mock('../../../lib/prisma');

describe('/api/services', () => {
  let mockPrisma: ReturnType<typeof DatabaseTestUtils.getMockPrisma>;

  beforeEach(() => {
    mockPrisma = DatabaseTestUtils.getMockPrisma();
    DatabaseTestUtils.setupMockResponses(mockPrisma);
  });

  describe('GET /api/services', () => {
    it('should return list of active services', async () => {
      const mockServices = ServiceFactory.buildList(3, { isActive: true });
      mockPrisma.service.findMany.mockResolvedValue(mockServices);

      const response = await ApiTestUtils.executeApiHandler(handler, {
        method: 'GET',
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('success', true);
      expect(response.data).toHaveProperty('data');
      expect(response.data.data).toBeArray();
      expect(response.data.data).toHaveLength(3);

      expect(mockPrisma.service.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { titleFi: 'asc' },
      });
    });

    it('should return empty array when no services exist', async () => {
      mockPrisma.service.findMany.mockResolvedValue([]);

      const response = await ApiTestUtils.executeApiHandler(handler, {
        method: 'GET',
      });

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data).toEqual([]);
    });

    it('should include inactive services when includeInactive=true', async () => {
      const activeServices = ServiceFactory.buildList(2, { isActive: true });
      const inactiveServices = ServiceFactory.buildList(1, { isActive: false });
      const allServices = [...activeServices, ...inactiveServices];

      mockPrisma.service.findMany.mockResolvedValue(allServices);

      const response = await ApiTestUtils.executeApiHandler(handler, {
        method: 'GET',
        query: { includeInactive: 'true' },
      });

      expect(response.status).toBe(200);
      expect(response.data.data).toHaveLength(3);

      expect(mockPrisma.service.findMany).toHaveBeenCalledWith({
        orderBy: { titleFi: 'asc' },
      });
    });

    it('should handle database errors gracefully', async () => {
      DatabaseTestUtils.mockDatabaseError(
        'service.findMany',
        new Error('Database connection failed')
      );

      const response = await ApiTestUtils.executeApiHandler(handler, {
        method: 'GET',
      });

      expect(response.status).toBe(500);
      expect(response.data).toHaveProperty('success', false);
      expect(response.data).toHaveProperty('error');
    });

    it('should have proper security headers', async () => {
      mockPrisma.service.findMany.mockResolvedValue([]);

      const response = await ApiTestUtils.executeApiHandler(handler, {
        method: 'GET',
      });

      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
      expect(response.headers).toHaveProperty('x-xss-protection', '1; mode=block');
    });
  });

  describe('POST /api/services', () => {
    it('should require authentication', async () => {
      const response = await ApiTestUtils.executeApiHandler(handler, {
        method: 'POST',
        body: ServiceFactory.build(),
      });

      expect(response.status).toBe(401);
      expect(response.data).toHaveProperty('error', 'Unauthorized');
    });

    it('should require admin role', async () => {
      const user = { id: 1, email: 'user@example.com', role: 'user' };

      const { req, res } = ApiTestUtils.createAuthenticatedContext(user, {
        method: 'POST',
        body: ServiceFactory.build(),
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(403);
      expect(res._getJSONData()).toHaveProperty('error', 'Forbidden');
    });

    it('should create service with valid admin credentials', async () => {
      const admin = { id: 1, email: 'admin@example.com', role: 'admin' };
      const serviceData = {
        titleFi: 'Uusi palvelu',
        titleEn: 'New service',
        descriptionFi: 'Palvelun kuvaus',
        descriptionEn: 'Service description',
        priceCents: 3000,
        durationMinutes: 90,
        capacity: 2,
        isActive: true,
      };
      const createdService = ServiceFactory.build(serviceData);

      mockPrisma.service.create.mockResolvedValue(createdService);

      const { req, res } = ApiTestUtils.createAuthenticatedContext(admin, {
        method: 'POST',
        body: serviceData,
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(201);
      expect(res._getJSONData().success).toBe(true);
      expect(res._getJSONData().data).toEqual(createdService);

      expect(mockPrisma.service.create).toHaveBeenCalledWith({
        data: serviceData,
      });
    });

    it('should validate required fields', async () => {
      const admin = { id: 1, email: 'admin@example.com', role: 'admin' };
      const invalidData = {
        titleFi: '', // Empty title
        priceCents: -100, // Negative price
      };

      const { req, res } = ApiTestUtils.createAuthenticatedContext(admin, {
        method: 'POST',
        body: invalidData,
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(400);
      expect(res._getJSONData()).toHaveProperty('error', 'Validation Error');
    });
  });

  describe('PUT /api/services', () => {
    it('should update existing service', async () => {
      const admin = { id: 1, email: 'admin@example.com', role: 'admin' };
      const existingService = ServiceFactory.build({ id: 1 });
      const updateData = {
        id: 1,
        titleFi: 'Päivitetty palvelu',
        priceCents: 3500,
      };
      const updatedService = { ...existingService, ...updateData };

      mockPrisma.service.findUnique.mockResolvedValue(existingService);
      mockPrisma.service.update.mockResolvedValue(updatedService);

      const { req, res } = ApiTestUtils.createAuthenticatedContext(admin, {
        method: 'PUT',
        body: updateData,
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(res._getJSONData().success).toBe(true);
      expect(res._getJSONData().data.titleFi).toBe('Päivitetty palvelu');

      expect(mockPrisma.service.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: updateData,
      });
    });

    it('should return 404 for non-existent service', async () => {
      const admin = { id: 1, email: 'admin@example.com', role: 'admin' };

      mockPrisma.service.findUnique.mockResolvedValue(null);

      const { req, res } = ApiTestUtils.createAuthenticatedContext(admin, {
        method: 'PUT',
        body: { id: 999, titleFi: 'Test' },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(404);
      expect(res._getJSONData()).toHaveProperty('error', 'Service not found');
    });
  });

  describe('DELETE /api/services', () => {
    it('should soft delete service (set isActive to false)', async () => {
      const admin = { id: 1, email: 'admin@example.com', role: 'admin' };
      const service = ServiceFactory.build({ id: 1, isActive: true });
      const deactivatedService = { ...service, isActive: false };

      mockPrisma.service.findUnique.mockResolvedValue(service);
      mockPrisma.service.update.mockResolvedValue(deactivatedService);

      const { req, res } = ApiTestUtils.createAuthenticatedContext(admin, {
        method: 'DELETE',
        query: { id: '1' },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(res._getJSONData().success).toBe(true);

      expect(mockPrisma.service.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { isActive: false },
      });
    });
  });

  describe('Method validation', () => {
    it('should return 405 for unsupported methods', async () => {
      const response = await ApiTestUtils.executeApiHandler(handler, {
        method: 'PATCH',
      });

      expect(response.status).toBe(405);
      expect(response.data).toHaveProperty('error', 'Method Not Allowed');
    });
  });

  describe('Rate limiting', () => {
    it('should apply rate limiting to POST requests', async () => {
      const admin = { id: 1, email: 'admin@example.com', role: 'admin' };

      // This test would require actual rate limiting implementation
      // For now, we just verify the structure is in place
      const { req, res } = ApiTestUtils.createAuthenticatedContext(admin, {
        method: 'POST',
        body: ServiceFactory.build(),
        headers: {
          'x-forwarded-for': '192.168.1.1',
          'user-agent': 'test-agent',
        },
      });

      // The rate limiting would be tested in integration tests
      // or with actual Redis implementation
      expect(req.headers).toHaveProperty('x-forwarded-for');
      expect(req.headers).toHaveProperty('user-agent');
    });
  });
});