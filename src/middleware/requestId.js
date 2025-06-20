const { v4: uuidv4 } = require('uuid');

const requestIdMiddleware = (req, res, next) => {
  // Generate a unique request ID
  req.requestId = uuidv4().substr(0, 8);
  
  // Add request ID to response headers
  res.set('X-Request-ID', req.requestId);
  
  next();
};

module.exports = requestIdMiddleware;