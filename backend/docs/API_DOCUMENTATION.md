# Abai Springs Web App - API Documentation

## Table of Contents
1. [Overview](#overview)
2. [Base URL](#base-url)
3. [Authentication](#authentication)
4. [Error Handling](#error-handling)
5. [API Endpoints](#api-endpoints)
   - [Authentication](#authentication-endpoints)
   - [Products](#products-endpoints)
   - [Outlets](#outlets-endpoints)
   - [Orders](#orders-endpoints)
   - [Payments](#payments-endpoints)
   - [Analytics](#analytics-endpoints)
   - [Logs](#logs-endpoints)
6. [Webhooks](#webhooks)
7. [Rate Limiting](#rate-limiting)
8. [Security](#security)

## Overview

The Abai Springs Web App API provides a comprehensive RESTful interface for managing water products, outlets, orders, payments, and analytics. The API supports both customer and admin operations with proper authentication and authorization.

## Base URL

```
Development: http://localhost:3001/api
Production: https://your-domain.com/api
```

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. Most endpoints require authentication except for public endpoints like product listing.

### Authentication Flow

1. **Register** or **Login** to get access tokens
2. **Use access token** in Authorization header
3. **Refresh token** when access token expires

### Token Types

- **Access Token**: Short-lived (15 minutes), used for API requests
- **Refresh Token**: Long-lived (7 days), used to get new access tokens

### Headers

```
Authorization: Bearer <access_token>
Content-Type: application/json
```

## Error Handling

All API responses follow a consistent error format:

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

### Common Error Codes

- `VALIDATION_ERROR`: Input validation failed
- `AUTHENTICATION_ERROR`: Invalid or missing authentication
- `AUTHORIZATION_ERROR`: Insufficient permissions
- `NOT_FOUND`: Resource not found
- `DUPLICATE_ENTRY`: Resource already exists
- `PAYMENT_ERROR`: Payment processing error
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `INTERNAL_ERROR`: Server error

## API Endpoints

### Authentication Endpoints

#### Register User
```http
POST /auth/register
```

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+254700000000",
  "password": "SecurePassword123!",
  "role": "customer"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_id",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+254700000000",
      "role": "customer",
      "isActive": true,
      "createdAt": "2024-01-15T10:30:00Z"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
}
```

#### Login User
```http
POST /auth/login
```

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "SecurePassword123!"
}
```

**Response:** Same as register response

#### Refresh Token
```http
POST /auth/refresh
```

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### Logout
```http
POST /auth/logout
```

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

#### Get Current User
```http
GET /auth/me
```

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_id",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+254700000000",
      "role": "customer",
      "isActive": true,
      "lastLogin": "2024-01-15T10:30:00Z",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  }
}
```

### Products Endpoints

#### Get All Products
```http
GET /products
```

**Query Parameters:**
- `category` (optional): Filter by category
- `brand` (optional): Filter by brand
- `minPrice` (optional): Minimum price
- `maxPrice` (optional): Maximum price
- `search` (optional): Search in name/description
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)

**Response:**
```json
{
  "success": true,
  "data": {
    "products": [
      {
        "id": "product_id",
        "name": "Abai Springs Water 1L",
        "brand": "Abai Springs",
        "category": "Water",
        "description": "Pure natural spring water",
        "price": 50,
        "stockLevel": 100,
        "isActive": true,
        "image": "1l.png",
        "createdAt": "2024-01-15T10:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 50,
      "pages": 5
    }
  }
}
```

#### Get Product by ID
```http
GET /products/:id
```

**Response:**
```json
{
  "success": true,
  "data": {
    "product": {
      "id": "product_id",
      "name": "Abai Springs Water 1L",
      "brand": "Abai Springs",
      "category": "Water",
      "description": "Pure natural spring water",
      "price": 50,
      "stockLevel": 100,
      "isActive": true,
      "image": "1l.png",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  }
}
```

#### Create Product (Admin Only)
```http
POST /products
```

**Headers:**
```
Authorization: Bearer <admin_access_token>
```

**Request Body:**
```json
{
  "name": "New Product",
  "brand": "Abai Springs",
  "category": "Water",
  "description": "Product description",
  "price": 100,
  "stockLevel": 50,
  "image": "product.png"
}
```

#### Update Product (Admin Only)
```http
PUT /products/:id
```

**Headers:**
```
Authorization: Bearer <admin_access_token>
```

**Request Body:** Same as create product

#### Delete Product (Admin Only)
```http
DELETE /products/:id
```

**Headers:**
```
Authorization: Bearer <admin_access_token>
```

### Outlets Endpoints

#### Get All Outlets
```http
GET /outlets
```

**Query Parameters:**
- `isActive` (optional): Filter by active status
- `search` (optional): Search in name/address
- `page` (optional): Page number
- `limit` (optional): Items per page

**Response:**
```json
{
  "success": true,
  "data": {
    "outlets": [
      {
        "id": "outlet_id",
        "name": "Nairobi Main Outlet",
        "address": "Nairobi, Kenya",
        "phone": "+254700000000",
        "email": "nairobi@abaisprings.com",
        "coordinates": {
          "lat": -1.2921,
          "lng": 36.8219
        },
        "isActive": true,
        "features": ["delivery", "pickup"],
        "createdAt": "2024-01-15T10:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 5,
      "pages": 1
    }
  }
}
```

#### Get Outlet by ID
```http
GET /outlets/:id
```

#### Create Outlet (Admin Only)
```http
POST /outlets
```

**Headers:**
```
Authorization: Bearer <admin_access_token>
```

**Request Body:**
```json
{
  "name": "New Outlet",
  "address": "Address, City",
  "phone": "+254700000000",
  "email": "outlet@abaisprings.com",
  "coordinates": {
    "lat": -1.2921,
    "lng": 36.8219
  },
  "features": ["delivery", "pickup"]
}
```

#### Update Outlet (Admin Only)
```http
PUT /outlets/:id
```

#### Delete Outlet (Admin Only)
```http
DELETE /outlets/:id
```

### Orders Endpoints

#### Get All Orders (Customer/Admin)
```http
GET /orders
```

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `status` (optional): Filter by order status
- `paymentStatus` (optional): Filter by payment status
- `paymentMethod` (optional): Filter by payment method
- `page` (optional): Page number
- `limit` (optional): Items per page

**Response:**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "id": "order_id",
        "customer": {
          "id": "user_id",
          "name": "John Doe",
          "email": "john@example.com"
        },
        "outlet": {
          "id": "outlet_id",
          "name": "Nairobi Main Outlet"
        },
        "items": [
          {
            "product": {
              "id": "product_id",
              "name": "Abai Springs Water 1L",
              "price": 50
            },
            "quantity": 2,
            "subtotal": 100
          }
        ],
        "totalAmount": 100,
        "status": "pending",
        "paymentStatus": "pending",
        "paymentMethod": "mpesa",
        "paymentTiming": "pay_now",
        "deliveryAddress": "123 Main St, Nairobi",
        "deliveryInstructions": "Leave at gate",
        "estimatedDelivery": "2024-01-16T10:30:00Z",
        "createdAt": "2024-01-15T10:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "pages": 3
    }
  }
}
```

#### Get Order by ID
```http
GET /orders/:id
```

**Headers:**
```
Authorization: Bearer <access_token>
```

#### Create Order
```http
POST /orders
```

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "outletId": "outlet_id",
  "items": [
    {
      "productId": "product_id",
      "quantity": 2
    }
  ],
  "deliveryAddress": "123 Main St, Nairobi",
  "deliveryInstructions": "Leave at gate",
  "paymentMethod": "mpesa",
  "paymentTiming": "pay_now"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "order": {
      "id": "order_id",
      "totalAmount": 100,
      "status": "pending",
      "paymentStatus": "pending",
      "paymentMethod": "mpesa",
      "paymentTiming": "pay_now",
      "createdAt": "2024-01-15T10:30:00Z"
    },
    "payment": {
      "id": "payment_id",
      "amount": 100,
      "status": "pending",
      "mpesaTillNumber": "123456",
      "checkoutRequestId": "checkout_request_id"
    }
  }
}
```

#### Update Order Status (Admin Only)
```http
PUT /orders/:id/status
```

**Headers:**
```
Authorization: Bearer <admin_access_token>
```

**Request Body:**
```json
{
  "status": "processing"
}
```

### Payments Endpoints

#### Process Payment
```http
POST /payments/process
```

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "orderId": "order_id",
  "paymentMethod": "mpesa",
  "phoneNumber": "+254700000000",
  "amount": 100
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "payment": {
      "id": "payment_id",
      "orderId": "order_id",
      "amount": 100,
      "currency": "KES",
      "paymentMethod": "mpesa",
      "status": "pending",
      "transactionId": "transaction_id",
      "mpesaTillNumber": "123456",
      "checkoutRequestId": "checkout_request_id",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  }
}
```

#### Get Payment Status
```http
GET /payments/:id/status
```

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "payment": {
      "id": "payment_id",
      "status": "completed",
      "transactionId": "transaction_id",
      "completedAt": "2024-01-15T10:35:00Z"
    }
  }
}
```

#### M-Pesa Callback
```http
POST /payments/mpesa/callback
```

**Request Body:**
```json
{
  "CheckoutRequestID": "checkout_request_id",
  "ResultCode": 0,
  "ResultDesc": "Success",
  "Amount": 100,
  "MpesaReceiptNumber": "receipt_number",
  "TransactionDate": "20240115103500"
}
```

### Analytics Endpoints

#### Get Dashboard Analytics (Admin Only)
```http
GET /analytics/dashboard
```

**Headers:**
```
Authorization: Bearer <admin_access_token>
```

**Query Parameters:**
- `period` (optional): Time period (daily, weekly, monthly, yearly)
- `startDate` (optional): Start date (YYYY-MM-DD)
- `endDate` (optional): End date (YYYY-MM-DD)

**Response:**
```json
{
  "success": true,
  "data": {
    "revenue": {
      "total": 50000,
      "period": 15000,
      "growth": 15.5
    },
    "orders": {
      "total": 250,
      "period": 75,
      "growth": 12.3
    },
    "products": {
      "total": 20,
      "active": 18
    },
    "customers": {
      "total": 150,
      "new": 25
    },
    "topProducts": [
      {
        "name": "Abai Springs Water 1L",
        "sales": 500,
        "revenue": 25000
      }
    ],
    "salesTrend": [
      {
        "date": "2024-01-15",
        "orders": 10,
        "revenue": 5000
      }
    ]
  }
}
```

#### Get Revenue Analytics
```http
GET /analytics/revenue
```

#### Get Sales Analytics
```http
GET /analytics/sales
```

#### Get Product Analytics
```http
GET /analytics/products
```

### Logs Endpoints

#### Get Log Statistics (Admin Only)
```http
GET /logs/stats
```

**Headers:**
```
Authorization: Bearer <admin_access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalLogs": 15000,
    "errorLogs": 150,
    "warningLogs": 300,
    "infoLogs": 14550,
    "logFiles": [
      {
        "name": "application-2024-01-15.log",
        "size": "2.5MB",
        "entries": 5000
      }
    ]
  }
}
```

#### Search Logs (Admin Only)
```http
GET /logs/search
```

**Headers:**
```
Authorization: Bearer <admin_access_token>
```

**Query Parameters:**
- `level` (optional): Log level (error, warn, info, debug)
- `startDate` (optional): Start date
- `endDate` (optional): End date
- `search` (optional): Search term
- `limit` (optional): Results limit

#### Get Error Logs (Admin Only)
```http
GET /logs/errors
```

#### Get Security Logs (Admin Only)
```http
GET /logs/security
```

#### Export Logs (Admin Only)
```http
POST /logs/export
```

**Headers:**
```
Authorization: Bearer <admin_access_token>
```

**Request Body:**
```json
{
  "startDate": "2024-01-01",
  "endDate": "2024-01-15",
  "level": "error",
  "format": "json"
}
```

## Webhooks

### M-Pesa Payment Webhook

**Endpoint:** `POST /payments/mpesa/callback`

**Headers:**
```
Content-Type: application/json
X-MPESA-Signature: <webhook_signature>
```

**Security:** Webhook signature verification is required

## Rate Limiting

The API implements rate limiting to prevent abuse:

- **Authentication endpoints:** 5 requests per minute
- **Payment endpoints:** 10 requests per minute
- **General endpoints:** 100 requests per minute
- **Admin endpoints:** 50 requests per minute

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642234567
```

## Security

### Security Headers

The API includes security headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`

### Input Validation

All inputs are validated and sanitized:
- Email format validation
- Phone number format validation
- Password strength requirements
- SQL injection prevention
- XSS prevention

### Fraud Detection

Payment endpoints include fraud detection:
- Rate limiting
- Amount validation
- Phone number validation
- Transaction monitoring

## Testing

### Test with cURL

```bash
# Get products
curl -X GET "http://localhost:3001/api/products"

# Register user
curl -X POST "http://localhost:3001/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "phone": "+254700000000",
    "password": "TestPassword123!"
  }'

# Login
curl -X POST "http://localhost:3001/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!"
  }'

# Get user profile (with token)
curl -X GET "http://localhost:3001/api/auth/me" \
  -H "Authorization: Bearer <access_token>"
```

### Test with Postman

1. Import the API collection
2. Set base URL: `http://localhost:3001/api`
3. Use environment variables for tokens
4. Test authentication flow first
5. Test other endpoints with valid tokens

## Environment Variables

Required environment variables:

```env
PORT=3001
MONGODB_URI=mongodb://localhost:27017/abai_springs
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret
MPESA_CONSUMER_KEY=your_mpesa_consumer_key
MPESA_CONSUMER_SECRET=your_mpesa_consumer_secret
MPESA_TILL_NUMBER=your_mpesa_till_number
PAYMENT_WEBHOOK_SECRET=your_webhook_secret
LOG_LEVEL=info
LOG_DIR=logs
LOG_MAX_SIZE=20m
LOG_MAX_FILES=14
```

## Support

For API support and questions:
- Check the logs at `/api/logs` (admin only)
- Review error responses for specific issues
- Contact development team for technical support
