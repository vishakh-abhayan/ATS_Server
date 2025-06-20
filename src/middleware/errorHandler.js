const logger = require('../config/logger');

const errorHandler = (err, req, res, next) => {
  // Log the error with context
  logger.error('Request error occurred', {
    requestId: req.requestId,
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    body: req.body,
    params: req.params,
    query: req.query
  });

  // Azure OpenAI specific errors
  if (err.code === 'ResourceNotFound') {
    logger.error('Azure OpenAI configuration error', {
      requestId: req.requestId,
      error: err.message,
      code: err.code
    });
    
    return res.status(500).json({
      error: 'AI service configuration error',
      message: 'Please check Azure OpenAI deployment settings',
      requestId: req.requestId
    });
  }

  if (err.code === 'InvalidRequest') {
    logger.warn('Invalid request to AI service', {
      requestId: req.requestId,
      error: err.message,
      code: err.code
    });
    
    return res.status(400).json({
      error: 'Invalid request to AI service',
      message: err.message,
      requestId: req.requestId
    });
  }

  // Rate limiting
  if (err.code === 'RateLimitExceeded') {
    logger.warn('Rate limit exceeded', {
      requestId: req.requestId,
      retryAfter: err.retryAfter || 60
    });
    
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Please try again in a few moments',
      retryAfter: err.retryAfter || 60,
      requestId: req.requestId
    });
  }

  // File handling errors
  if (err.name === 'MulterError') {
    logger.warn('File upload error', {
      requestId: req.requestId,
      error: err.message,
      code: err.code
    });
    
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        message: 'Maximum file size is 5MB',
        requestId: req.requestId
      });
    }
    return res.status(400).json({
      error: 'File upload error',
      message: err.message,
      requestId: req.requestId
    });
  }

  // Document parsing errors
  if (err.message && err.message.includes('Failed to parse document')) {
    logger.warn('Document parsing failed', {
      requestId: req.requestId,
      error: err.message
    });
    
    return res.status(422).json({
      error: 'Document parsing failed',
      message: 'Unable to extract text from the uploaded file. Please ensure it\'s a valid PDF or DOCX file.',
      requestId: req.requestId
    });
  }

  // Default error
  logger.error('Unhandled error', {
    requestId: req.requestId,
    error: err.message,
    stack: err.stack
  });

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
    requestId: req.requestId
  });
};

module.exports = errorHandler;