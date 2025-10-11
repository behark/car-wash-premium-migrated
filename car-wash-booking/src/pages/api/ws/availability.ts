/**
 * WebSocket API Route for Next.js
 * Handles WebSocket upgrade and availability server initialization
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { Server as HTTPServer } from 'http';
import { Socket as NetSocket } from 'net';
import { availabilityServer } from '../../../lib/websocket/availability-server';

interface SocketServer extends HTTPServer {
  io?: any;
}

interface SocketWithIO extends NetSocket {
  server: SocketServer;
}

interface NextApiResponseWithSocket extends NextApiResponse {
  socket: SocketWithIO;
}

export default function handler(req: NextApiRequest, res: NextApiResponseWithSocket) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check if WebSocket server is already initialized
  if (res.socket.server.io) {
    console.log('WebSocket server already running');
    res.end();
    return;
  }

  console.log('Initializing WebSocket server...');

  try {
    // Initialize the availability server
    availabilityServer.initialize(res.socket.server);
    res.socket.server.io = true; // Mark as initialized

    console.log('WebSocket server initialized successfully');

    // Return server stats
    res.status(200).json({
      message: 'WebSocket server initialized',
      stats: availabilityServer.getStats(),
      path: '/api/ws/availability',
    });
  } catch (error) {
    console.error('Error initializing WebSocket server:', error);
    res.status(500).json({
      error: 'Failed to initialize WebSocket server',
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

// Enable WebSocket upgrade
export const config = {
  api: {
    bodyParser: false,
  },
};