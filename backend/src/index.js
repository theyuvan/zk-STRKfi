const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const logger = require('./utils/logger');

// Import routes - Using ON-CHAIN routes (no in-memory cache)
const loanRoutes = require('./routes/loanRoutes_onchain'); // ✅ On-chain blockchain queries
const proofRoutes = require('./routes/proofRoutes');
const identityRoutes = require('./routes/identityRoutes');
const payrollRoutes = require('./routes/payrollRoutes');

// Create Express app
const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/loan', loanRoutes);
app.use('/api/proof', proofRoutes);
app.use('/api/identity', identityRoutes);
app.use('/api/payroll', payrollRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path
  });
  
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

module.exports = app;
