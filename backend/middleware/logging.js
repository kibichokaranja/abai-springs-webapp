import logger from '../utils/logger.js';

// Request logging middleware
export const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  // Log incoming request
  logger.info('Incoming Request', {
    method: req.method,
    url: req.url,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id || 'anonymous',
    userEmail: req.user?.email || 'anonymous'
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const responseTime = Date.now() - start;
    
    const logData = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
      userId: req.user?.id || 'anonymous',
      userEmail: req.user?.email || 'anonymous'
    };

    // Log based on status code
    if (res.statusCode >= 500) {
      logger.error('HTTP Request Error', logData);
    } else if (res.statusCode >= 400) {
      logger.warn('HTTP Request Warning', logData);
    } else {
      logger.info('HTTP Request Success', logData);
    }

    originalEnd.call(this, chunk, encoding);
  };

  next();
};

// Error logging middleware
export const errorLogger = (error, req, res, next) => {
  const errorData = {
    message: error.message,
    stack: error.stack,
    name: error.name,
    code: error.code,
    request: {
      method: req.method,
      url: req.url,
      ip: req.ip || req.connection.remoteAddress,
      userId: req.user?.id || 'anonymous',
      userAgent: req.get('User-Agent')
    }
  };

  logger.error('Application Error', errorData);
  next(error);
};

// Database query logging middleware
export const databaseLogger = (query, duration, collection) => {
  const dbData = {
    query,
    duration: `${duration}ms`,
    collection,
    timestamp: new Date().toISOString()
  };

  if (duration > 100) {
    logger.warn('Slow Database Query', dbData);
  } else {
    logger.debug('Database Query', dbData);
  }
};

// Authentication logging middleware
export const authLogger = (userId, action, success, details = {}) => {
  const authData = {
    userId,
    action,
    success,
    timestamp: new Date().toISOString(),
    ...details
  };

  if (success) {
    logger.info('Authentication Success', authData);
  } else {
    logger.warn('Authentication Failed', authData);
  }
};

// Payment logging middleware
export const paymentLogger = (paymentData) => {
  const paymentLog = {
    transactionId: paymentData.transactionId,
    amount: paymentData.amount,
    method: paymentData.paymentMethod,
    status: paymentData.status,
    customerId: paymentData.customer,
    timestamp: new Date().toISOString()
  };

  logger.info('Payment Transaction', paymentLog);
};

// Order logging middleware
export const orderLogger = (orderData) => {
  const orderLog = {
    orderId: orderData._id,
    customerId: orderData.customer,
    totalAmount: orderData.totalAmount,
    status: orderData.status,
    paymentStatus: orderData.paymentStatus,
    timestamp: new Date().toISOString()
  };

  logger.info('Order Created', orderLog);
};

// Security logging middleware
export const securityLogger = (event, details = {}) => {
  const securityData = {
    event,
    timestamp: new Date().toISOString(),
    ...details
  };

  logger.warn('Security Event', securityData);
};

// Performance logging middleware
export const performanceLogger = (operation, duration, details = {}) => {
  const perfData = {
    operation,
    duration: `${duration}ms`,
    timestamp: new Date().toISOString(),
    ...details
  };

  if (duration > 1000) {
    logger.warn('Performance Issue', perfData);
  } else {
    logger.debug('Performance', perfData);
  }
};

// API rate limiting logging
export const rateLimitLogger = (req, limit) => {
  const rateLimitData = {
    ip: req.ip || req.connection.remoteAddress,
    url: req.url,
    method: req.method,
    limit,
    timestamp: new Date().toISOString()
  };

  logger.warn('Rate Limit Exceeded', rateLimitData);
};

// File upload logging
export const uploadLogger = (req, file, success) => {
  const uploadData = {
    originalName: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    success,
    userId: req.user?.id || 'anonymous',
    timestamp: new Date().toISOString()
  };

  if (success) {
    logger.info('File Upload Success', uploadData);
  } else {
    logger.error('File Upload Failed', uploadData);
  }
};

// Database connection logging
export const dbConnectionLogger = (event, details = {}) => {
  const connectionData = {
    event,
    timestamp: new Date().toISOString(),
    ...details
  };

  if (event === 'connected') {
    logger.info('Database Connected', connectionData);
  } else if (event === 'disconnected') {
    logger.warn('Database Disconnected', connectionData);
  } else if (event === 'error') {
    logger.error('Database Error', connectionData);
  }
};

// System metrics logging
export const systemMetricsLogger = (metrics) => {
  logger.info('System Metrics', {
    cpu: metrics.cpu,
    memory: metrics.memory,
    uptime: metrics.uptime,
    timestamp: new Date().toISOString()
  });
};

// Business metrics logging
export const businessMetricsLogger = (metrics) => {
  logger.info('Business Metrics', {
    activeUsers: metrics.activeUsers,
    totalOrders: metrics.totalOrders,
    revenue: metrics.revenue,
    timestamp: new Date().toISOString()
  });
};

// Export all middleware
export default {
  requestLogger,
  errorLogger,
  databaseLogger,
  authLogger,
  paymentLogger,
  orderLogger,
  securityLogger,
  performanceLogger,
  rateLimitLogger,
  uploadLogger,
  dbConnectionLogger,
  systemMetricsLogger,
  businessMetricsLogger
};
