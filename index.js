require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initializeDatabase } = require('./database');

const app = express();

// Middleware
const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:8080').split(',').map(o => o.trim());
console.log('CORS Origins configured:', corsOrigins);
app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
const authRoutes = require('./routes/auth');
const superadminRoutes = require('./routes/superadmin');
const restaurantRoutes = require('./routes/restaurant');
const publicRoutes = require('./routes/public');

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'DineFlow Backend is running', version: '1.0.0' });
});

// Mount routes
app.use('/auth', authRoutes);
app.use('/admin/superadmin', superadminRoutes);
app.use('/admin/restaurant', restaurantRoutes);
app.use('/api/public', publicRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Initialize database and start server
const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await initializeDatabase();
    console.log('Database initialized');

    app.listen(PORT, () => {
      console.log(`\n🚀 DineFlow Backend running on http://localhost:${PORT}`);
      console.log('\nAvailable routes:');
      console.log('  Authentication: POST /auth/login, POST /auth/init-superadmin, GET /auth/me');
      console.log('  Superadmin: GET /admin/superadmin/tenants, POST /admin/superadmin/tenants, etc.');
      console.log('  Restaurant: GET /admin/restaurant/:tenantId/tables, /menu, /orders, /payment-config, etc.');
      console.log('  Public: GET /api/public/menu/:restaurantSlug/:tableIdentifier, POST /api/public/order, POST /api/public/payment/create-order, etc.');
      console.log('\n');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();