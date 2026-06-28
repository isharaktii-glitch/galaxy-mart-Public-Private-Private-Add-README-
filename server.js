const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check - මුලින්ම test කරන්න
app.get('/', (req, res) => {
  res.json({ 
    message: 'Galaxy Mart API Running ✅',
    timestamp: new Date().toISOString(),
    db: process.env.DATABASE_URL ? 'configured' : 'missing'
  });
});

// Routes
try {
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/admin', require('./routes/admin'));
  app.use('/api/seller', require('./routes/seller'));
  app.use('/api/customer', require('./routes/customer'));
  app.use('/api/products', require('./routes/products'));
  app.use('/api/orders', require('./routes/orders'));
} catch(err) {
  console.error('Route loading error:', err.message);
}

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.path });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: err.message });
});

module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
