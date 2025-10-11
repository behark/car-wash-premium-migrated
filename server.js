/**
 * Custom Server for Production Deployment with Socket.IO
 * Integrates WebSocket support for real-time booking features
 */

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Initialize Socket.IO for real-time features
  let io = null;
  try {
    // Use dynamic import for ES modules in production
    const socketModule = process.env.NODE_ENV === 'production'
      ? require('./src/lib/websocket-server.js')  // Compiled JS file
      : require('./src/lib/websocket-server.ts'); // TS file in dev

    const { initializeWebSocketServer } = socketModule;
    io = initializeWebSocketServer(server);
    console.log('✅ Socket.IO initialized for real-time features');
  } catch (error) {
    console.log('⚠️  Socket.IO not available, real-time features disabled');
    console.log('Error:', error.message);
    // Continue without WebSocket - app will still work
  }

  // Graceful shutdown handling
  const gracefulShutdown = () => {
    console.log('Received shutdown signal, starting graceful shutdown...');

    server.close(() => {
      console.log('HTTP server closed');

      if (io) {
        io.close(() => {
          console.log('Socket.IO server closed');
        });
      }

      // Close database connections
      if (global.prisma) {
        global.prisma.$disconnect().then(() => {
          console.log('Database connection closed');
          process.exit(0);
        }).catch((error) => {
          console.error('Error closing database connection:', error);
          process.exit(1);
        });
      } else {
        process.exit(0);
      }
    });

    // Force close after 10 seconds
    setTimeout(() => {
      console.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  };

  // Handle shutdown signals
  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    gracefulShutdown();
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown();
  });

  server
    .once('error', (err) => {
      console.error('Server error:', err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`
🚀 Car Wash Booking System Ready!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 Local:    http://${hostname}:${port}
🌐 Network:  http://0.0.0.0:${port}
🔄 Mode:     ${dev ? 'Development' : 'Production'}
💾 Database: ${process.env.DATABASE_URL ? '✅ Connected' : '❌ Not configured'}
🔄 Redis:    ${process.env.REDIS_URL ? '✅ Connected' : '❌ Not configured'}
🔌 WebSocket: ${io ? '✅ Active' : '❌ Disabled'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      `);

      // Log environment info
      if (process.env.NODE_ENV === 'production') {
        console.log('🔒 Production Environment Variables:');
        console.log(`   • NEXTAUTH_URL: ${process.env.NEXTAUTH_URL ? '✅ Set' : '❌ Missing'}`);
        console.log(`   • STRIPE_SECRET_KEY: ${process.env.STRIPE_SECRET_KEY ? '✅ Set' : '❌ Missing'}`);
        console.log(`   • SENDGRID_API_KEY: ${process.env.SENDGRID_API_KEY ? '✅ Set' : '❌ Missing'}`);
        console.log(`   • SENTRY_DSN: ${process.env.SENTRY_DSN ? '✅ Set' : '❌ Missing'}`);
      }

      // Health check endpoint status
      console.log(`🏥 Health Check: http://${hostname}:${port}/api/health`);
    });
});

// Export for testing purposes
module.exports = { app };