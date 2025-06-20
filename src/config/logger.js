const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');

// Custom format for structured logging
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const logEntry = {
      timestamp,
      level,
      message,
      pid: process.pid,
      instanceId: process.env.INSTANCE_ID || 'main',
      ...meta
    };
    
    if (stack) {
      logEntry.stack = stack;
    }
    
    return JSON.stringify(logEntry);
  })
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let logMessage = `${timestamp} [${level}]: ${message}`;
    
    if (Object.keys(meta).length > 0) {
      logMessage += ` ${JSON.stringify(meta)}`;
    }
    
    if (stack) {
      logMessage += `\n${stack}`;
    }
    
    return logMessage;
  })
);

// Daily rotate file transport for all logs
const allLogsTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'all-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d', // Keep logs for 30 days
  format: logFormat,
  level: 'info'
});

// Daily rotate file transport for error logs
const errorLogsTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d',
  format: logFormat,
  level: 'error'
});

// Daily rotate file transport for analysis logs
const analysisLogsTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'analysis-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d',
  format: logFormat,
  level: 'info'
});

// Daily rotate file transport for performance logs
const performanceLogsTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'performance-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d',
  format: logFormat,
  level: 'info'
});

// Create the main logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    allLogsTransport,
    errorLogsTransport
  ],
  exitOnError: false
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    level: 'debug'
  }));
}

// Create specialized loggers
const analysisLogger = winston.createLogger({
  level: 'info',
  format: logFormat,
  transports: [analysisLogsTransport],
  exitOnError: false
});

const performanceLogger = winston.createLogger({
  level: 'info',
  format: logFormat,
  transports: [performanceLogsTransport],
  exitOnError: false
});

// Event handlers for log rotation
allLogsTransport.on('rotate', (oldFilename, newFilename) => {
  logger.info('Log rotation completed', { 
    oldFilename, 
    newFilename,
    type: 'all_logs'
  });
});

errorLogsTransport.on('rotate', (oldFilename, newFilename) => {
  logger.info('Error log rotation completed', {
    oldFilename,
    newFilename,
    type: 'error_logs'
  });
});

analysisLogsTransport.on('rotate', (oldFilename, newFilename) => {
  logger.info('Analysis log rotation completed', {
    oldFilename,
    newFilename,
    type: 'analysis_logs'
  });
});

// Custom logging methods
const customLogger = {
  // Standard logging methods
  error: (message, meta = {}) => logger.error(message, meta),
  warn: (message, meta = {}) => logger.warn(message, meta),
  info: (message, meta = {}) => logger.info(message, meta),
  debug: (message, meta = {}) => logger.debug(message, meta),
  
  // Specialized logging methods
  analysis: (message, meta = {}) => {
    const logData = { ...meta, category: 'analysis' };
    logger.info(message, logData);
    analysisLogger.info(message, logData);
  },
  
  performance: (message, meta = {}) => {
    const logData = { ...meta, category: 'performance' };
    logger.info(message, logData);
    performanceLogger.info(message, logData);
  },
  
  security: (message, meta = {}) => {
    const logData = { ...meta, category: 'security' };
    logger.warn(message, logData);
  },
  
  api: (message, meta = {}) => {
    const logData = { ...meta, category: 'api' };
    logger.info(message, logData);
  },
  
  // Request logging with timing
  request: (req, res, next) => {
    const startTime = Date.now();
    const requestId = meta.requestId || require('uuid').v4().substr(0, 8);
    
    // Add request ID to request object
    req.requestId = requestId;
    
    logger.info('Incoming request', {
      requestId,
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      category: 'request'
    });
    
    // Override res.end to log response
    const originalEnd = res.end;
    res.end = function(...args) {
      const duration = Date.now() - startTime;
      
      logger.info('Request completed', {
        requestId,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration,
        category: 'response'
      });
      
      // Log performance metrics
      performanceLogger.info('Request performance', {
        requestId,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration,
        memoryUsage: process.memoryUsage(),
        category: 'performance'
      });
      
      originalEnd.apply(this, args);
    };
    
    next();
  }
};

// Graceful shutdown handler
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, performing graceful shutdown');
  logger.end();
  analysisLogger.end();
  performanceLogger.end();
});

process.on('SIGINT', () => {
  logger.info('Received SIGINT, performing graceful shutdown');
  logger.end();
  analysisLogger.end();
  performanceLogger.end();
});

module.exports = customLogger;