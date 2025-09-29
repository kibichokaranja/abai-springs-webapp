# Abai Springs Advanced Authentication System

## 🎯 Overview

This document provides comprehensive information about the advanced authentication and authorization system implemented in the Abai Springs application. The system provides enterprise-grade security features including multi-factor authentication, social login, role-based permissions, session management, and advanced security policies.

## 🚀 Quick Start

### 1. Installation

```bash
# Install dependencies
npm install

# Copy environment configuration
cp config.env.example config.env

# Edit config.env with your settings
nano config.env

# Run setup script
npm run setup-auth

# Start the server
npm run dev
```

### 2. Basic Usage

```javascript
// Login
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password123"
}

// Register
POST /api/auth/register
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "phone": "+254700000000"
}
```

## 🔐 Authentication Features

### Basic Authentication
- **JWT-based authentication** with access and refresh tokens
- **Secure password hashing** using bcrypt with salt rounds
- **Token rotation** and automatic refresh
- **Session management** with device tracking
- **Account lockout** protection against brute force attacks

### Multi-Factor Authentication (MFA)
- **TOTP (Time-based OTP)** with QR code generation
- **SMS OTP** via Twilio integration
- **Email OTP** with beautiful HTML templates
- **Backup codes** for account recovery
- **Flexible MFA requirements** based on action sensitivity

### Social Login Integration
- **Google OAuth2** with profile and email access
- **Facebook Login** with user information
- **Apple Sign-In** with privacy-focused approach
- **Account linking** for existing users
- **Social provider management**

## 👑 Authorization System

### Role-Based Access Control (RBAC)
The system implements a hierarchical role-based permission system:

#### Default Roles
1. **Super Admin** - Full system access
2. **Admin** - Administrative access with most permissions
3. **Manager** - Management access with limited permissions
4. **Staff** - Basic staff access for daily operations
5. **Customer** - Customer access for self-service operations

#### Permission System
```javascript
// Example permission structure
{
  resource: "orders",
  actions: ["create", "read", "update", "delete"],
  conditions: {
    ownership: "self",  // Can only access own orders
    timeRange: { start: "09:00", end: "17:00" },  // Time-based restrictions
    allowedIPs: ["192.168.1.0/24"]  // IP-based restrictions
  }
}
```

### Custom Permissions
Create custom roles and permissions:

```javascript
// Create custom role
POST /api/auth/roles
{
  "name": "warehouse_manager",
  "displayName": "Warehouse Manager",
  "permissions": [
    {
      "resource": "products",
      "actions": ["read", "update"],
      "conditions": { "location": "warehouse" }
    }
  ]
}
```

## 🛡️ Security Features

### Password Policy Enforcement
- **Complexity requirements** (uppercase, lowercase, numbers, symbols)
- **Password history** tracking (prevents reuse)
- **Expiry notifications** and enforcement
- **Common password detection**
- **Personal information checking**
- **Entropy calculation** and strength analysis

### Account Lockout System
- **Progressive lockout** with increasing duration
- **IP-based lockout** for suspicious activity
- **Geolocation anomaly** detection
- **Device fingerprinting** (optional)
- **Automatic unlock** or manual intervention
- **Suspicious activity flagging**

### Session Management
- **Redis-based sessions** for scalability
- **Device tracking** and management
- **Concurrent session limits**
- **Session timeout** and automatic cleanup
- **Geographic session monitoring**
- **Session hijacking protection**

## 📡 API Endpoints

### Basic Authentication
```
POST   /api/auth/register           - User registration
POST   /api/auth/login              - User login
POST   /api/auth/logout             - User logout
GET    /api/auth/profile            - Get user profile
PUT    /api/auth/profile            - Update user profile
POST   /api/auth/forgot-password    - Initiate password reset
POST   /api/auth/reset-password     - Complete password reset
```

### Multi-Factor Authentication
```
POST   /api/auth/advanced/mfa/setup/totp         - Setup TOTP MFA
POST   /api/auth/advanced/mfa/setup/totp/verify  - Verify TOTP setup
POST   /api/auth/advanced/mfa/setup/sms          - Setup SMS MFA
POST   /api/auth/advanced/mfa/setup/sms/verify   - Verify SMS setup
POST   /api/auth/advanced/mfa/setup/email        - Setup Email MFA
POST   /api/auth/advanced/mfa/setup/email/verify - Verify Email setup
GET    /api/auth/advanced/mfa/status             - Get MFA status
DELETE /api/auth/advanced/mfa/disable            - Disable MFA
POST   /api/auth/advanced/mfa/verify             - Verify MFA challenge
```

### Social Authentication
```
GET    /api/auth/advanced/social/providers       - Get available providers
POST   /api/auth/advanced/social/google          - Google login
POST   /api/auth/advanced/social/facebook        - Facebook login
POST   /api/auth/advanced/social/apple           - Apple Sign-In
POST   /api/auth/advanced/social/link/:provider  - Link social account
DELETE /api/auth/advanced/social/unlink/:provider - Unlink social account
```

### Session Management
```
GET    /api/auth/advanced/sessions               - Get active sessions
DELETE /api/auth/advanced/sessions/:sessionId    - Terminate session
DELETE /api/auth/advanced/sessions/terminate-all - Terminate all sessions
```

### Token Management
```
POST   /api/auth/token/refresh                   - Refresh access token
POST   /api/auth/token/login                     - Enhanced login
POST   /api/auth/token/logout                    - Enhanced logout
GET    /api/auth/token/active                    - Get active tokens
DELETE /api/auth/token/:jti                      - Revoke specific token
DELETE /api/auth/token/revoke-others             - Revoke other tokens
POST   /api/auth/token/verify                    - Verify token validity
GET    /api/auth/token/stats                     - Token statistics (admin)
```

### API Key Management
```
POST   /api/auth/advanced/api-keys               - Generate API key
GET    /api/auth/advanced/api-keys               - List API keys
DELETE /api/auth/advanced/api-keys/:keyId        - Revoke API key
```

### Password Management
```
PUT    /api/auth/advanced/password/change        - Change password
GET    /api/auth/advanced/password/expiry        - Check password expiry
```

## 🔧 Configuration

### Environment Variables

#### Required
```bash
JWT_SECRET=your-super-secret-jwt-key-min-32-chars-long
JWT_REFRESH_SECRET=your-super-secret-refresh-token-key
MONGODB_URI=mongodb://localhost:27017/abai_springs
```

#### Optional (Enhanced Features)
```bash
# Redis for session management
REDIS_HOST=localhost
REDIS_PORT=6379

# Email notifications
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# SMS notifications
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token

# Social login
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret
```

### Security Policies

#### Default Password Policy
```javascript
{
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  forbidCommonPasswords: true,
  forbidPersonalInfo: true,
  maxRepeatingChars: 3,
  minPasswordAge: 24 * 60 * 60 * 1000, // 24 hours
  maxPasswordAge: 90 * 24 * 60 * 60 * 1000, // 90 days
  passwordHistoryCount: 5
}
```

#### Default Lockout Policy
```javascript
{
  maxFailedAttempts: 5,
  lockoutDurations: [5, 15, 30, 60, 120, 1440], // minutes
  windowDuration: 24 * 60 * 60 * 1000, // 24 hours
  maxLockouts: 10,
  enableIPLocking: true,
  ipLockoutThreshold: 20,
  ipLockoutDuration: 60 * 60 * 1000 // 1 hour
}
```

## 📊 Monitoring & Analytics

### Security Logging
All security events are logged with structured data:

```javascript
// Example security log entry
{
  level: "warn",
  message: "FAILED_LOGIN_ATTEMPT",
  data: {
    identifier: "user@example.com",
    ip: "192.168.1.100",
    attemptCount: 3,
    userAgent: "Mozilla/5.0...",
    timestamp: "2024-01-15T10:30:00Z"
  }
}
```

### Available Metrics
- Failed login attempts
- Account lockouts
- MFA usage statistics
- Session activity
- Token rotation frequency
- Password strength distribution
- Social login usage

### Dashboards
Access monitoring dashboards:
- **Admin Dashboard**: `/admin` - System overview
- **Security Dashboard**: `/admin/security` - Security metrics
- **User Analytics**: `/admin/users` - User behavior

## 🧪 Testing

### Running Tests
```bash
# Run authentication tests
npm run test:auth

# Run all tests
npm test

# Run with coverage
npm run test:coverage
```

### Test Accounts
After running setup, these test accounts are available:

```
Super Admin:
  Email: admin@abaisprings.com
  Password: SuperAdmin123!

Manager:
  Email: manager@abaisprings.com
  Password: Manager123!

Staff:
  Email: staff@abaisprings.com
  Password: Staff123!

Customer:
  Email: customer@abaisprings.com
  Password: Customer123!
```

## 📚 Integration Examples

### Frontend Integration

#### Basic Login
```javascript
const login = async (email, password) => {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  
  const data = await response.json();
  
  if (data.success) {
    localStorage.setItem('accessToken', data.data.accessToken);
    localStorage.setItem('refreshToken', data.data.refreshToken);
    localStorage.setItem('sessionId', data.data.sessionId);
  }
  
  return data;
};
```

#### MFA Challenge
```javascript
const handleMFAChallenge = async (challengeId, method, token) => {
  const response = await fetch('/api/auth/advanced/mfa/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challengeId, method, token })
  });
  
  return await response.json();
};
```

#### Token Refresh
```javascript
const refreshToken = async () => {
  const refreshToken = localStorage.getItem('refreshToken');
  
  const response = await fetch('/api/auth/token/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  });
  
  const data = await response.json();
  
  if (data.success) {
    localStorage.setItem('accessToken', data.data.accessToken);
    if (data.data.refreshToken) {
      localStorage.setItem('refreshToken', data.data.refreshToken);
    }
  }
  
  return data;
};
```

### Mobile Integration

#### React Native Example
```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';

const authenticateUser = async (email, password) => {
  try {
    const response = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (data.success) {
      await AsyncStorage.setItem('accessToken', data.data.accessToken);
      await AsyncStorage.setItem('refreshToken', data.data.refreshToken);
    }
    
    return data;
  } catch (error) {
    console.error('Authentication failed:', error);
    throw error;
  }
};
```

## 🔒 Security Best Practices

### Production Deployment
1. **Environment Security**
   - Use strong, unique JWT secrets (min 32 characters)
   - Enable HTTPS in production
   - Set secure cookie flags
   - Configure proper CORS origins

2. **Database Security**
   - Use MongoDB Atlas or secured self-hosted instance
   - Enable authentication and authorization
   - Use connection string with credentials
   - Regular security updates

3. **Redis Security**
   - Enable authentication
   - Use TLS for connections
   - Regular security updates
   - Proper network isolation

4. **Rate Limiting**
   - Configure appropriate limits for your usage
   - Monitor and adjust based on traffic patterns
   - Use DDoS protection services

5. **Monitoring**
   - Set up log aggregation
   - Monitor security events
   - Set up alerts for suspicious activity
   - Regular security audits

### Code Security
1. **Input Validation**
   - All inputs are validated using express-validator
   - SQL injection prevention (using Mongoose)
   - XSS protection with proper encoding
   - CSRF protection with tokens

2. **Error Handling**
   - No sensitive information in error messages
   - Proper error logging
   - Consistent error responses
   - Rate limit error endpoints

3. **Dependencies**
   - Regular dependency updates
   - Security vulnerability scanning
   - Use of trusted packages only
   - Dependency pinning in production

## 🆘 Troubleshooting

### Common Issues

#### 1. JWT Token Issues
```
Error: Invalid token
Solution: Check JWT_SECRET in environment variables
```

#### 2. MFA Setup Issues
```
Error: QR Code generation failed
Solution: Ensure 'qrcode' package is installed
```

#### 3. Social Login Issues
```
Error: Google OAuth not configured
Solution: Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
```

#### 4. Session Management Issues
```
Error: Redis connection failed
Solution: Check Redis configuration or fallback to MongoDB sessions
```

### Debugging

#### Enable Debug Logging
```bash
LOG_LEVEL=debug npm run dev
```

#### Check Authentication Status
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3001/api/auth/profile
```

#### Verify Database Connection
```bash
curl http://localhost:3001/api/test-db
```

## 📖 API Documentation

Detailed API documentation is available via Swagger UI when the server is running:
- **Swagger UI**: `http://localhost:3001/api-docs`
- **JSON Schema**: `http://localhost:3001/api-docs.json`

## 🤝 Contributing

When contributing to the authentication system:

1. **Security First**: All changes must maintain or improve security
2. **Test Coverage**: Add tests for new features
3. **Documentation**: Update docs for API changes
4. **Backward Compatibility**: Avoid breaking existing integrations
5. **Code Review**: Security-related changes require additional review

## 📞 Support

For support with the authentication system:

1. **Documentation**: Check this README and API docs
2. **Issues**: Create GitHub issues for bugs
3. **Security**: Email security@abaisprings.com for vulnerabilities
4. **Community**: Join our Discord for discussions

---

## 📄 License

This authentication system is part of the Abai Springs application and is subject to the same license terms.

---

**Last Updated**: January 2024  
**Version**: 1.0.0  
**Maintainer**: Abai Springs Development Team