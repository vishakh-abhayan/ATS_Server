const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  logger.error(
    `${err.status || 500} - ${err.message} - ${req.originalUrl} - ${
      req.method
    } - ${req.ip}`
  );

  // Log the full error stack in development
  if (process.env.NODE_ENV === 'development') {
    logger.error(err.stack);
  }
  
  // Azure OpenAI specific errors
  if (err.code === 'ResourceNotFound') {
    return res.status(500).json({
      error: 'AI service configuration error',
      message: 'Please check Azure OpenAI deployment settings',
    });
  }

  if (err.code === 'InvalidRequest') {
    return res.status(400).json({
      error: 'Invalid request to AI service',
      message: err.message,
    });
  }

  // Rate limiting
  if (err.code === 'RateLimitExceeded') {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Please try again in a few moments',
      retryAfter: err.retryAfter || 60,
    });
  }

  // File handling errors
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        message: 'Maximum file size is 5MB',
      });
    }
    return res.status(400).json({
      error: 'File upload error',
      message: err.message,
    });
  }

  // Document parsing errors
  if (err.message && err.message.includes('Failed to parse document')) {
    return res.status(422).json({
      error: 'Document parsing failed',
      message:
        "Unable to extract text from the uploaded file. Please ensure it's a valid PDF or DOCX file.",
    });
  }

  // Default error
  res.status(500).json({
    error: 'Internal server error',
    message:
      process.env.NODE_ENV === 'development'
        ? err.message
        : 'An unexpected error occurred',
    requestId: req.id || 'unknown',
  });
};

module.exports = errorHandler;
