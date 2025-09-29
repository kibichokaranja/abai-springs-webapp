import mpesaService from './mpesaService.js';
import paypalService from './paypalService.js';
import stripeService from './stripeService.js';
import logger from '../../utils/logger.js';
import cacheManager from '../../utils/cache.js';

class PaymentGatewayService {
  constructor() {
    this.gateways = {
      mpesa: mpesaService,
      paypal: paypalService,
      stripe: stripeService
    };
    
    this.defaultGateway = 'mpesa'; // Primary gateway for Kenyan market
    this.fallbackOrder = ['mpesa', 'paypal', 'stripe'];
  }

  // Get available payment methods based on location and configuration
  async getAvailablePaymentMethods(customerData = {}) {
    try {
      const methods = [];
      
      // Check M-Pesa availability (primarily for Kenya)
      if (await this.isGatewayAvailable('mpesa')) {
        methods.push({
          id: 'mpesa',
          name: 'M-Pesa',
          type: 'mobile_money',
          description: 'Pay with M-Pesa mobile money',
          currency: 'KES',
          icon: 'mpesa-icon',
          processing_time: 'Instant',
          fees: 'Standard M-Pesa rates apply',
          countries: ['KE'],
          enabled: true
        });
      }

      // Check PayPal availability (international)
      if (await this.isGatewayAvailable('paypal')) {
        methods.push({
          id: 'paypal',
          name: 'PayPal',
          type: 'digital_wallet',
          description: 'Pay with PayPal account or card',
          currency: 'USD',
          icon: 'paypal-icon',
          processing_time: 'Instant',
          fees: 'PayPal fees apply',
          countries: ['US', 'EU', 'CA', 'AU', 'UK'],
          enabled: true
        });
      }

      // Check Stripe availability (international cards)
      if (await this.isGatewayAvailable('stripe')) {
        methods.push({
          id: 'stripe',
          name: 'Credit/Debit Card',
          type: 'card',
          description: 'Pay with Visa, Mastercard, or other cards',
          currency: 'USD',
          icon: 'card-icon',
          processing_time: 'Instant',
          fees: 'Standard card processing fees',
          countries: ['GLOBAL'],
          enabled: true
        });
      }

      logger.info('Available payment methods retrieved', {
        customerCountry: customerData.country,
        methodCount: methods.length,
        methods: methods.map(m => m.id)
      });

      return {
        success: true,
        methods: methods,
        defaultMethod: this.getDefaultMethodForCountry(customerData.country),
        recommendedMethod: this.getRecommendedMethod(customerData)
      };
    } catch (error) {
      logger.error('Failed to get available payment methods:', error);
      throw new Error('Failed to retrieve payment methods');
    }
  }

  // Process payment with automatic gateway selection
  async processPayment(paymentData, preferredGateway = null) {
    try {
      const gateway = preferredGateway || this.selectOptimalGateway(paymentData);
      
      logger.info('Processing payment', {
        orderId: paymentData.orderId,
        amount: paymentData.amount,
        currency: paymentData.currency,
        gateway: gateway,
        paymentMethod: paymentData.paymentMethod
      });

      // Route to appropriate gateway
      let result;
      switch (gateway) {
        case 'mpesa':
          result = await this.processMpesaPayment(paymentData);
          break;
        case 'paypal':
          result = await this.processPayPalPayment(paymentData);
          break;
        case 'stripe':
          result = await this.processStripePayment(paymentData);
          break;
        default:
          throw new Error(`Unsupported payment gateway: ${gateway}`);
      }

      // Store payment record
      const paymentRecord = {
        orderId: paymentData.orderId,
        customerId: paymentData.customerId,
        gateway: gateway,
        amount: paymentData.amount,
        currency: paymentData.currency,
        status: result.status || 'pending',
        gatewayTransactionId: result.transactionId,
        processedAt: new Date(),
        metadata: result.metadata || {}
      };

      await this.storePaymentRecord(paymentRecord);

      logger.info('Payment processed successfully', {
        orderId: paymentData.orderId,
        gateway: gateway,
        transactionId: result.transactionId,
        status: result.status
      });

      return {
        success: true,
        gateway: gateway,
        ...result
      };
    } catch (error) {
      logger.error('Payment processing failed:', error);
      
      // Try fallback gateway if primary fails
      if (!preferredGateway && this.shouldTryFallback(error)) {
        logger.info('Attempting fallback payment processing');
        return await this.processFallbackPayment(paymentData, gateway);
      }
      
      throw error;
    }
  }

  // Process M-Pesa payment
  async processMpesaPayment(paymentData) {
    try {
      if (paymentData.paymentMethod === 'mpesa_stk') {
        const result = await mpesaService.initiateSTKPush(
          paymentData.phoneNumber,
          paymentData.amount,
          `ABAI-${paymentData.orderId}`,
          `Abai Springs Order ${paymentData.orderId}`,
          paymentData.orderId
        );

        return {
          status: 'pending',
          transactionId: result.checkoutRequestId,
          paymentUrl: null,
          requiresAction: true,
          actionType: 'mpesa_stk_prompt',
          message: result.customerMessage,
          metadata: {
            checkoutRequestId: result.checkoutRequestId,
            merchantRequestId: result.merchantRequestId
          }
        };
      } else {
        throw new Error('Unsupported M-Pesa payment method');
      }
    } catch (error) {
      logger.error('M-Pesa payment failed:', error);
      throw new Error(`M-Pesa payment failed: ${error.message}`);
    }
  }

  // Process PayPal payment
  async processPayPalPayment(paymentData) {
    try {
      const orderData = {
        orderId: paymentData.orderId,
        amount: paymentData.amount,
        currency: paymentData.currency || 'USD',
        description: `Abai Springs Order ${paymentData.orderId}`,
        shipping: paymentData.shipping
      };

      const result = await paypalService.createOrder(orderData);

      return {
        status: 'pending',
        transactionId: result.paypalOrderId,
        paymentUrl: result.approvalUrl,
        requiresAction: true,
        actionType: 'redirect',
        message: 'Please complete payment on PayPal',
        metadata: {
          paypalOrderId: result.paypalOrderId
        }
      };
    } catch (error) {
      logger.error('PayPal payment failed:', error);
      throw new Error(`PayPal payment failed: ${error.message}`);
    }
  }

  // Process Stripe payment
  async processStripePayment(paymentData) {
    try {
      const intentData = {
        orderId: paymentData.orderId,
        customerId: paymentData.customerId,
        customerEmail: paymentData.customerEmail,
        amount: paymentData.amount,
        currency: paymentData.currency || 'usd',
        description: `Abai Springs Order ${paymentData.orderId}`,
        shipping: paymentData.shipping
      };

      const result = await stripeService.createPaymentIntent(intentData);

      return {
        status: 'pending',
        transactionId: result.paymentIntentId,
        clientSecret: result.clientSecret,
        requiresAction: true,
        actionType: 'client_secret',
        message: 'Complete payment with card details',
        metadata: {
          paymentIntentId: result.paymentIntentId
        }
      };
    } catch (error) {
      logger.error('Stripe payment failed:', error);
      throw new Error(`Stripe payment failed: ${error.message}`);
    }
  }

  // Process fallback payment
  async processFallbackPayment(paymentData, failedGateway) {
    try {
      const fallbackGateways = this.fallbackOrder.filter(g => g !== failedGateway);
      
      for (const gateway of fallbackGateways) {
        if (await this.isGatewayAvailable(gateway)) {
          logger.info('Attempting fallback payment', { gateway, failedGateway });
          
          try {
            return await this.processPayment(paymentData, gateway);
          } catch (fallbackError) {
            logger.warn('Fallback gateway also failed', { gateway, error: fallbackError.message });
            continue;
          }
        }
      }
      
      throw new Error('All payment gateways failed');
    } catch (error) {
      logger.error('Fallback payment processing failed:', error);
      throw error;
    }
  }

  // Check payment status across all gateways
  async checkPaymentStatus(orderId, gateway, transactionId) {
    try {
      let result;
      
      switch (gateway) {
        case 'mpesa':
          result = await mpesaService.checkSTKPushStatus(transactionId);
          break;
        case 'paypal':
          result = await paypalService.getOrderDetails(transactionId);
          break;
        case 'stripe':
          result = await stripeService.getPaymentIntent(transactionId);
          break;
        default:
          throw new Error(`Unsupported gateway: ${gateway}`);
      }

      // Update payment record
      await this.updatePaymentRecord(orderId, {
        status: result.status,
        updatedAt: new Date(),
        gatewayResponse: result
      });

      logger.info('Payment status checked', {
        orderId: orderId,
        gateway: gateway,
        transactionId: transactionId,
        status: result.status
      });

      return {
        success: true,
        status: result.status,
        gateway: gateway,
        transactionId: transactionId,
        data: result
      };
    } catch (error) {
      logger.error('Payment status check failed:', error);
      throw new Error(`Failed to check payment status: ${error.message}`);
    }
  }

  // Process refund
  async processRefund(refundData) {
    try {
      const { orderId, gateway, transactionId, amount, reason } = refundData;
      
      let result;
      
      switch (gateway) {
        case 'mpesa':
          // M-Pesa uses B2C for refunds
          result = await mpesaService.initiateB2C(
            refundData.phoneNumber,
            amount,
            'BusinessPayment',
            reason || 'Order refund'
          );
          break;
        case 'paypal':
          result = await paypalService.refundPayment(transactionId, amount, reason);
          break;
        case 'stripe':
          result = await stripeService.createRefund(transactionId, amount, reason);
          break;
        default:
          throw new Error(`Refunds not supported for gateway: ${gateway}`);
      }

      // Store refund record
      const refundRecord = {
        orderId: orderId,
        originalTransactionId: transactionId,
        refundTransactionId: result.refundId || result.conversationId,
        gateway: gateway,
        amount: amount,
        reason: reason,
        status: result.status || 'pending',
        processedAt: new Date()
      };

      await this.storeRefundRecord(refundRecord);

      logger.info('Refund processed', {
        orderId: orderId,
        gateway: gateway,
        amount: amount,
        refundId: result.refundId || result.conversationId
      });

      return {
        success: true,
        refundId: result.refundId || result.conversationId,
        status: result.status || 'pending',
        gateway: gateway
      };
    } catch (error) {
      logger.error('Refund processing failed:', error);
      throw new Error(`Refund failed: ${error.message}`);
    }
  }

  // Process webhook from any gateway
  async processWebhook(gateway, headers, body) {
    try {
      let result;
      
      switch (gateway) {
        case 'mpesa':
          result = await mpesaService.processSTKCallback(body);
          break;
        case 'paypal':
          result = await paypalService.processWebhookEvent(body.event_type, body);
          break;
        case 'stripe':
          result = await stripeService.processWebhook(body, headers['stripe-signature']);
          break;
        default:
          throw new Error(`Webhook not supported for gateway: ${gateway}`);
      }

      logger.info('Webhook processed', {
        gateway: gateway,
        processed: result.processed,
        action: result.action
      });

      return result;
    } catch (error) {
      logger.error('Webhook processing failed:', error);
      throw error;
    }
  }

  // Helper methods
  async isGatewayAvailable(gateway) {
    try {
      const healthCheck = await this.gateways[gateway]?.healthCheck();
      return healthCheck?.status === 'healthy';
    } catch (error) {
      return false;
    }
  }

  selectOptimalGateway(paymentData) {
    // Select gateway based on currency, country, and amount
    if (paymentData.currency === 'KES' || paymentData.country === 'KE') {
      return 'mpesa';
    }
    
    if (paymentData.amount > 1000 && paymentData.currency === 'USD') {
      return 'paypal'; // Better for large international transactions
    }
    
    return 'stripe'; // Default for card payments
  }

  getDefaultMethodForCountry(country) {
    const countryDefaults = {
      'KE': 'mpesa',
      'US': 'stripe',
      'CA': 'stripe',
      'GB': 'stripe',
      'AU': 'stripe',
      'EU': 'paypal'
    };
    
    return countryDefaults[country] || 'stripe';
  }

  getRecommendedMethod(customerData) {
    // AI-based recommendation logic could go here
    // For now, use simple rules
    if (customerData.country === 'KE') {
      return 'mpesa';
    }
    
    if (customerData.hasPayPalAccount) {
      return 'paypal';
    }
    
    return 'stripe';
  }

  shouldTryFallback(error) {
    // Determine if error warrants trying a fallback gateway
    const fallbackErrors = [
      'gateway unavailable',
      'service temporarily unavailable',
      'timeout',
      'network error'
    ];
    
    return fallbackErrors.some(pattern => 
      error.message.toLowerCase().includes(pattern)
    );
  }

  // Payment record management
  async storePaymentRecord(paymentRecord) {
    try {
      const key = `payment_record:${paymentRecord.orderId}`;
      await cacheManager.set(key, paymentRecord, 24 * 60 * 60); // 24 hours
      
      // Also trigger database storage event here
      logger.info('Payment record stored', { orderId: paymentRecord.orderId });
    } catch (error) {
      logger.error('Failed to store payment record:', error);
    }
  }

  async updatePaymentRecord(orderId, updates) {
    try {
      const key = `payment_record:${orderId}`;
      const record = await cacheManager.get(key);
      
      if (record) {
        Object.assign(record, updates);
        await cacheManager.set(key, record, 24 * 60 * 60);
      }
      
      logger.info('Payment record updated', { orderId });
    } catch (error) {
      logger.error('Failed to update payment record:', error);
    }
  }

  async storeRefundRecord(refundRecord) {
    try {
      const key = `refund_record:${refundRecord.orderId}:${refundRecord.refundTransactionId}`;
      await cacheManager.set(key, refundRecord, 24 * 60 * 60);
      
      logger.info('Refund record stored', { orderId: refundRecord.orderId });
    } catch (error) {
      logger.error('Failed to store refund record:', error);
    }
  }

  // Gateway health check
  async getGatewayStatus() {
    try {
      const statuses = {};
      
      for (const [name, gateway] of Object.entries(this.gateways)) {
        try {
          statuses[name] = await gateway.healthCheck();
        } catch (error) {
          statuses[name] = {
            status: 'error',
            message: error.message,
            configured: false
          };
        }
      }
      
      return {
        success: true,
        gateways: statuses,
        overall: Object.values(statuses).some(s => s.status === 'healthy') ? 'operational' : 'degraded'
      };
    } catch (error) {
      logger.error('Gateway status check failed:', error);
      throw new Error('Failed to check gateway status');
    }
  }

  // Get payment analytics
  async getPaymentAnalytics(timeRange = '24h') {
    try {
      // This would typically query the database
      // For now, return mock analytics
      const analytics = {
        totalTransactions: 0,
        totalAmount: 0,
        successRate: 0,
        gatewayBreakdown: {},
        averageTransactionTime: 0,
        topFailureReasons: [],
        timeRange: timeRange
      };
      
      logger.info('Payment analytics retrieved', { timeRange });
      return analytics;
    } catch (error) {
      logger.error('Failed to get payment analytics:', error);
      throw new Error('Failed to retrieve payment analytics');
    }
  }
}

export default new PaymentGatewayService();










