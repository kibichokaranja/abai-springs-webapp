/**
 * Standardized API Response Handler
 * Ensures consistent response format across all endpoints
 */

/**
 * Success Response Helper
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code (default: 200)
 * @param {string} message - Success message
 * @param {*} data - Response data
 * @param {Object} pagination - Pagination info (optional)
 * @param {Object} meta - Additional metadata (optional)
 */
export const sendSuccess = (res, {
  statusCode = 200,
  message = 'Success',
  data = null,
  pagination = null,
  meta = null
} = {}) => {
  const response = {
    success: true,
    message,
    ...(data !== null && { data }),
    ...(pagination && { pagination }),
    ...(meta && { meta })
  };

  return res.status(statusCode).json(response);
};

/**
 * Error Response Helper
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code (default: 500)
 * @param {string} message - Error message
 * @param {string} code - Error code (optional)
 * @param {Object} details - Additional error details (optional)
 * @param {boolean} isRetryable - Whether the error is retryable (optional)
 */
export const sendError = (res, {
  statusCode = 500,
  message = 'Internal Server Error',
  code = null,
  details = null,
  isRetryable = false
} = {}) => {
  const response = {
    success: false,
    message,
    ...(code && { code }),
    ...(details && { details }),
    ...(isRetryable && { isRetryable })
  };

  return res.status(statusCode).json(response);
};

/**
 * Validation Error Response Helper
 * @param {Object} res - Express response object
 * @param {Array} errors - Validation errors array
 * @param {string} message - Custom message (optional)
 */
export const sendValidationError = (res, errors, message = 'Validation failed') => {
  return sendError(res, {
    statusCode: 400,
    message,
    code: 'VALIDATION_ERROR',
    details: {
      errors: Array.isArray(errors) ? errors : [errors]
    }
  });
};

/**
 * Not Found Response Helper
 * @param {Object} res - Express response object
 * @param {string} resource - Resource name (e.g., 'Product', 'Order')
 * @param {string} identifier - Identifier value (optional)
 */
export const sendNotFound = (res, resource = 'Resource', identifier = null) => {
  const message = identifier 
    ? `${resource} with identifier '${identifier}' not found`
    : `${resource} not found`;

  return sendError(res, {
    statusCode: 404,
    message,
    code: 'NOT_FOUND'
  });
};

/**
 * Unauthorized Response Helper
 * @param {Object} res - Express response object
 * @param {string} message - Custom message (optional)
 */
export const sendUnauthorized = (res, message = 'Authentication required') => {
  return sendError(res, {
    statusCode: 401,
    message,
    code: 'UNAUTHORIZED'
  });
};

/**
 * Forbidden Response Helper
 * @param {Object} res - Express response object
 * @param {string} message - Custom message (optional)
 */
export const sendForbidden = (res, message = 'Access denied') => {
  return sendError(res, {
    statusCode: 403,
    message,
    code: 'FORBIDDEN'
  });
};

/**
 * Conflict Response Helper
 * @param {Object} res - Express response object
 * @param {string} message - Custom message (optional)
 */
export const sendConflict = (res, message = 'Resource conflict') => {
  return sendError(res, {
    statusCode: 409,
    message,
    code: 'CONFLICT'
  });
};

/**
 * Pagination Helper
 * @param {Array} data - Data array
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @param {number} total - Total items
 * @returns {Object} Pagination object
 */
export const createPagination = (data, page, limit, total) => {
  return {
    currentPage: parseInt(page),
    totalPages: Math.ceil(total / limit),
    totalItems: total,
    itemsPerPage: parseInt(limit),
    hasNext: (page * limit) < total,
    hasPrev: page > 1,
    itemsCount: data.length
  };
};

/**
 * List Response Helper
 * @param {Object} res - Express response object
 * @param {Array} data - Data array
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @param {number} total - Total items
 * @param {string} message - Success message (optional)
 */
export const sendListResponse = (res, data, page, limit, total, message = 'Data retrieved successfully') => {
  const pagination = createPagination(data, page, limit, total);
  
  return sendSuccess(res, {
    message,
    data,
    pagination
  });
};

/**
 * Single Item Response Helper
 * @param {Object} res - Express response object
 * @param {*} data - Item data
 * @param {string} message - Success message (optional)
 */
export const sendItemResponse = (res, data, message = 'Data retrieved successfully') => {
  return sendSuccess(res, {
    message,
    data
  });
};

/**
 * Created Response Helper
 * @param {Object} res - Express response object
 * @param {*} data - Created item data
 * @param {string} message - Success message (optional)
 */
export const sendCreated = (res, data, message = 'Resource created successfully') => {
  return sendSuccess(res, {
    statusCode: 201,
    message,
    data
  });
};

/**
 * Updated Response Helper
 * @param {Object} res - Express response object
 * @param {*} data - Updated item data
 * @param {string} message - Success message (optional)
 */
export const sendUpdated = (res, data, message = 'Resource updated successfully') => {
  return sendSuccess(res, {
    message,
    data
  });
};

/**
 * Deleted Response Helper
 * @param {Object} res - Express response object
 * @param {string} message - Success message (optional)
 */
export const sendDeleted = (res, message = 'Resource deleted successfully') => {
  return sendSuccess(res, {
    message
  });
};

/**
 * No Content Response Helper
 * @param {Object} res - Express response object
 */
export const sendNoContent = (res) => {
  return res.status(204).send();
};

/**
 * Rate Limit Response Helper
 * @param {Object} res - Express response object
 * @param {string} message - Custom message (optional)
 */
export const sendRateLimitExceeded = (res, message = 'Too many requests') => {
  return sendError(res, {
    statusCode: 429,
    message,
    code: 'RATE_LIMIT_EXCEEDED',
    isRetryable: true
  });
};

/**
 * Service Unavailable Response Helper
 * @param {Object} res - Express response object
 * @param {string} message - Custom message (optional)
 */
export const sendServiceUnavailable = (res, message = 'Service temporarily unavailable') => {
  return sendError(res, {
    statusCode: 503,
    message,
    code: 'SERVICE_UNAVAILABLE',
    isRetryable: true
  });
};
