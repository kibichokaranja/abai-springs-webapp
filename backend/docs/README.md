# Abai Springs Web App - Documentation

This directory contains comprehensive documentation for the Abai Springs Web App backend API and related systems.

## 📚 Documentation Files

### Core API Documentation
- **[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)** - Complete API reference with all endpoints, authentication, error handling, and examples
- **[RESPONSE_CONSISTENCY.md](./RESPONSE_CONSISTENCY.md)** - Standardized API response format and helper functions
- **[Abai_Springs_API.postman_collection.json](./Abai_Springs_API.postman_collection.json)** - Postman collection for easy API testing

### System Documentation
- **[AUTHENTICATION.md](./AUTHENTICATION.md)** - Authentication system documentation including JWT tokens, middleware, and security features
- **[PAYMENT_SECURITY.md](./PAYMENT_SECURITY.md)** - Payment security measures, fraud detection, and M-Pesa integration
- **[DATABASE_OPTIMIZATION.md](./DATABASE_OPTIMIZATION.md)** - Database indexing strategy, optimization techniques, and performance monitoring
- **[LOGGING_SYSTEM.md](./LOGGING_SYSTEM.md)** - Comprehensive logging system documentation with file rotation and management
- **[CACHING_SYSTEM.md](./CACHING_SYSTEM.md)** - Comprehensive caching system with in-memory and Redis support

### Setup Guides
- **[MPESA_SETUP.md](./MPESA_SETUP.md)** - M-Pesa API integration guide and configuration

## 🚀 Quick Start

### 1. API Testing with Postman
1. Import the `Abai_Springs_API.postman_collection.json` file into Postman
2. Set the `base_url` environment variable to `http://localhost:3001/api`
3. Start with the Authentication endpoints:
   - Register a new user
   - Login to get access tokens
   - Test other endpoints with the token

### 2. API Testing with cURL
```bash
# Test the API is running
curl http://localhost:3001/api/products

# Register a user
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "phone": "+254700000000",
    "password": "TestPassword123!"
  }'
```

### 3. Authentication Flow
1. **Register** or **Login** to get access and refresh tokens
2. Use the **access token** in the `Authorization: Bearer <token>` header
3. When the access token expires, use the **refresh token** to get a new one
4. **Logout** to invalidate tokens

## 🔧 Environment Variables

Required environment variables for the API:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/abai_springs

# Authentication
JWT_SECRET=your_jwt_secret_key_here
JWT_REFRESH_SECRET=your_refresh_secret_key_here

# M-Pesa Integration
MPESA_CONSUMER_KEY=your_mpesa_consumer_key
MPESA_CONSUMER_SECRET=your_mpesa_consumer_secret
MPESA_TILL_NUMBER=your_mpesa_till_number

# Security
PAYMENT_WEBHOOK_SECRET=your_webhook_secret

# Logging
LOG_LEVEL=info
LOG_DIR=logs
LOG_MAX_SIZE=20m
LOG_MAX_FILES=14
```

## 📊 API Endpoints Overview

### Public Endpoints (No Authentication Required)
- `GET /api/products` - Get all products
- `GET /api/products/:id` - Get product by ID
- `GET /api/outlets` - Get all outlets
- `GET /api/outlets/:id` - Get outlet by ID

### Authentication Endpoints
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user profile

### Customer Endpoints (Requires Authentication)
- `GET /api/orders` - Get user's orders
- `GET /api/orders/:id` - Get specific order
- `POST /api/orders` - Create new order
- `POST /api/payments/process` - Process payment
- `GET /api/payments/:id/status` - Get payment status

### Admin Endpoints (Requires Admin Role)
- `POST /api/products` - Create product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product
- `POST /api/outlets` - Create outlet
- `PUT /api/outlets/:id` - Update outlet
- `DELETE /api/outlets/:id` - Delete outlet
- `PUT /api/orders/:id/status` - Update order status
- `GET /api/analytics/*` - Analytics endpoints
- `GET /api/logs/*` - Log management endpoints

### Webhook Endpoints
- `POST /api/payments/mpesa/callback` - M-Pesa payment callback

## 🔒 Security Features

### Authentication & Authorization
- JWT-based authentication with access and refresh tokens
- Role-based access control (customer/admin)
- Account locking after failed login attempts
- Password strength validation
- Email verification system

### Payment Security
- Rate limiting on payment endpoints
- Input validation and sanitization
- Fraud detection mechanisms
- Webhook signature verification
- Transaction monitoring

### General Security
- CORS configuration
- Security headers (XSS protection, content type options)
- Input validation and sanitization
- Rate limiting on all endpoints
- Comprehensive logging for security events

## 📈 Monitoring & Analytics

### Logging System
- Multi-level logging (error, warn, info, debug)
- Structured JSON logging with metadata
- Daily rotating log files with compression
- Specialized log files for different concerns
- Log management API for admins

### Database Optimization
- Comprehensive indexing strategy
- Query performance monitoring
- Automatic data cleanup
- Health monitoring and reporting

### Analytics Dashboard
- Revenue analytics and trends
- Sales performance metrics
- Product performance analysis
- Customer analytics
- Real-time dashboard updates

## 🛠️ Development Tools

### Database Optimization Script
```bash
# Run database optimization
node scripts/optimizeDatabase.js
```

### Log Management
```bash
# Access logs via API (admin only)
curl -H "Authorization: Bearer <admin_token>" http://localhost:3001/api/logs/stats
```

### Testing
```bash
# Test API endpoints
curl http://localhost:3001/api/products

# Test with authentication
curl -H "Authorization: Bearer <token>" http://localhost:3001/api/auth/me
```

## 📝 Response Format

All API responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "data": {
    // Response data
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": "Additional error details"
  }
}
```

## 🚨 Error Codes

- `VALIDATION_ERROR` - Input validation failed
- `AUTHENTICATION_ERROR` - Invalid or missing authentication
- `AUTHORIZATION_ERROR` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `DUPLICATE_ENTRY` - Resource already exists
- `PAYMENT_ERROR` - Payment processing error
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `INTERNAL_ERROR` - Server error

## 📞 Support

For API support and questions:
1. Check the logs at `/api/logs` (admin only)
2. Review error responses for specific issues
3. Consult the relevant documentation files
4. Contact the development team for technical support

## 🔄 Version History

- **v1.0.0** - Initial API implementation
- **v1.1.0** - Added authentication system
- **v1.2.0** - Added payment integration
- **v1.3.0** - Added analytics and logging
- **v1.4.0** - Added database optimization and security features

---

**Last Updated:** January 2024  
**API Version:** v1.4.0  
**Base URL:** `http://localhost:3001/api`
