require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Use PostgreSQL only - no more SQLite fallback
const { initializeDatabase } = require('./database-postgres');

const { errorHandler, asyncHandler } = require('./utils/errorHandler');
const { validateContentType, rateLimit } = require('./utils/validation');

const app = express();

// Middleware
const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:8080,https://myapp.vercel.app').split(',').map(o => o.trim());
console.log('CORS Origins configured:', corsOrigins);
app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security & Validation Middleware
app.use(validateContentType);
app.use(rateLimit(60000, 100)); // 100 requests per minute per IP

// Routes
const authRoutes = require('./routes/auth');
const superadminRoutes = require('./routes/superadmin');
const restaurantRoutes = require('./routes/restaurant');
const publicRoutes = require('./routes/public');
const paytmRoutes = require('./routes/paytm-production-fix');
const simplePaytmRoutes = require('./routes/simple-paytm');
const workingPaymentRoutes = require('./routes/working-payment');
const paytmWorkingRoutes = require('./routes/paytm-working');
const paytmFixedRoutes = require('./routes/paytm-fixed');
const paytmDebugRoutes = require('./routes/paytm-debug');
const webhookRoutes = require('./routes/webhooks');
const featuresRoutes = require('./routes/features');

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'DineFlow Backend is running', version: '1.0.0' });
});

// Mount routes
app.use('/auth', authRoutes);
app.use('/admin/superadmin', superadminRoutes);
app.use('/admin/restaurant', restaurantRoutes);
app.use('/admin/restaurant', featuresRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/paytm', paytmRoutes);
app.use('/api/simple-paytm', simplePaytmRoutes);
app.use('/api/working-payment', workingPaymentRoutes);
app.use('/api/paytm-working', paytmWorkingRoutes);
app.use('/api/paytm-fixed', paytmFixedRoutes);
app.use('/api/paytm-debug', paytmDebugRoutes);
app.use('/api/webhooks', webhookRoutes);

// Error handling middleware (must be last)
app.use(errorHandler);

// 404 handler (before error handler)
app.use((req, res) => {
  res.status(404).json({ 
    error: {
      message: 'Not found',
      statusCode: 404
    }
  });
});

// Initialize database and start server
const PORT = process.env.PORT || 3000;
const { closeDatabase } = require('./database-postgres');
const http = require('http');
const { Server } = require('socket.io');

async function start() {
  try {
    console.log(`Starting DineFlow Backend on port ${PORT}...`);
    await initializeDatabase();
    console.log('Database initialized successfully');

    // Create HTTP server
    const server = http.createServer(app);

    // Initialize Socket.io
    const io = new Server(server, {
      cors: {
        origin: corsOrigins,
        methods: ['GET', 'POST'],
        credentials: true
      }
    });

    // Socket.io connection handling
    io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      // Join tenant room
      socket.on('join-tenant', (tenantId) => {
        socket.join(`tenant-${tenantId}`);
        console.log(`Socket ${socket.id} joined tenant-${tenantId}`);
      });

      // Join kitchen room
      socket.on('join-kitchen', (tenantId) => {
        socket.join(`kitchen-${tenantId}`);
        console.log(`Socket ${socket.id} joined kitchen-${tenantId}`);
      });

      // Join table room
      socket.on('join-table', (tableId) => {
        socket.join(`table-${tableId}`);
        console.log(`Socket ${socket.id} joined table-${tableId}`);
      });

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });

    // Make io available to routes
    app.set('io', io);

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`\n✅ SERVER LISTENING on 0.0.0.0:${PORT}`);
      console.log(`🚀 DineFlow Backend running on port ${PORT}`);
      console.log(`🔌 Socket.io enabled for real-time updates`);
      console.log('\nAvailable routes:');
      console.log('  Authentication: POST /auth/login, POST /auth/init-superadmin, GET /auth/me');
      console.log('  Superadmin: GET /admin/superadmin/tenants, POST /admin/superadmin/tenants, etc.');
      console.log('  Restaurant: GET /admin/restaurant/:tenantId/tables, /menu, /orders, /payment-config, etc.');
      console.log('  Public: GET /api/public/menu/:restaurantSlug/:tableIdentifier, POST /api/public/order, POST /api/public/payment/create-order, etc.');
      console.log('  Paytm: POST /api/paytm/create-order, POST /api/paytm/callback, GET /api/paytm/status/:orderId');
      console.log('\n');
    });

    server.on('error', (err) => {
      console.error('Server error:', err);
      process.exit(1);
    });

    // Graceful shutdown handler
    const gracefulShutdown = async (signal) => {
      console.log(`\n${signal} signal received: closing HTTP server`);
      server.close(async () => {
        console.log('HTTP server closed');
        try {
          await closeDatabase();
          console.log('Database connection closed');
          process.exit(0);
        } catch (err) {
          console.error('Error closing database:', err);
          process.exit(1);
        }
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Global error handlers
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

start().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});