# API Response Consistency

This document outlines the standardized response format used across all API endpoints in the Abai Springs application.

## Overview

All API responses follow a consistent structure to ensure predictable behavior and better developer experience. The response format is standardized using the `responseHandler.js` utility.

## Response Structure

### Success Responses

All successful responses follow this structure:

```json
{
  "success": true,
  "message": "Descriptive success message",
  "data": {
    // Response data here
  },
  "pagination": {
    // Pagination info (when applicable)
  },
  "meta": {
    // Additional metadata (when applicable)
  }
}
```

### Error Responses

All error responses follow this structure:

```json
{
  "success": false,
  "message": "Descriptive error message",
  "code": "ERROR_CODE",
  "details": {
    // Additional error details (when applicable)
  },
  "isRetryable": true/false
}
```

## Response Helper Functions

### Success Helpers

#### `sendSuccess(res, options)`
General success response helper.

**Parameters:**
- `res`: Express response object
- `options`: Object with properties:
  - `statusCode`: HTTP status code (default: 200)
  - `message`: Success message
  - `data`: Response data
  - `pagination`: Pagination info (optional)
  - `meta`: Additional metadata (optional)

**Example:**
```javascript
return sendSuccess(res, {
  message: 'User profile retrieved successfully',
  data: userProfile
});
```

#### `sendCreated(res, data, message)`
For 201 Created responses.

**Example:**
```javascript
return sendCreated(res, newUser, 'User registered successfully');
```

#### `sendUpdated(res, data, message)`
For successful update operations.

**Example:**
```javascript
return sendUpdated(res, updatedProduct, 'Product updated successfully');
```

#### `sendDeleted(res, message)`
For successful delete operations.

**Example:**
```javascript
return sendDeleted(res, 'Product deleted successfully');
```

#### `sendItemResponse(res, data, message)`
For single item retrieval.

**Example:**
```javascript
return sendItemResponse(res, product, 'Product retrieved successfully');
```

#### `sendListResponse(res, data, page, limit, total, message)`
For paginated list responses.

**Example:**
```javascript
return sendListResponse(res, products, page, limit, total, 'Products retrieved successfully');
```

### Error Helpers

#### `sendError(res, options)`
General error response helper.

**Parameters:**
- `res`: Express response object
- `options`: Object with properties:
  - `statusCode`: HTTP status code (default: 500)
  - `message`: Error message
  - `code`: Error code (optional)
  - `details`: Additional error details (optional)
  - `isRetryable`: Whether the error is retryable (optional)

**Example:**
```javascript
return sendError(res, {
  statusCode: 400,
  message: 'Invalid input data',
  code: 'VALIDATION_ERROR',
  details: { errors: validationErrors }
});
```

#### `sendNotFound(res, resource, identifier)`
For 404 Not Found responses.

**Example:**
```javascript
return sendNotFound(res, 'Product', productId);
```

#### `sendUnauthorized(res, message)`
For 401 Unauthorized responses.

**Example:**
```javascript
return sendUnauthorized(res, 'Authentication required');
```

#### `sendForbidden(res, message)`
For 403 Forbidden responses.

**Example:**
```javascript
return sendForbidden(res, 'Access denied');
```

#### `sendConflict(res, message)`
For 409 Conflict responses.

**Example:**
```javascript
return sendConflict(res, 'User already exists with this email');
```

#### `sendValidationError(res, errors, message)`
For validation error responses.

**Example:**
```javascript
return sendValidationError(res, validationErrors, 'Validation failed');
```

#### `sendRateLimitExceeded(res, message)`
For 429 Too Many Requests responses.

**Example:**
```javascript
return sendRateLimitExceeded(res, 'Too many requests');
```

#### `sendServiceUnavailable(res, message)`
For 503 Service Unavailable responses.

**Example:**
```javascript
return sendServiceUnavailable(res, 'Service temporarily unavailable');
```

## Pagination Structure

When pagination is included, it follows this structure:

```json
{
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalItems": 100,
    "itemsPerPage": 20,
    "hasNext": true,
    "hasPrev": false,
    "itemsCount": 20
  }
}
```

## Error Codes

Common error codes used across the API:

- `VALIDATION_ERROR`: Input validation failed
- `NOT_FOUND`: Resource not found
- `UNAUTHORIZED`: Authentication required
- `FORBIDDEN`: Access denied
- `CONFLICT`: Resource conflict (e.g., duplicate entry)
- `DUPLICATE_ENTRY`: Duplicate field value
- `INVALID_TOKEN`: Invalid JWT token
- `TOKEN_EXPIRED`: JWT token expired
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `SERVICE_UNAVAILABLE`: Service temporarily unavailable
- `ANALYTICS_ERROR`: Error in analytics processing
- `OUTLETS_ERROR`: Error in outlets processing
- `INTERNAL_ERROR`: Internal server error

## HTTP Status Codes

Standard HTTP status codes used:

- `200 OK`: Successful GET, PUT, PATCH requests
- `201 Created`: Successful POST requests
- `204 No Content`: Successful DELETE requests
- `400 Bad Request`: Validation errors, missing required fields
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Access denied
- `404 Not Found`: Resource not found
- `409 Conflict`: Resource conflict
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server errors
- `503 Service Unavailable`: Service temporarily unavailable

## Examples

### Successful Product Retrieval
```json
{
  "success": true,
  "message": "Product retrieved successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "500ml Bottle",
    "brand": "Abai Springs",
    "category": "500ml",
    "price": 50,
    "stockLevel": 100
  }
}
```

### Paginated Products List
```json
{
  "success": true,
  "message": "Products retrieved successfully",
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "name": "500ml Bottle",
      "brand": "Abai Springs",
      "category": "500ml",
      "price": 50
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalItems": 100,
    "itemsPerPage": 20,
    "hasNext": true,
    "hasPrev": false,
    "itemsCount": 20
  }
}
```

### Validation Error
```json
{
  "success": false,
  "message": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": {
    "errors": [
      "Name must be between 2 and 50 characters",
      "Please enter a valid Kenyan phone number"
    ]
  }
}
```

### Not Found Error
```json
{
  "success": false,
  "message": "Product with identifier '507f1f77bcf86cd799439011' not found",
  "code": "NOT_FOUND"
}
```

## Implementation Guidelines

1. **Always use the response helpers** instead of manually constructing responses
2. **Include descriptive messages** that explain what happened
3. **Use appropriate error codes** for different types of errors
4. **Include pagination** for list endpoints that support it
5. **Provide consistent field names** across all responses
6. **Handle errors gracefully** with appropriate status codes
7. **Include retryable flags** for transient errors

## Migration Notes

When updating existing endpoints to use the standardized format:

1. Import the required response helpers
2. Replace manual response construction with helper functions
3. Update error handling to use standardized error responses
4. Ensure all responses include appropriate messages
5. Test all endpoints to verify consistent behavior

## Testing

Use the provided Postman collection to test response consistency:

1. All success responses should have `success: true`
2. All error responses should have `success: false`
3. Check that pagination is included where appropriate
4. Verify error codes are consistent across similar errors
5. Ensure messages are descriptive and helpful
