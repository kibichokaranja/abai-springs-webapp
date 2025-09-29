import { sendError } from '../utils/responseHandler.js';

// Centralized Error Handling Middleware
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error for debugging
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query,
    user: req.user ? req.user.id : 'unauthenticated'
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    return sendError(res, {
      statusCode: 404,
      message: 'Resource not found',
      code: 'NOT_FOUND'
    });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    return sendError(res, {
      statusCode: 409,
      message: 'Duplicate field value entered',
      code: 'DUPLICATE_ENTRY'
    });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(val => val.message);
    return sendError(res, {
      statusCode: 400,
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: { errors }
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return sendError(res, {
      statusCode: 401,
      message: 'Invalid token',
      code: 'INVALID_TOKEN'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return sendError(res, {
      statusCode: 401,
      message: 'Token expired',
      code: 'TOKEN_EXPIRED'
    });
  }

  // Rate limit errors
  if (err.status === 429) {
    return sendError(res, {
      statusCode: 429,
      message: 'Too many requests',
      code: 'RATE_LIMIT_EXCEEDED',
      isRetryable: true
    });
  }

  // Default error
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';

  return sendError(res, {
    statusCode,
    message,
    code: 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV === 'development' && { 
      details: { stack: err.stack } 
    })
  });
};

export default errorHandler;
