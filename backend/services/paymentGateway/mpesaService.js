import axios from 'axios';
import crypto from 'crypto';
import { Buffer } from 'buffer';
import cacheManager from '../../utils/cache.js';
import logger from '../../utils/logger.js';

class MpesaService {
  constructor() {
    this.consumerKey = process.env.MPESA_CONSUMER_KEY;
    this.consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    this.passkey = process.env.MPESA_PASSKEY;
    this.shortcode = process.env.MPESA_SHORTCODE;
    this.initiatorName = process.env.MPESA_INITIATOR_NAME;
    this.securityCredential = process.env.MPESA_SECURITY_CREDENTIAL;
    this.environment = process.env.MPESA_ENVIRONMENT || 'sandbox';
    
    this.baseUrl = this.environment === 'production' 
      ? 'https://api.safaricom.co.ke' 
      : 'https://sandbox.safaricom.co.ke';
    
    this.callbackUrl = process.env.MPESA_CALLBACK_URL || 'https://yourdomain.com/api/payments/mpesa/callback';
    this.timeoutUrl = process.env.MPESA_TIMEOUT_URL || 'https://yourdomain.com/api/payments/mpesa/timeout';
    
    this.isConfigured = !!(this.consumerKey && this.consumerSecret && this.shortcode);
    
    if (!this.isConfigured) {
      logger.warn('M-Pesa not fully configured - some features will not be available');
    }
  }

  // Generate OAuth access token
  async getAccessToken() {
    try {
      const cacheKey = 'mpesa_access_token';
      let token = await cacheManager.get(cacheKey);
      
      if (token) {
        return token;
      }

      const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
      
      const response = await axios.get(`${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        }
      });

      token = response.data.access_token;
      const expiresIn = response.data.expires_in - 60; // Cache for slightly less time than actual expiry
      
      await cacheManager.set(cacheKey, token, expiresIn);
      
      logger.info('M-Pesa access token generated successfully');
      return token;
    } catch (error) {
      logger.error('Failed to get M-Pesa access token:', error);
      throw new Error('M-Pesa authentication failed');
    }
  }

  // Generate password for STK Push
  generatePassword() {
    const timestamp = this.getTimestamp();
    const password = Buffer.from(`${this.shortcode}${this.passkey}${timestamp}`).toString('base64');
    return { password, timestamp };
  }

  // Get current timestamp in required format
  getTimestamp() {
    const now = new Date();
    return now.getFullYear() +
           String(now.getMonth() + 1).padStart(2, '0') +
           String(now.getDate()).padStart(2, '0') +
           String(now.getHours()).padStart(2, '0') +
           String(now.getMinutes()).padStart(2, '0') +
           String(now.getSeconds()).padStart(2, '0');
  }

  // Initiate STK Push payment
  async initiateSTKPush(phoneNumber, amount, accountReference, transactionDesc, orderId) {
    try {
      if (!this.isConfigured) {
        throw new Error('M-Pesa not configured');
      }

      const accessToken = await this.getAccessToken();
      const { password, timestamp } = this.generatePassword();
      
      // Normalize phone number
      const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
      
      const requestBody = {
        BusinessShortCode: this.shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(amount), // Ensure amount is integer
        PartyA: normalizedPhone,
        PartyB: this.shortcode,
        PhoneNumber: normalizedPhone,
        CallBackURL: `${this.callbackUrl}?orderId=${orderId}`,
        AccountReference: accountReference || `ABAI-${orderId}`,
        TransactionDesc: transactionDesc || `Abai Springs Water Payment - Order ${orderId}`
      };

      const response = await axios.post(
        `${this.baseUrl}/mpesa/stkpush/v1/processrequest`,
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.ResponseCode === '0') {
        // Store STK push details for tracking
        const stkData = {
          checkoutRequestId: response.data.CheckoutRequestID,
          merchantRequestId: response.data.MerchantRequestID,
          orderId: orderId,
          phoneNumber: normalizedPhone,
          amount: amount,
          accountReference: accountReference,
          status: 'pending',
          initiatedAt: new Date(),
          expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes timeout
        };

        await cacheManager.set(
          `stk_push:${response.data.CheckoutRequestID}`, 
          stkData, 
          5 * 60 // 5 minutes
        );

        logger.info('STK Push initiated successfully', {
          checkoutRequestId: response.data.CheckoutRequestID,
          orderId: orderId,
          amount: amount,
          phoneNumber: normalizedPhone.replace(/(\d{3})\d{6}(\d{3})/, '$1****$2')
        });

        return {
          success: true,
          checkoutRequestId: response.data.CheckoutRequestID,
          merchantRequestId: response.data.MerchantRequestID,
          customerMessage: response.data.CustomerMessage,
          responseCode: response.data.ResponseCode
        };
      } else {
        throw new Error(response.data.ResponseDescription || 'STK Push failed');
      }
    } catch (error) {
      logger.error('STK Push initiation failed:', error);
      throw new Error(error.response?.data?.ResponseDescription || error.message || 'STK Push failed');
    }
  }

  // Check STK Push status
  async checkSTKPushStatus(checkoutRequestId) {
    try {
      const accessToken = await this.getAccessToken();
      const { password, timestamp } = this.generatePassword();

      const requestBody = {
        BusinessShortCode: this.shortcode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId
      };

      const response = await axios.post(
        `${this.baseUrl}/mpesa/stkpushquery/v1/query`,
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info('STK Push status checked', {
        checkoutRequestId: checkoutRequestId,
        resultCode: response.data.ResultCode,
        resultDesc: response.data.ResultDesc
      });

      return {
        checkoutRequestId: checkoutRequestId,
        resultCode: response.data.ResultCode,
        resultDesc: response.data.ResultDesc,
        status: this.mapResultCodeToStatus(response.data.ResultCode)
      };
    } catch (error) {
      logger.error('STK Push status check failed:', error);
      throw new Error('Failed to check payment status');
    }
  }

  // Process STK Push callback
  async processSTKCallback(callbackData) {
    try {
      const { Body } = callbackData;
      const { stkCallback } = Body;
      
      const checkoutRequestId = stkCallback.CheckoutRequestID;
      const merchantRequestId = stkCallback.MerchantRequestID;
      const resultCode = stkCallback.ResultCode;
      const resultDesc = stkCallback.ResultDesc;

      // Get stored STK data
      const stkData = await cacheManager.get(`stk_push:${checkoutRequestId}`);
      
      if (!stkData) {
        logger.warn('STK callback received for unknown checkout request', { checkoutRequestId });
        return { processed: false, reason: 'Unknown checkout request' };
      }

      let paymentData = {
        checkoutRequestId,
        merchantRequestId,
        resultCode,
        resultDesc,
        orderId: stkData.orderId,
        phoneNumber: stkData.phoneNumber,
        amount: stkData.amount,
        status: this.mapResultCodeToStatus(resultCode),
        processedAt: new Date()
      };

      // If payment was successful, extract transaction details
      if (resultCode === 0 && stkCallback.CallbackMetadata) {
        const metadata = stkCallback.CallbackMetadata.Item;
        
        paymentData.mpesaReceiptNumber = this.getMetadataValue(metadata, 'MpesaReceiptNumber');
        paymentData.transactionDate = this.getMetadataValue(metadata, 'TransactionDate');
        paymentData.phoneNumber = this.getMetadataValue(metadata, 'PhoneNumber');
        paymentData.amount = this.getMetadataValue(metadata, 'Amount');
      }

      // Update STK data in cache
      await cacheManager.set(`stk_push:${checkoutRequestId}`, paymentData, 24 * 60 * 60); // Keep for 24 hours

      logger.info('STK Push callback processed', {
        checkoutRequestId,
        orderId: stkData.orderId,
        resultCode,
        status: paymentData.status,
        mpesaReceiptNumber: paymentData.mpesaReceiptNumber
      });

      return {
        processed: true,
        paymentData
      };
    } catch (error) {
      logger.error('STK callback processing failed:', error);
      return { processed: false, error: error.message };
    }
  }

  // Initiate B2C payment (for refunds, cashbacks)
  async initiateB2C(phoneNumber, amount, commandId = 'BusinessPayment', remarks = 'Abai Springs Refund') {
    try {
      if (!this.isConfigured) {
        throw new Error('M-Pesa not configured');
      }

      const accessToken = await this.getAccessToken();
      const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

      const requestBody = {
        InitiatorName: this.initiatorName,
        SecurityCredential: this.securityCredential,
        CommandID: commandId, // BusinessPayment, SalaryPayment, PromotionPayment
        Amount: Math.round(amount),
        PartyA: this.shortcode,
        PartyB: normalizedPhone,
        Remarks: remarks,
        QueueTimeOutURL: this.timeoutUrl,
        ResultURL: this.callbackUrl,
        Occasion: 'Abai Springs B2C Transaction'
      };

      const response = await axios.post(
        `${this.baseUrl}/mpesa/b2c/v1/paymentrequest`,
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.ResponseCode === '0') {
        logger.info('B2C payment initiated successfully', {
          conversationId: response.data.ConversationID,
          originatorConversationId: response.data.OriginatorConversationID,
          amount: amount,
          phoneNumber: normalizedPhone.replace(/(\d{3})\d{6}(\d{3})/, '$1****$2')
        });

        return {
          success: true,
          conversationId: response.data.ConversationID,
          originatorConversationId: response.data.OriginatorConversationID,
          responseDescription: response.data.ResponseDescription
        };
      } else {
        throw new Error(response.data.ResponseDescription || 'B2C payment failed');
      }
    } catch (error) {
      logger.error('B2C payment initiation failed:', error);
      throw new Error(error.response?.data?.ResponseDescription || error.message || 'B2C payment failed');
    }
  }

  // Check account balance
  async checkAccountBalance() {
    try {
      if (!this.isConfigured) {
        throw new Error('M-Pesa not configured');
      }

      const accessToken = await this.getAccessToken();

      const requestBody = {
        Initiator: this.initiatorName,
        SecurityCredential: this.securityCredential,
        CommandID: 'AccountBalance',
        PartyA: this.shortcode,
        IdentifierType: '4', // Organization shortcode
        Remarks: 'Account balance inquiry',
        QueueTimeOutURL: this.timeoutUrl,
        ResultURL: this.callbackUrl
      };

      const response = await axios.post(
        `${this.baseUrl}/mpesa/accountbalance/v1/query`,
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info('Account balance check initiated', {
        conversationId: response.data.ConversationID,
        responseCode: response.data.ResponseCode
      });

      return {
        success: true,
        conversationId: response.data.ConversationID,
        originatorConversationId: response.data.OriginatorConversationID,
        responseDescription: response.data.ResponseDescription
      };
    } catch (error) {
      logger.error('Account balance check failed:', error);
      throw new Error(error.response?.data?.ResponseDescription || error.message || 'Balance check failed');
    }
  }

  // Reverse transaction
  async reverseTransaction(transactionId, amount, remarks = 'Transaction reversal') {
    try {
      if (!this.isConfigured) {
        throw new Error('M-Pesa not configured');
      }

      const accessToken = await this.getAccessToken();

      const requestBody = {
        Initiator: this.initiatorName,
        SecurityCredential: this.securityCredential,
        CommandID: 'TransactionReversal',
        TransactionID: transactionId,
        Amount: Math.round(amount),
        ReceiverParty: this.shortcode,
        ReceiverIdentifierType: '11', // Shortcode
        Remarks: remarks,
        QueueTimeOutURL: this.timeoutUrl,
        ResultURL: this.callbackUrl,
        Occasion: 'Abai Springs Transaction Reversal'
      };

      const response = await axios.post(
        `${this.baseUrl}/mpesa/reversal/v1/request`,
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info('Transaction reversal initiated', {
        conversationId: response.data.ConversationID,
        transactionId: transactionId,
        amount: amount
      });

      return {
        success: true,
        conversationId: response.data.ConversationID,
        originatorConversationId: response.data.OriginatorConversationID,
        responseDescription: response.data.ResponseDescription
      };
    } catch (error) {
      logger.error('Transaction reversal failed:', error);
      throw new Error(error.response?.data?.ResponseDescription || error.message || 'Reversal failed');
    }
  }

  // Helper methods
  normalizePhoneNumber(phoneNumber) {
    // Remove all non-digit characters
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // Handle Kenyan numbers
    if (cleaned.startsWith('254')) {
      return cleaned;
    } else if (cleaned.startsWith('0')) {
      return '254' + cleaned.substring(1);
    } else if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
      return '254' + cleaned;
    }
    
    // For other numbers, assume they're already formatted
    return cleaned;
  }

  mapResultCodeToStatus(resultCode) {
    const statusMap = {
      0: 'completed',
      1: 'failed', // Insufficient funds
      17: 'cancelled', // User cancelled
      26: 'failed', // Invalid phone number
      1001: 'failed', // Unable to lock subscriber
      1019: 'timeout', // Transaction timeout
      1037: 'timeout', // User timeout
      1032: 'cancelled', // User cancelled
      1025: 'failed', // Unable to complete transaction
      2001: 'failed' // Invalid amount
    };

    return statusMap[resultCode] || 'pending';
  }

  getMetadataValue(metadata, name) {
    const item = metadata.find(item => item.Name === name);
    return item ? item.Value : null;
  }

  // Validate phone number
  isValidKenyanPhoneNumber(phoneNumber) {
    const normalized = this.normalizePhoneNumber(phoneNumber);
    return /^254[17]\d{8}$/.test(normalized);
  }

  // Get transaction cost (for display purposes)
  getTransactionCost(amount) {
    // M-Pesa transaction costs (as of 2024 - should be updated regularly)
    if (amount <= 100) return 0;
    if (amount <= 500) return 5;
    if (amount <= 1000) return 10;
    if (amount <= 1500) return 15;
    if (amount <= 2500) return 20;
    if (amount <= 3500) return 25;
    if (amount <= 5000) return 30;
    if (amount <= 7500) return 35;
    if (amount <= 10000) return 40;
    if (amount <= 15000) return 45;
    if (amount <= 20000) return 50;
    if (amount <= 25000) return 55;
    if (amount <= 30000) return 60;
    if (amount <= 35000) return 65;
    if (amount <= 40000) return 70;
    if (amount <= 45000) return 75;
    if (amount <= 50000) return 80;
    return 105; // Above 50000
  }

  // Health check
  async healthCheck() {
    try {
      if (!this.isConfigured) {
        return { 
          status: 'warning', 
          message: 'M-Pesa not configured',
          configured: false
        };
      }

      const token = await this.getAccessToken();
      return { 
        status: 'healthy', 
        message: 'M-Pesa service operational',
        configured: true,
        environment: this.environment
      };
    } catch (error) {
      return { 
        status: 'error', 
        message: error.message,
        configured: this.isConfigured
      };
    }
  }
}

export default new MpesaService();










