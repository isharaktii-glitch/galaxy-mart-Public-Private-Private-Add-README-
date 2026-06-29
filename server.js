const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
  origin: '*', // Allow all origins (change in production)
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Log all requests
app.use((req, res, next) => {
  console.log(`📝 ${req.method} ${req.url}`);
  next();
});

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'frontend')));

// API Routes
const routes = {
  auth: './routes/auth',
  admin: './routes/admin',
  seller: './routes/seller',
  customer: './routes/customer',
  products: './routes/products',
  orders: './routes/orders',
  auction: './routes/auction',
  ads: './routes/ads'
};

Object.entries(routes).forEach(([name, routePath]) => {
  try {
    const route = require(routePath);
    app.use(`/api/${name}`, route);
    console.log(`✅ Route /api/${name} loaded`);
  } catch (err) {
    console.error(`❌ Failed to load route /api/${name}:`, err.message);
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
});

// Test database connection endpoint
app.get('/api/db-test', async (req, res) => {
  try {
    const db = require('./db');
    const result = await db.query('SELECT NOW() as now');
    res.json({ success: true, time: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Serve index.html for all other routes (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Global error:', err.message);
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    error: err.message || 'Internal server error',
    path: req.path
  });
});

// Export for Vercel
module.exports = app;

// Start server if not in Vercel environment
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Galaxy Mart Server running on port ${PORT}`);
    console.log(`🔗 http://localhost:${PORT}`);
  });
}
