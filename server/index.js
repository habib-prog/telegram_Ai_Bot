require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const connectDB = require('./db');

const webhookRoutes = require('./routes/webhook');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 5001;

// Connect to MongoDB
connectDB();

// Global Middlewares
app.use(cors());
app.use(morgan('dev'));

// Note: SSLCommerz IPN sends application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Mount Routes
app.use('/', webhookRoutes);
app.use('/api', apiRoutes);

// Optional: Serve static build of admin panel in production if exists
const adminBuildPath = path.join(__dirname, '../admin-panel/dist');
app.use('/admin', express.static(adminBuildPath));
app.use('/assets', express.static(path.join(adminBuildPath, 'assets')));
app.get(['/admin', '/admin/*'], (req, res) => {
  res.sendFile(path.join(adminBuildPath, 'index.html'), (err) => {
    if (err) {
      res.status(404).send('Admin dashboard not built yet. Run npm run build inside /admin-panel.');
    }
  });
});

// Centralized error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`🚀 [Express Server] Listening on port ${PORT}`);
  console.log(`📡 [Payment Webhook] Ready at ${process.env.APP_BASE_URL || `http://localhost:${PORT}`}/webhook/payment-ipn`);
});

module.exports = app;
