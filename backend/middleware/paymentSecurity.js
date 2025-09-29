import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import crypto from 'crypto';

// Rate limiting for payment endpoints
export const paymentRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 payment attempts per windowMs
  message: {
    success: false,
    error: 'Too many payment attempts. Please try again later.',
    details: 'Rate limit exceeded'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Payment validation rules
export const paymentValidation = [
  body('orderId')
    .isMongoId()
    .withMessage('Invalid order ID format'),
  body('paymentMethod')
    .isIn(['mpesa', 'airtel_money', 'equitel', 'cash', 'card', 'bank_transfer'])
    .withMessage('Invalid payment method'),
  body('phoneNumber')
    .optional()
    .matches(/^(\+254|0)?[17]\d{8}$/)
    .withMessage('Please enter a valid Kenyan phone number'),
  body('amount')
    .optional()
    .isFloat({ min: 1, max: 100000 })
    .withMessage('Amount must be between 1 and 100,000 KES'),
  body('paymentTiming')
    .optional()
    .isIn(['now', 'delivery'])
    .withMessage('Invalid payment timing')
];

// Payment security validation middleware
export const validatePaymentSecurity = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Payment validation failed',
      details: errors.array()
    });
  }

  // Additional security checks
  const securityChecks = performSecurityChecks(req);
  if (!securityChecks.passed) {
    return res.status(403).json({
      success: false,
      error: 'Payment security check failed',
      details: securityChecks.reason
    });
  }

  next();
};

// Perform comprehensive security checks
function performSecurityChecks(req) {
  const checks = {
    passed: true,
    reason: null
  };

  // Check for suspicious patterns
  if (isSuspiciousRequest(req)) {
    checks.passed = false;
    checks.reason = 'Suspicious payment request detected';
    return checks;
  }

  // Validate payment amount
  if (req.body.amount && !isValidAmount(req.body.amount)) {
    checks.passed = false;
    checks.reason = 'Invalid payment amount';
    return checks;
  }

  // Check for duplicate payment attempts
  if (isDuplicatePayment(req)) {
    checks.passed = false;
    checks.reason = 'Duplicate payment attempt detected';
    return checks;
  }

  return checks;
}

// Detect suspicious payment requests
function isSuspiciousRequest(req) {
  const suspiciousPatterns = [
    // Multiple rapid requests
    req.headers['x-forwarded-for']?.split(',').length > 3,
    // Unusual user agent
    !req.headers['user-agent'] || req.headers['user-agent'].length < 10,
    // Missing or invalid referer
    !req.headers.referer || !req.headers.referer.includes('localhost'),
    // Unusual payment amounts
    req.body.amount && (req.body.amount < 1 || req.body.amount > 100000)
  ];

  return suspiciousPatterns.some(pattern => pattern === true);
}

// Validate payment amount
function isValidAmount(amount) {
  const numAmount = parseFloat(amount);
  return !isNaN(numAmount) && numAmount >= 1 && numAmount <= 100000;
}

// Check for duplicate payment attempts
function isDuplicatePayment(req) {
  // This would typically check against a database of recent payments
  // For now, we'll implement a simple check
  const paymentKey = `${req.body.orderId}-${req.body.paymentMethod}-${Date.now()}`;
  
  // In production, you'd store this in Redis or database
  // and check for recent duplicate attempts
  return false;
}

// Payment signature verification for webhooks
export const verifyPaymentSignature = (req, res, next) => {
  const signature = req.headers['x-payment-signature'];
  const timestamp = req.headers['x-payment-timestamp'];
  
  if (!signature || !timestamp) {
    return res.status(401).json({
      success: false,
      error: 'Missing payment signature'
    });
  }

  // Verify timestamp is recent (within 5 minutes)
  const requestTime = parseInt(timestamp);
  const currentTime = Date.now();
  if (currentTime - requestTime > 5 * 60 * 1000) {
    return res.status(401).json({
      success: false,
      error: 'Payment signature expired'
    });
  }

  // Verify signature
  const expectedSignature = generatePaymentSignature(req.body, timestamp);
  if (signature !== expectedSignature) {
    return res.status(401).json({
      success: false,
      error: 'Invalid payment signature'
    });
  }

  next();
};

// Generate payment signature
function generatePaymentSignature(body, timestamp) {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET || 'default-secret';
  const data = JSON.stringify(body) + timestamp + secret;
  return crypto.createHash('sha256').update(data).digest('hex');
}

// Sanitize payment data
export const sanitizePaymentData = (req, res, next) => {
  // Remove potentially dangerous fields
  const allowedFields = ['orderId', 'paymentMethod', 'phoneNumber', 'amount', 'paymentTiming'];
  
  const sanitizedData = {};
  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) {
      sanitizedData[field] = req.body[field];
    }
  });

  req.body = sanitizedData;
  next();
};

// Payment logging middleware
export const logPaymentAttempt = (req, res, next) => {
  const paymentLog = {
    timestamp: new Date().toISOString(),
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    userId: req.user?.id || 'anonymous',
    orderId: req.body.orderId,
    paymentMethod: req.body.paymentMethod,
    amount: req.body.amount,
    success: false // Will be updated in response
  };

  // Store payment attempt log
  console.log('Payment Attempt:', paymentLog);
  
  // In production, store in database
  // await PaymentLog.create(paymentLog);

  next();
};

// M-Pesa specific security
export const mpesaSecurityChecks = (req, res, next) => {
  const { phoneNumber, amount } = req.body;

  // Validate phone number format
  if (phoneNumber && !/^(\+254|0)?[17]\d{8}$/.test(phoneNumber)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid phone number format for M-Pesa'
    });
  }

  // Validate amount for M-Pesa (minimum 1 KES)
  if (amount && parseFloat(amount) < 1) {
    return res.status(400).json({
      success: false,
      error: 'M-Pesa minimum amount is 1 KES'
    });
  }

  // Check for test phone numbers in production
  if (process.env.NODE_ENV === 'production') {
    const testNumbers = ['254708374149', '254708374149'];
    if (testNumbers.includes(phoneNumber)) {
      return res.status(400).json({
        success: false,
        error: 'Test phone numbers not allowed in production'
      });
    }
  }

  next();
};

// Payment success/failure tracking
export const trackPaymentResult = (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    try {
      const response = JSON.parse(data);
      
      // Log payment result
      const paymentResult = {
        timestamp: new Date().toISOString(),
        orderId: req.body.orderId,
        paymentMethod: req.body.paymentMethod,
        success: response.success,
        error: response.error || null,
        ip: req.ip,
        userId: req.user?.id || 'anonymous'
      };

      console.log('Payment Result:', paymentResult);
      
      // In production, store in database
      // await PaymentResult.create(paymentResult);
      
    } catch (error) {
      console.error('Error tracking payment result:', error);
    }
    
    originalSend.call(this, data);
  };
  
  next();
};
