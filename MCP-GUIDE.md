# Car Wash Booking System - MCP Server Guide

## 🚀 What is MCP (Model Context Protocol)?

MCP (Model Context Protocol) is a standardized way for AI assistants like Claude to interact with external systems and data sources. It allows Claude to:

- **Access live data** from your applications
- **Execute actions** in your systems
- **Provide real-time insights** based on current state
- **Integrate seamlessly** with your existing workflows

## 🏗️ What We've Built

We've created a **Car Wash Booking MCP Server** that provides Claude with direct access to your car wash booking system. This means Claude can now:

### 🔧 Available Tools

1. **`get_services`** - Retrieve all available car wash services
2. **`get_service_by_id`** - Get specific service details
3. **`check_availability`** - Check available time slots for booking
4. **`get_bookings`** - View all bookings with optional filters
5. **`create_booking`** - Create new bookings (simulation)

### 📊 Available Resources

1. **`car-wash://services`** - Complete service catalog
2. **`car-wash://bookings`** - Current booking data
3. **`car-wash://stats`** - System statistics and metrics

## 🛠️ Installation & Setup

### Step 1: Install MCP SDK Dependencies

```bash
# Navigate to your project directory
cd "/home/behar/Desktop/New Folder (2)"

# Install MCP SDK
npm install @modelcontextprotocol/sdk

# Install development dependencies
npm install --save-dev @types/node typescript ts-node
```

### Step 2: Build the MCP Server

```bash
# Compile the TypeScript MCP server
npx tsc mcp-server.ts --outDir dist --target es2020 --module esnext --moduleResolution node

# Make it executable
chmod +x dist/mcp-server.js
```

### Step 3: Test the MCP Server

```bash
# Test the server directly
node dist/mcp-server.js
```

## 🎯 Usage Examples

### Example 1: Getting All Services

**Claude can now run:**
```javascript
// Claude will call: get_services
// Returns: All available car wash services with pricing
```

**Result:**
```json
[
  {
    "id": 1,
    "titleFi": "Peruspesu",
    "descriptionFi": "Ulko- ja sisäpuhdistus",
    "priceCents": 1500,
    "durationMinutes": 45
  },
  {
    "id": 2,
    "titleFi": "Erikoispesu",
    "descriptionFi": "Pesu ja vahauksen kanssa",
    "priceCents": 2500,
    "durationMinutes": 75
  }
]
```

### Example 2: Checking Availability

**Claude can run:**
```javascript
// Claude will call: check_availability
// Parameters: { "date": "2024-12-15", "serviceId": 1 }
```

**Result:**
```json
{
  "date": "2024-12-15",
  "serviceId": 1,
  "availableSlots": ["08:00", "09:00", "11:00", "12:00", "13:00", "15:00", "16:00", "17:00"],
  "bookedSlots": ["10:00", "14:00"]
}
```

### Example 3: Creating a Booking

**Claude can run:**
```javascript
// Claude will call: create_booking
// Parameters: {
//   "serviceId": 1,
//   "customerName": "Matti Virtanen",
//   "customerEmail": "matti@example.com",
//   "date": "2024-12-16",
//   "time": "10:00"
// }
```

## 🌟 Benefits of This MCP Implementation

### For Customers
- **Natural language booking**: "Book me a basic wash next Tuesday at 2 PM"
- **Real-time availability**: Instant checking of open time slots
- **Service information**: Get detailed pricing and duration info

### For Business Owners
- **Automated booking management**: Claude can handle booking inquiries
- **Real-time analytics**: Get instant insights into bookings and revenue
- **Customer service**: 24/7 availability for booking questions

### For Developers
- **Extensible architecture**: Easy to add new tools and resources
- **Type-safe**: Full TypeScript support with proper schemas
- **Standardized protocol**: Uses official MCP standards

## 🔧 Technical Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     Claude      │◄──►│   MCP Server    │◄──►│  Car Wash DB    │
│   (AI Client)   │    │ (mcp-server.ts) │    │   (Prisma)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Key Components

1. **MCP Server** (`mcp-server.ts`): The bridge between Claude and your system
2. **Tools**: Specific actions Claude can perform
3. **Resources**: Data sources Claude can read from
4. **Transport**: Communication layer (stdio, HTTP, etc.)

## 🚀 Advanced Features

### Real-time Integration

To connect this to your actual Prisma database, update the mock data sections:

```typescript
// Replace mock data with actual Prisma queries
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// In get_services tool:
const services = await prisma.service.findMany();
```

### Authentication & Security

Add authentication to your MCP server:

```typescript
// Add API key validation
const API_KEY = process.env.MCP_API_KEY;

// Validate requests
if (request.headers?.authorization !== `Bearer ${API_KEY}`) {
  throw new Error('Unauthorized');
}
```

### WebSocket Support

For real-time updates, extend the server to support WebSocket transport:

```typescript
import { WebSocketServerTransport } from '@modelcontextprotocol/sdk/server/websocket.js';

const transport = new WebSocketServerTransport({
  port: 8080
});
```

## 🎨 Integration with Claude Code Templates

This MCP server integrates perfectly with the Claude Code Templates ecosystem:

1. **Analytics Dashboard**: Track MCP usage and performance
2. **Agent Integration**: Combine with specialized agents for enhanced functionality
3. **Studio Interface**: Visual management of MCP servers
4. **Deployment Tools**: Easy deployment to cloud platforms

## 📈 Next Steps

### 1. Connect to Real Database
Replace mock data with actual Prisma database queries

### 2. Add Authentication
Implement proper API key or OAuth authentication

### 3. Error Handling
Add comprehensive error handling and logging

### 4. Rate Limiting
Implement rate limiting for production use

### 5. Monitoring
Add monitoring and alerting for MCP server health

### 6. Extended Tools
Add more tools for:
- Payment processing
- Customer management
- Service management
- Reporting and analytics

## 🔍 Debugging & Troubleshooting

### Common Issues

1. **Server won't start**: Check Node.js version and dependencies
2. **Tools not available**: Verify tool schema definitions
3. **Resource access fails**: Check resource URI patterns
4. **Type errors**: Ensure proper TypeScript compilation

### Debug Mode

```bash
# Run with debug logging
DEBUG=mcp:* node dist/mcp-server.js
```

### Testing Tools

```bash
# Test individual tools
echo '{"method":"tools/call","params":{"name":"get_services","arguments":{}}}' | node dist/mcp-server.js
```

## 🎯 Conclusion

This MCP server implementation provides a powerful foundation for integrating your car wash booking system with Claude. It demonstrates the full potential of the Model Context Protocol for creating intelligent, context-aware AI assistants that can interact directly with your business systems.

The modular design makes it easy to extend and customize for your specific needs, while the standardized MCP protocol ensures compatibility with the broader ecosystem of AI tools and services.

**You now have a direct bridge between Claude and your car wash booking system! 🚀**