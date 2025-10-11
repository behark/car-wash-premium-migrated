#!/usr/bin/env node

/**
 * MCP Server for Car Wash Booking System
 *
 * This MCP server provides Claude with tools to interact with the car wash booking system,
 * including retrieving services, checking availability, and managing bookings.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Simulated database data (in a real implementation, this would connect to Prisma)
const mockServices = [
  {
    id: 1,
    titleFi: 'Peruspesu',
    descriptionFi: 'Ulko- ja sisäpuhdistus',
    priceCents: 1500,
    durationMinutes: 45,
  },
  {
    id: 2,
    titleFi: 'Erikoispesu',
    descriptionFi: 'Pesu ja vahauksen kanssa',
    priceCents: 2500,
    durationMinutes: 75,
  },
  {
    id: 3,
    titleFi: 'Luksuspesu',
    descriptionFi: 'Täydellinen yksityiskohtainen pesu',
    priceCents: 5000,
    durationMinutes: 120,
  },
];

const mockBookings = [
  {
    id: 1,
    serviceId: 1,
    customerName: 'Matti Virtanen',
    date: '2024-12-15',
    time: '10:00',
    status: 'confirmed',
  },
  {
    id: 2,
    serviceId: 2,
    customerName: 'Liisa Korhonen',
    date: '2024-12-15',
    time: '14:00',
    status: 'pending',
  },
];

const server = new Server(
  {
    name: 'car-wash-booking-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_services',
        description: 'Retrieve all available car wash services with pricing and duration',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_service_by_id',
        description: 'Get specific service details by ID',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'number',
              description: 'Service ID',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'check_availability',
        description: 'Check available time slots for a specific date',
        inputSchema: {
          type: 'object',
          properties: {
            date: {
              type: 'string',
              description: 'Date in YYYY-MM-DD format',
            },
            serviceId: {
              type: 'number',
              description: 'Service ID to check availability for',
            },
          },
          required: ['date'],
        },
      },
      {
        name: 'get_bookings',
        description: 'Retrieve all bookings, optionally filtered by date or status',
        inputSchema: {
          type: 'object',
          properties: {
            date: {
              type: 'string',
              description: 'Optional date filter (YYYY-MM-DD)',
            },
            status: {
              type: 'string',
              description: 'Optional status filter (confirmed, pending, cancelled)',
              enum: ['confirmed', 'pending', 'cancelled'],
            },
          },
        },
      },
      {
        name: 'create_booking',
        description: 'Create a new booking (simulation)',
        inputSchema: {
          type: 'object',
          properties: {
            serviceId: {
              type: 'number',
              description: 'Service ID',
            },
            customerName: {
              type: 'string',
              description: 'Customer name',
            },
            customerEmail: {
              type: 'string',
              description: 'Customer email',
            },
            date: {
              type: 'string',
              description: 'Booking date (YYYY-MM-DD)',
            },
            time: {
              type: 'string',
              description: 'Booking time (HH:MM)',
            },
          },
          required: ['serviceId', 'customerName', 'customerEmail', 'date', 'time'],
        },
      },
    ],
  };
});

// List available resources
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'car-wash://services',
        mimeType: 'application/json',
        name: 'Car Wash Services',
        description: 'Complete list of available car wash services',
      },
      {
        uri: 'car-wash://bookings',
        mimeType: 'application/json',
        name: 'Current Bookings',
        description: 'All current bookings in the system',
      },
      {
        uri: 'car-wash://stats',
        mimeType: 'application/json',
        name: 'Booking Statistics',
        description: 'System statistics and metrics',
      },
    ],
  };
});

// Read resources
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  switch (uri) {
    case 'car-wash://services':
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(mockServices, null, 2),
          },
        ],
      };

    case 'car-wash://bookings':
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(mockBookings, null, 2),
          },
        ],
      };

    case 'car-wash://stats':
      const stats = {
        totalServices: mockServices.length,
        totalBookings: mockBookings.length,
        confirmedBookings: mockBookings.filter(b => b.status === 'confirmed').length,
        pendingBookings: mockBookings.filter(b => b.status === 'pending').length,
        averageServicePrice: Math.round(mockServices.reduce((sum, s) => sum + s.priceCents, 0) / mockServices.length),
        totalRevenue: mockBookings
          .filter(b => b.status === 'confirmed')
          .reduce((sum, b) => {
            const service = mockServices.find(s => s.id === b.serviceId);
            return sum + (service?.priceCents || 0);
          }, 0),
      };
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(stats, null, 2),
          },
        ],
      };

    default:
      throw new Error(`Unknown resource: ${uri}`);
  }
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'get_services':
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockServices, null, 2),
          },
        ],
      };

    case 'get_service_by_id':
      const { id } = args as { id: number };
      const service = mockServices.find(s => s.id === id);
      if (!service) {
        throw new Error(`Service with ID ${id} not found`);
      }
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(service, null, 2),
          },
        ],
      };

    case 'check_availability':
      const { date, serviceId } = args as { date: string; serviceId?: number };
      // Simulate availability check
      const bookedTimes = mockBookings
        .filter(b => b.date === date && (!serviceId || b.serviceId === serviceId))
        .map(b => b.time);

      const allTimeSlots = [
        '08:00', '09:00', '10:00', '11:00', '12:00',
        '13:00', '14:00', '15:00', '16:00', '17:00'
      ];

      const availableSlots = allTimeSlots.filter(time => !bookedTimes.includes(time));

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              date,
              serviceId,
              availableSlots,
              bookedSlots: bookedTimes,
            }, null, 2),
          },
        ],
      };

    case 'get_bookings':
      const { date: filterDate, status } = args as { date?: string; status?: string };
      let filteredBookings = mockBookings;

      if (filterDate) {
        filteredBookings = filteredBookings.filter(b => b.date === filterDate);
      }

      if (status) {
        filteredBookings = filteredBookings.filter(b => b.status === status);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(filteredBookings, null, 2),
          },
        ],
      };

    case 'create_booking':
      const bookingData = args as {
        serviceId: number;
        customerName: string;
        customerEmail: string;
        date: string;
        time: string;
      };

      // Simulate booking creation
      const newBooking = {
        id: mockBookings.length + 1,
        ...bookingData,
        status: 'pending' as const,
        createdAt: new Date().toISOString(),
      };

      // In a real implementation, this would save to the database
      mockBookings.push(newBooking);

      return {
        content: [
          {
            type: 'text',
            text: `Booking created successfully!\n\n${JSON.stringify(newBooking, null, 2)}`,
          },
        ],
      };

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Car Wash Booking MCP Server running on stdio');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Server error:', error);
    process.exit(1);
  });
}

export { server };