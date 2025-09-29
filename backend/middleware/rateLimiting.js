import rateLimit from 'express-rate-limit';
import { sendError } from '../utils/responseHandler.js';
import logger from '../utils/logger.js';

// Store for tracking rate limit violations
const violationStore = new Map();

// Custom rate limit handler
const createRateLimitHandler = (type) => (req, res) => {
  const clientId = req.ip || 'unknown';
  const currentTime = Date.now();
  
  // Track violations
  if (!violationStore.has(clientId)) {
    violationStore.set(clientId, []);
  }
  
  const violations = violationStore.get(clientId);
  violations.push({ type, timestamp: currentTime });
  
  // Clean old violations (older than 1 hour)
  const oneHourAgo = currentTime - (60 * 60 * 1000);
  violationStore.set(clientId, violations.filter(v => v.timestamp > oneHourAgo));
  
  // Log rate limit violation
  logger.logSecurity('RATE_LIMIT_EXCEEDED', {
    clientId,
    type,
    url: req.url,
    method: req.method,
    userAgent: req.get('User-Agent'),
    violationCount: violations.length
  });

  return sendError(res, {
    statusCode: 429,
    message: `Too many ${type} requests. Please try again later.`,
    code: 'RATE_LIMIT_EXCEEDED',
    isRetryable: true,
    retryAfter: '15 minutes'
  });
};

// Global rate limiting (applies to all requests)
export const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP. Please try again later.',
    code: 'GLOBAL_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('global'),
  skip: (req) => {
    // Skip rate limiting for health checks and static files
    return req.url === '/api/health' || req.url.startsWith('/images/');
  }
});

// Strict rate limiting for authentication endpoints
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 auth attempts per windowMs
  message: {
    success: false,
    error: 'Too many authentication attempts. Please try again later.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('authentication'),
  skipSuccessfulRequests: true, // Don't count successful requests
  skipFailedRequests: false // Count failed requests
});

// Moderate rate limiting for API endpoints
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 API requests per windowMs
  message: {
    success: false,
    error: 'Too many API requests. Please try again later.',
    code: 'API_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('api')
});

// Very strict rate limiting for admin endpoints
export const adminRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 admin requests per windowMs
  message: {
    success: false,
    error: 'Too many admin requests. Please try again later.',
    code: 'ADMIN_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('admin')
});

// Strict rate limiting for order creation
export const orderRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // Limit each IP to 10 order attempts per 5 minutes
  message: {
    success: false,
    error: 'Too many order attempts. Please try again later.',
    code: 'ORDER_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('order_creation')
});

// Very strict rate limiting for password reset
export const passwordResetRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 password reset attempts per hour
  message: {
    success: false,
    error: 'Too many password reset attempts. Please try again later.',
    code: 'PASSWORD_RESET_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('password_reset')
});

// Rate limiting for file uploads
export const uploadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 uploads per windowMs
  message: {
    success: false,
    error: 'Too many upload attempts. Please try again later.',
    code: 'UPLOAD_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('upload')
});

// Rate limiting for search endpoints
export const searchRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 searches per minute
  message: {
    success: false,
    error: 'Too many search requests. Please try again later.',
    code: 'SEARCH_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('search')
});

// Dynamic rate limiting based on user type
export const dynamicRateLimit = (req, res, next) => {
  // Check if user is authenticated and their role
  const user = req.user;
  
  if (!user) {
    // Apply strict rate limiting for unauthenticated users
    return rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 50,
      handler: createRateLimitHandler('unauthenticated')
    })(req, res, next);
  }
  
  if (user.role === 'admin') {
    // More lenient rate limiting for admins
    return rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 1000,
      handler: createRateLimitHandler('admin_user')
    })(req, res, next);
  }
  
  if (user.role === 'user') {
    // Standard rate limiting for regular users
    return rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 200,
      handler: createRateLimitHandler('authenticated_user')
    })(req, res, next);
  }
  
  next();
};

// Rate limiting statistics endpoint
export const getRateLimitStats = (req, res) => {
  const stats = {
    totalViolations: 0,
    violationsByType: {},
    violationsByIP: {},
    topViolators: []
  };
  
  // Aggregate violation data
  for (const [ip, violations] of violationStore.entries()) {
    stats.totalViolations += violations.length;
    stats.violationsByIP[ip] = violations.length;
    
    violations.forEach(violation => {
      if (!stats.violationsByType[violation.type]) {
        stats.violationsByType[violation.type] = 0;
      }
      stats.violationsByType[violation.type]++;
    });
  }
  
  // Get top violators
  stats.topViolators = Object.entries(stats.violationsByIP)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([ip, count]) => ({ ip, violations: count }));
  
  res.json({
    success: true,
    data: stats,
    timestamp: new Date().toISOString()
  });
};

// Clean up old violation data periodically
setInterval(() => {
  const currentTime = Date.now();
  const oneHourAgo = currentTime - (60 * 60 * 1000);
  
  for (const [clientId, violations] of violationStore.entries()) {
    const recentViolations = violations.filter(v => v.timestamp > oneHourAgo);
    
    if (recentViolations.length === 0) {
      violationStore.delete(clientId);
    } else {
      violationStore.set(clientId, recentViolations);
    }
  }
}, 15 * 60 * 1000); // Clean up every 15 minutes

export default {
  globalRateLimit,
  authRateLimit,
  apiRateLimit,
  adminRateLimit,
  orderRateLimit,
  passwordResetRateLimit,
  uploadRateLimit,
  searchRateLimit,
  dynamicRateLimit,
  getRateLimitStats
};


