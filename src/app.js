const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const resumeRoutes = require('./routes/resumeRoutes');
const errorHandler = require('./middleware/errorHandler');
const requestIdMiddleware = require('./middleware/requestId');
const logger = require('./config/logger');

const app = express();

// Request ID middleware (should be first)
app.use(requestIdMiddleware);

// Custom Morgan logging with Winston
app.use(morgan('combined', {
  stream: {
    write: (message) => {
      logger.api(message.trim());
    }
  }
}));

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting with logging
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  handler: (req, res) => {
    logger.security('Rate limit exceeded', {
      requestId: req.requestId,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.status(429).json({
      error: 'Too many requests',
      message: 'Please try again later',
      requestId: req.requestId
    });
  }
});
app.use('/api/', limiter);

// Routes
app.use('/api/resume', resumeRoutes);

// Health check with logging
app.get('/api/health', (req, res) => {
  const healthData = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    requestId: req.requestId
  };
  
  logger.api('Health check requested', {
    requestId: req.requestId,
    ...healthData
  });
  
  res.json(healthData);
});

// 404 handler
app.use('*', (req, res) => {
  logger.warn('404 - Route not found', {
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip
  });
  
  res.status(404).json({
    error: 'Route not found',
    requestId: req.requestId
  });
});

// Error handling
app.use(errorHandler);

// Log startup
logger.info('Application initialized', {
  nodeEnv: process.env.NODE_ENV,
  version: require('../package.json').version
});

module.exports = app;