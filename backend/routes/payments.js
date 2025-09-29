import express from 'express';
import jwt from 'jsonwebtoken';
import { body, param } from 'express-validator';
import Payment from '../models/Payment.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import validate, { asyncHandler, ApiError } from '../middleware/validate.js';
import MpesaAPI from '../config/mpesa.js';
import AirtelMoneyAPI from '../config/airtel.js';
import {
  paymentRateLimit,
  paymentValidation,
  validatePaymentSecurity,
  sanitizePaymentData,
  logPaymentAttempt,
  mpesaSecurityChecks,
  trackPaymentResult,
  verifyPaymentSignature
} from '../middleware/paymentSecurity.js';
import { 
  sendSuccess, 
  sendError, 
  sendUnauthorized, 
  sendNotFound, 
  sendConflict,
  sendCreated
} from '../utils/responseHandler.js';

const router = express.Router();

// Validation rules
const validatePaymentInitiation = [
  body('orderId')
    .isMongoId()
    .withMessage('Invalid order ID format'),
  body('paymentMethod')
    .isIn(['mpesa', 'airtel_money', 'equitel', 'cash', 'card', 'bank_transfer'])
    .withMessage('Invalid payment method'),
  body('phoneNumber')
    .optional()
    .matches(/^(\+254|0)?[17]\d{8}$/)
    .withMessage('Please enter a valid Kenyan phone number')
];

const validatePaymentId = [
  param('paymentId')
    .isMongoId()
    .withMessage('Invalid payment ID format')
];

// @desc    Initialize payment
// @route   POST /api/payments/initiate
// @access  Private
router.post('/initiate', 
  paymentRateLimit,
  sanitizePaymentData,
  paymentValidation,
  validatePaymentSecurity,
  logPaymentAttempt,
  trackPaymentResult,
  asyncHandler(async (req, res) => {
    try {
    // Get user from token
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return sendUnauthorized(res, 'Authentication required');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      return sendUnauthorized(res, 'User not found');
    }

    const { orderId, paymentMethod, phoneNumber } = req.body;

    if (!orderId || !paymentMethod) {
      return sendError(res, {
        statusCode: 400,
        message: 'Order ID and payment method are required',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    // Get order details
    const order = await Order.findById(orderId).populate('customer');
    if (!order) {
      return sendNotFound(res, 'Order', orderId);
    }

    // Check if order belongs to user
    if (order.customer._id.toString() !== user._id.toString()) {
      return sendError(res, {
        statusCode: 403,
        message: 'Not authorized to pay for this order',
        code: 'FORBIDDEN'
      });
    }

    // Check if payment already exists
    const existingPayment = await Payment.findOne({ order: orderId });
    if (existingPayment) {
      return sendConflict(res, 'Payment already exists for this order');
    }

    // Create payment record
    const paymentData = {
      order: orderId,
      customer: user._id,
      amount: order.totalAmount,
      paymentMethod,
      status: 'pending'
    };

    // Add method-specific details
    if (paymentMethod === 'mpesa' || paymentMethod === 'airtel_money') {
      if (!phoneNumber) {
        return res.status(400).json({ success: false, message: 'Phone number is required for mobile money payments' });
      }
      paymentData.mpesaDetails = {
        phoneNumber,
        callbackUrl: `${process.env.BASE_URL || 'http://localhost:5001'}/api/payments/callback`
      };
    }

    const payment = new Payment(paymentData);
    await payment.save();

    // Process payment based on method
    let paymentResponse = {};

    switch (paymentMethod) {
      case 'mpesa':
        paymentResponse = await processMpesaPayment(payment, phoneNumber);
        break;
      case 'airtel_money':
        paymentResponse = await processAirtelMoneyPayment(payment, phoneNumber);
        break;
      case 'equitel':
        paymentResponse = await simulateEquitelPayment(payment, phoneNumber);
        break;
      case 'cash':
        paymentResponse = await simulateCashPayment(payment);
        break;
      case 'card':
        paymentResponse = await simulateCardPayment(payment);
        break;
      case 'bank_transfer':
        paymentResponse = await processBankTransfer(payment);
        break;
      default:
        throw new ApiError('Invalid payment method', 400);
    }

    res.json({
      success: true,
      data: {
        payment,
        paymentResponse
      }
    });

  } catch (error) {
    console.error('Payment initiation error:', error);
    res.status(500).json({ success: false, message: 'Error initiating payment' });
  }
}));

// @desc    Get payment status
// @route   GET /api/payments/:paymentId/status
// @access  Private
router.get('/:paymentId/status', validatePaymentId, asyncHandler(async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    const payment = await Payment.findById(req.params.paymentId)
      .populate('order')
      .populate('customer');

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    // Check if user owns this payment
    if (payment.customer._id.toString() !== user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this payment' });
    }

    res.json({
      success: true,
      data: payment
    });

  } catch (error) {
    console.error('Payment status error:', error);
    res.status(500).json({ success: false, message: 'Error fetching payment status' });
  }
}));

// @desc    Query Airtel Money payment status
// @route   POST /api/payments/:paymentId/query-airtel
// @access  Private
router.post('/:paymentId/query-airtel', validatePaymentId, asyncHandler(async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    throw new ApiError('Authentication required', 401);
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(decoded.id);
  if (!user) {
    throw new ApiError('User not found', 401);
  }

  const payment = await Payment.findById(req.params.paymentId);
  if (!payment) {
    throw new ApiError('Payment not found', 404);
  }

  // Check if payment belongs to user
  if (payment.customer.toString() !== user._id.toString()) {
    throw new ApiError('Not authorized to access this payment', 403);
  }

  // Check if payment is Airtel Money
  if (payment.paymentMethod !== 'airtel_money') {
    throw new ApiError('This endpoint is only for Airtel Money payments', 400);
  }

  // Check if payment has transaction ID
  if (!payment.airtelDetails?.transactionId) {
    throw new ApiError('Payment does not have a transaction ID', 400);
  }

  try {
    const airtelAPI = new AirtelMoneyAPI();
    
    // Check if Airtel Money credentials are configured
    if (!airtelAPI.isConfigured()) {
      throw new ApiError('Airtel Money credentials not configured', 500);
    }

    // Query transaction status
    const queryResponse = await airtelAPI.queryTransaction(payment.airtelDetails.transactionId);

    // Update payment with query results
    payment.airtelDetails.queryResult = queryResponse;
    payment.airtelDetails.lastQueried = new Date();
    await payment.save();

    res.json({
      success: true,
      data: {
        paymentId: payment._id,
        status: payment.status,
        queryResult: queryResponse,
        message: 'Airtel Money status queried successfully'
      }
    });
  } catch (error) {
    console.error('Airtel Money query error:', error);
    throw new ApiError(`Failed to query Airtel Money status: ${error.message}`, 400);
  }
}));

// @desc    Query M-Pesa payment status
// @route   POST /api/payments/:paymentId/query-mpesa
// @access  Private
router.post('/:paymentId/query-mpesa', validatePaymentId, asyncHandler(async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    throw new ApiError('Authentication required', 401);
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(decoded.id);
  if (!user) {
    throw new ApiError('User not found', 401);
  }

  const payment = await Payment.findById(req.params.paymentId);
  if (!payment) {
    throw new ApiError('Payment not found', 404);
  }

  // Check if payment belongs to user
  if (payment.customer.toString() !== user._id.toString()) {
    throw new ApiError('Not authorized to access this payment', 403);
  }

  // Check if payment is M-Pesa
  if (payment.paymentMethod !== 'mpesa') {
    throw new ApiError('This endpoint is only for M-Pesa payments', 400);
  }

  // Check if payment has checkout request ID
  if (!payment.mpesaDetails?.checkoutRequestID) {
    throw new ApiError('Payment does not have a checkout request ID', 400);
  }

  try {
    const mpesaAPI = new MpesaAPI();
    
    // Check if M-Pesa credentials are configured
    if (!mpesaAPI.consumerKey || !mpesaAPI.consumerSecret || !mpesaAPI.passkey || !mpesaAPI.shortcode) {
      throw new ApiError('M-Pesa credentials not configured', 500);
    }

    // Query STK status
    const queryResponse = await mpesaAPI.querySTKStatus(payment.mpesaDetails.checkoutRequestID);

    // Update payment with query results
    payment.mpesaDetails.queryResultCode = queryResponse.resultCode;
    payment.mpesaDetails.queryResultDesc = queryResponse.resultDesc;
    payment.mpesaDetails.lastQueried = new Date();
    await payment.save();

    res.json({
      success: true,
      data: {
        paymentId: payment._id,
        status: payment.status,
        queryResult: queryResponse,
        message: queryResponse.resultDesc
      }
    });
  } catch (error) {
    console.error('M-Pesa query error:', error);
    throw new ApiError(`Failed to query M-Pesa status: ${error.message}`, 400);
  }
}));

// @desc    M-Pesa callback (real webhook)
// @route   POST /api/payments/mpesa/callback
// @access  Public
router.post('/mpesa/callback', 
  verifyPaymentSignature,
  logPaymentAttempt,
  asyncHandler(async (req, res) => {
  console.log('M-Pesa callback received:', req.body);
  
  try {
    const {
      Body: {
        stkCallback: {
          CheckoutRequestID,
          ResultCode,
          ResultDesc,
          CallbackMetadata
        }
      }
    } = req.body;

    // Find payment by checkout request ID
    const payment = await Payment.findOne({
      'mpesaDetails.checkoutRequestID': CheckoutRequestID
    });

    if (!payment) {
      console.error('Payment not found for checkout request ID:', CheckoutRequestID);
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    // Extract transaction details from callback metadata
    let transactionId = null;
    let amount = null;
    let phoneNumber = null;

    if (CallbackMetadata && CallbackMetadata.Item) {
      CallbackMetadata.Item.forEach(item => {
        switch (item.Name) {
          case 'TransactionID':
            transactionId = item.Value;
            break;
          case 'Amount':
            amount = item.Value;
            break;
          case 'PhoneNumber':
            phoneNumber = item.Value;
            break;
        }
      });
    }

    // Update payment based on result
    if (ResultCode === '0') {
      // Payment successful
      payment.status = 'completed';
      payment.processedAt = new Date();
      payment.transactionId = transactionId;
      payment.mpesaDetails.resultCode = ResultCode;
      payment.mpesaDetails.resultDesc = ResultDesc;
      payment.mpesaDetails.transactionId = transactionId;
      payment.mpesaDetails.amount = amount;
      payment.mpesaDetails.phoneNumber = phoneNumber;

      // Update order status
      const order = await Order.findById(payment.order);
      if (order) {
        order.paymentStatus = 'paid';
        order.status = 'confirmed';
        await order.save();
      }
    } else {
      // Payment failed
      payment.status = 'failed';
      payment.failureReason = ResultDesc;
      payment.mpesaDetails.resultCode = ResultCode;
      payment.mpesaDetails.resultDesc = ResultDesc;
    }

    await payment.save();

    console.log(`Payment ${payment._id} updated with status: ${payment.status}`);

    res.json({ success: true, message: 'Callback processed successfully' });
  } catch (error) {
    console.error('M-Pesa callback processing error:', error);
    res.status(500).json({ success: false, message: 'Callback processing error' });
  }
}));

// @desc    Payment callback (legacy endpoint)
// @route   POST /api/payments/callback
// @access  Public
router.post('/callback', async (req, res) => {
  try {
    const { checkoutRequestId, resultCode, resultDesc, merchantRequestId } = req.body;

    // Find payment by checkout request ID
    const payment = await Payment.findOne({
      'mpesaDetails.checkoutRequestId': checkoutRequestId
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    // Update payment status based on result code
    if (resultCode === '0') {
      payment.status = 'completed';
      payment.processedAt = new Date();
      payment.mpesaDetails.resultCode = resultCode;
      payment.mpesaDetails.resultDesc = resultDesc;
    } else {
      payment.status = 'failed';
      payment.errorMessage = resultDesc;
    }

    await payment.save();

    // Update order status if payment is completed
    if (payment.status === 'completed') {
      const order = await Order.findById(payment.order);
      if (order) {
        order.paymentStatus = 'paid';
        order.status = 'confirmed';
        await order.save();
      }
    }

    res.json({ success: true, message: 'Callback processed successfully' });

  } catch (error) {
    console.error('Payment callback error:', error);
    res.status(500).json({ success: false, message: 'Error processing callback' });
  }
});

// @desc    Confirm bank transfer payment
// @route   POST /api/payments/:paymentId/confirm-bank-transfer
// @access  Private
router.post('/:paymentId/confirm-bank-transfer', validatePaymentId, asyncHandler(async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    const payment = await Payment.findById(req.params.paymentId);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    // Check if payment belongs to user
    if (payment.customer.toString() !== user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to access this payment' });
    }

    // Check if payment is bank transfer
    if (payment.paymentMethod !== 'bank_transfer') {
      return res.status(400).json({ success: false, message: 'This endpoint is only for bank transfer payments' });
    }

    const { transferReceipt, transferReference, transferAmount } = req.body;

    if (!transferReceipt || !transferReference || !transferAmount) {
      return res.status(400).json({ 
        success: false, 
        message: 'Transfer receipt, reference, and amount are required' 
      });
    }

    // Update payment with confirmation details
    payment.bankDetails.confirmationDetails = {
      transferReceipt,
      transferReference,
      transferAmount,
      confirmedBy: user._id,
      confirmedAt: new Date(),
      status: 'pending_verification'
    };

    payment.status = 'pending_verification';
    await payment.save();

    res.json({
      success: true,
      message: 'Bank transfer confirmation submitted. We will verify and update your payment status.',
      data: {
        paymentId: payment._id,
        status: 'pending_verification',
        message: 'Our team will verify your transfer within 2-4 hours during business hours'
      }
    });

  } catch (error) {
    console.error('Bank transfer confirmation error:', error);
    res.status(500).json({ success: false, message: 'Error confirming bank transfer' });
  }
}));

// @desc    Get user payments
// @route   GET /api/payments
// @access  Private
router.get('/', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    const payments = await Payment.find({ customer: user._id })
      .populate('order')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: payments
    });

  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ success: false, message: 'Error fetching payments' });
  }
});

// Real M-Pesa payment processing
async function processMpesaPayment(payment, phoneNumber) {
  try {
    // Additional M-Pesa security checks
    if (!phoneNumber || !/^(\+254|0)?[17]\d{8}$/.test(phoneNumber)) {
      throw new ApiError('Invalid phone number format for M-Pesa', 400);
    }

    if (payment.amount < 1) {
      throw new ApiError('M-Pesa minimum amount is 1 KES', 400);
    }

    // Check for test numbers in production
    if (process.env.NODE_ENV === 'production') {
      const testNumbers = ['254708374149', '254708374149'];
      if (testNumbers.includes(phoneNumber)) {
        throw new ApiError('Test phone numbers not allowed in production', 400);
      }
    }

    const mpesaAPI = new MpesaAPI();
    
    // Check if M-Pesa credentials are configured
    if (!mpesaAPI.consumerKey || !mpesaAPI.consumerSecret || !mpesaAPI.passkey || !mpesaAPI.shortcode) {
      console.warn('M-Pesa credentials not configured, falling back to simulation');
      return await simulateMpesaPayment(payment, phoneNumber);
    }

    // Rate limiting for M-Pesa requests
    const mpesaKey = `mpesa-${phoneNumber}`;
    // In production, implement Redis-based rate limiting here

    // Initiate STK Push
    const stkResponse = await mpesaAPI.initiateSTKPush(
      phoneNumber,
      payment.amount,
      payment._id.toString(),
      `Payment for Order #${payment.order}`
    );

    // Update payment with M-Pesa details
    payment.mpesaDetails = {
      phoneNumber,
      checkoutRequestID: stkResponse.checkoutRequestID,
      merchantRequestID: stkResponse.merchantRequestID,
      responseCode: stkResponse.responseCode,
      responseDescription: stkResponse.responseDescription,
      customerMessage: stkResponse.customerMessage,
      timestamp: new Date(),
      securityChecks: {
        ipAddress: req?.ip || 'unknown',
        userAgent: req?.headers['user-agent'] || 'unknown',
        timestamp: new Date().toISOString()
      }
    };

    payment.status = 'processing';
    await payment.save();

    return {
      success: true,
      message: 'M-Pesa payment initiated successfully',
      data: {
        paymentId: payment._id,
        checkoutRequestID: stkResponse.checkoutRequestID,
        customerMessage: stkResponse.customerMessage,
        status: 'processing',
        instructions: 'Please check your phone and enter your M-Pesa PIN when prompted'
      }
    };
  } catch (error) {
    console.error('M-Pesa payment error:', error);
    
    // Update payment status to failed
    payment.status = 'failed';
    payment.failureReason = error.message;
    await payment.save();

    throw new ApiError(`M-Pesa payment failed: ${error.message}`, 400);
  }
}

// Payment simulation functions
async function simulateMpesaPayment(payment, phoneNumber) {
  // Simulate M-Pesa STK push
  const checkoutRequestId = `ws_CO_${Date.now()}`;
  const merchantRequestId = `29115-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

  // Update payment with M-Pesa details
  payment.mpesaDetails.checkoutRequestId = checkoutRequestId;
  payment.mpesaDetails.merchantRequestId = merchantRequestId;
  payment.status = 'processing';
  await payment.save();

  // Simulate successful payment after 3 seconds
  setTimeout(async () => {
    payment.status = 'completed';
    payment.processedAt = new Date();
    payment.mpesaDetails.resultCode = '0';
    payment.mpesaDetails.resultDesc = 'Success';
    await payment.save();

    // Update order status
    const order = await Order.findById(payment.order);
    if (order) {
      order.paymentStatus = 'paid';
      order.status = 'confirmed';
      await order.save();
    }
  }, 3000);

  return {
    checkoutRequestId,
    merchantRequestId,
    message: 'STK push sent to your phone. Please check your M-Pesa app.',
    status: 'processing'
  };
}

async function processAirtelMoneyPayment(payment, phoneNumber) {
  try {
    // Additional Airtel Money security checks
    if (!phoneNumber || !/^(\+254|0)?[17]\d{8}$/.test(phoneNumber)) {
      throw new ApiError('Invalid phone number format for Airtel Money', 400);
    }

    if (payment.amount < 1) {
      throw new ApiError('Airtel Money minimum amount is 1 KES', 400);
    }

    // Check for test numbers in production
    if (process.env.NODE_ENV === 'production') {
      const testNumbers = ['254700000000', '254700000001'];
      if (testNumbers.includes(phoneNumber)) {
        throw new ApiError('Test phone numbers not allowed in production', 400);
      }
    }

    const airtelAPI = new AirtelMoneyAPI();
    
    // Check if Airtel Money credentials are configured
    if (!airtelAPI.isConfigured()) {
      console.warn('Airtel Money credentials not configured, falling back to simulation');
      return await simulateAirtelMoneyPayment(payment, phoneNumber);
    }

    // Generate transaction reference
    const transactionRef = airtelAPI.generateTransactionRef();
    
    // Initiate Airtel Money payment
    const airtelResponse = await airtelAPI.initiatePayment(
      phoneNumber,
      payment.amount,
      transactionRef,
      `Payment for Order #${payment.order}`
    );

    // Update payment with Airtel Money details
    payment.airtelDetails = {
      phoneNumber,
      transactionId: airtelResponse.transactionId,
      transactionRef,
      status: airtelResponse.status,
      timestamp: new Date(),
      securityChecks: {
        ipAddress: req?.ip || 'unknown',
        userAgent: req?.headers['user-agent'] || 'unknown',
        timestamp: new Date().toISOString()
      }
    };

    payment.status = 'processing';
    await payment.save();

    return {
      success: true,
      message: 'Airtel Money payment initiated successfully',
      data: {
        paymentId: payment._id,
        transactionId: airtelResponse.transactionId,
        transactionRef,
        status: 'processing',
        instructions: 'Please check your phone and enter your Airtel Money PIN when prompted'
      }
    };
  } catch (error) {
    console.error('Airtel Money payment error:', error);
    
    // Update payment status to failed
    payment.status = 'failed';
    payment.failureReason = error.message;
    await payment.save();

    throw new ApiError(`Airtel Money payment failed: ${error.message}`, 400);
  }
}

async function simulateAirtelMoneyPayment(payment, phoneNumber) {
  // Simulate Airtel Money payment
  const transactionRef = `AIR_${Date.now()}_${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
  
  payment.airtelDetails = {
    phoneNumber,
    transactionRef,
    status: 'processing'
  };
  payment.status = 'processing';
  await payment.save();

  // Simulate successful payment after 2 seconds
  setTimeout(async () => {
    payment.status = 'completed';
    payment.processedAt = new Date();
    payment.airtelDetails.status = 'completed';
    payment.airtelDetails.transactionId = `TXN_${Date.now()}`;
    await payment.save();

    // Update order status
    const order = await Order.findById(payment.order);
    if (order) {
      order.paymentStatus = 'paid';
      order.status = 'confirmed';
      await order.save();
    }
  }, 2000);

  return {
    message: 'Payment request sent to Airtel Money. Please check your phone.',
    status: 'processing',
    transactionRef
  };
}

async function simulateEquitelPayment(payment, phoneNumber) {
  // Simulate Equitel payment
  payment.status = 'processing';
  await payment.save();

  // Simulate successful payment after 2.5 seconds
  setTimeout(async () => {
    payment.status = 'completed';
    payment.processedAt = new Date();
    await payment.save();

    // Update order status
    const order = await Order.findById(payment.order);
    if (order) {
      order.paymentStatus = 'paid';
      order.status = 'confirmed';
      await order.save();
    }
  }, 2500);

  return {
    message: 'Payment request sent to Equitel. Please check your phone.',
    status: 'processing'
  };
}

async function simulateCashPayment(payment) {
  // Cash payment is immediately completed
  payment.status = 'completed';
  payment.processedAt = new Date();
  await payment.save();

  // Update order status
  const order = await Order.findById(payment.order);
  if (order) {
    order.paymentStatus = 'paid';
    order.status = 'confirmed';
    await order.save();
  }

  return {
    message: 'Cash payment accepted. Pay on delivery.',
    status: 'completed'
  };
}

async function simulateCardPayment(payment) {
  // Simulate card payment processing
  payment.status = 'processing';
  await payment.save();

  // Simulate successful payment after 1.5 seconds
  setTimeout(async () => {
    payment.status = 'completed';
    payment.processedAt = new Date();
    payment.cardDetails = {
      cardType: 'Visa',
      last4Digits: '1234',
      maskedCardNumber: '**** **** **** 1234'
    };
    await payment.save();

    // Update order status
    const order = await Order.findById(payment.order);
    if (order) {
      order.paymentStatus = 'paid';
      order.status = 'confirmed';
      await order.save();
    }
  }, 1500);

  return {
    message: 'Processing card payment...',
    status: 'processing'
  };
}

async function processBankTransfer(payment) {
  // Generate unique reference number
  const referenceNumber = `ABAI_${Date.now()}_${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
  
  // Bank transfer requires manual confirmation
  payment.status = 'pending';
  payment.bankDetails = {
    bankName: 'Equity Bank Kenya',
    accountName: 'Abai Springs Limited',
    accountNumber: '1234567890',
    branchCode: '001',
    swiftCode: 'EQBLKENA',
    reference: referenceNumber,
    amount: payment.amount,
    currency: 'KES',
    instructions: [
      'Please include the reference number in your transfer description',
      'Transfer must be completed within 24 hours',
      'Contact us at +254 723 945 475 after transfer',
      'Keep your transfer receipt for verification'
    ],
    contactInfo: {
      phone: '+254 723 945 475',
      email: 'payments@abailodges.com',
      whatsapp: 'https://wa.me/254723945475'
    },
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  };
  
  await payment.save();

  return {
    success: true,
    message: 'Bank transfer details provided. Please complete the transfer within 24 hours.',
    status: 'pending',
    bankDetails: payment.bankDetails,
    instructions: [
      '1. Transfer the exact amount to the provided account',
      '2. Include the reference number in transfer description',
      '3. Contact us with your transfer receipt',
      '4. We will verify and confirm your payment'
    ]
  };
}

export default router;

