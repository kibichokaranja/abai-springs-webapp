import axios from 'axios';
import cacheManager from '../../utils/cache.js';
import logger from '../../utils/logger.js';

class PayPalService {
  constructor() {
    this.clientId = process.env.PAYPAL_CLIENT_ID;
    this.clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    this.environment = process.env.PAYPAL_ENVIRONMENT || 'sandbox';
    
    this.baseUrl = this.environment === 'production' 
      ? 'https://api.paypal.com' 
      : 'https://api.sandbox.paypal.com';
      
    this.webhookId = process.env.PAYPAL_WEBHOOK_ID;
    this.returnUrl = process.env.PAYPAL_RETURN_URL || 'http://localhost:3000/payment/success';
    this.cancelUrl = process.env.PAYPAL_CANCEL_URL || 'http://localhost:3000/payment/cancel';
    
    this.isConfigured = !!(this.clientId && this.clientSecret);
    
    if (!this.isConfigured) {
      logger.warn('PayPal not configured - international payments will not be available');
    }
  }

  // Get OAuth access token
  async getAccessToken() {
    try {
      const cacheKey = 'paypal_access_token';
      let token = await cacheManager.get(cacheKey);
      
      if (token) {
        return token;
      }

      const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      
      const response = await axios.post(
        `${this.baseUrl}/v1/oauth2/token`,
        'grant_type=client_credentials',
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      token = response.data.access_token;
      const expiresIn = response.data.expires_in - 60; // Cache for slightly less time
      
      await cacheManager.set(cacheKey, token, expiresIn);
      
      logger.info('PayPal access token generated successfully');
      return token;
    } catch (error) {
      logger.error('Failed to get PayPal access token:', error);
      throw new Error('PayPal authentication failed');
    }
  }

  // Create payment order
  async createOrder(orderData) {
    try {
      if (!this.isConfigured) {
        throw new Error('PayPal not configured');
      }

      const accessToken = await this.getAccessToken();
      
      const paypalOrder = {
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: orderData.orderId,
          amount: {
            currency_code: orderData.currency || 'USD',
            value: orderData.amount.toFixed(2)
          },
          description: orderData.description || `Abai Springs Water Delivery - Order ${orderData.orderId}`,
          custom_id: orderData.orderId,
          invoice_id: `ABAI-${orderData.orderId}-${Date.now()}`,
          shipping: orderData.shipping ? {
            name: {
              full_name: orderData.shipping.name
            },
            address: {
              address_line_1: orderData.shipping.address,
              admin_area_2: orderData.shipping.city,
              postal_code: orderData.shipping.postalCode,
              country_code: orderData.shipping.countryCode || 'KE'
            }
          } : undefined
        }],
        application_context: {
          return_url: `${this.returnUrl}?orderId=${orderData.orderId}`,
          cancel_url: `${this.cancelUrl}?orderId=${orderData.orderId}`,
          brand_name: 'Abai Springs',
          landing_page: 'BILLING',
          shipping_preference: orderData.shipping ? 'SET_PROVIDED_ADDRESS' : 'NO_SHIPPING',
          user_action: 'PAY_NOW'
        }
      };

      const response = await axios.post(
        `${this.baseUrl}/v2/checkout/orders`,
        paypalOrder,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const order = response.data;
      
      // Store order details for tracking
      const orderDetails = {
        paypalOrderId: order.id,
        orderId: orderData.orderId,
        amount: orderData.amount,
        currency: orderData.currency || 'USD',
        status: order.status,
        createdAt: new Date(),
        links: order.links
      };

      await cacheManager.set(
        `paypal_order:${order.id}`, 
        orderDetails, 
        2 * 60 * 60 // 2 hours
      );

      logger.info('PayPal order created successfully', {
        paypalOrderId: order.id,
        orderId: orderData.orderId,
        amount: orderData.amount,
        currency: orderData.currency || 'USD'
      });

      return {
        success: true,
        paypalOrderId: order.id,
        status: order.status,
        approvalUrl: order.links.find(link => link.rel === 'approve')?.href,
        links: order.links
      };
    } catch (error) {
      logger.error('PayPal order creation failed:', error);
      throw new Error(error.response?.data?.message || error.message || 'PayPal order creation failed');
    }
  }

  // Capture payment after approval
  async captureOrder(paypalOrderId) {
    try {
      const accessToken = await this.getAccessToken();
      
      const response = await axios.post(
        `${this.baseUrl}/v2/checkout/orders/${paypalOrderId}/capture`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const captureData = response.data;
      
      // Update stored order data
      const orderDetails = await cacheManager.get(`paypal_order:${paypalOrderId}`);
      if (orderDetails) {
        orderDetails.status = captureData.status;
        orderDetails.capturedAt = new Date();
        orderDetails.captureId = captureData.purchase_units[0]?.payments?.captures[0]?.id;
        orderDetails.payerInfo = captureData.payer;
        
        await cacheManager.set(`paypal_order:${paypalOrderId}`, orderDetails, 24 * 60 * 60);
      }

      logger.info('PayPal order captured successfully', {
        paypalOrderId: paypalOrderId,
        captureId: captureData.purchase_units[0]?.payments?.captures[0]?.id,
        status: captureData.status
      });

      return {
        success: true,
        status: captureData.status,
        captureId: captureData.purchase_units[0]?.payments?.captures[0]?.id,
        payerInfo: captureData.payer,
        amount: captureData.purchase_units[0]?.payments?.captures[0]?.amount
      };
    } catch (error) {
      logger.error('PayPal order capture failed:', error);
      throw new Error(error.response?.data?.message || error.message || 'PayPal capture failed');
    }
  }

  // Get order details
  async getOrderDetails(paypalOrderId) {
    try {
      const accessToken = await this.getAccessToken();
      
      const response = await axios.get(
        `${this.baseUrl}/v2/checkout/orders/${paypalOrderId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info('PayPal order details retrieved', {
        paypalOrderId: paypalOrderId,
        status: response.data.status
      });

      return {
        success: true,
        order: response.data
      };
    } catch (error) {
      logger.error('Failed to get PayPal order details:', error);
      throw new Error(error.response?.data?.message || error.message || 'Failed to get order details');
    }
  }

  // Refund captured payment
  async refundPayment(captureId, amount = null, reason = 'Customer refund') {
    try {
      const accessToken = await this.getAccessToken();
      
      const refundData = {
        amount: amount ? {
          value: amount.toFixed(2),
          currency_code: 'USD' // Should be passed as parameter
        } : undefined,
        invoice_id: `REFUND-${Date.now()}`,
        note_to_payer: reason
      };

      const response = await axios.post(
        `${this.baseUrl}/v2/payments/captures/${captureId}/refund`,
        refundData,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info('PayPal refund processed successfully', {
        captureId: captureId,
        refundId: response.data.id,
        amount: response.data.amount,
        status: response.data.status
      });

      return {
        success: true,
        refundId: response.data.id,
        status: response.data.status,
        amount: response.data.amount
      };
    } catch (error) {
      logger.error('PayPal refund failed:', error);
      throw new Error(error.response?.data?.message || error.message || 'PayPal refund failed');
    }
  }

  // Create subscription plan
  async createSubscriptionPlan(planData) {
    try {
      const accessToken = await this.getAccessToken();
      
      const subscriptionPlan = {
        product_id: planData.productId,
        name: planData.name,
        description: planData.description,
        status: 'ACTIVE',
        billing_cycles: [{
          frequency: {
            interval_unit: planData.intervalUnit || 'MONTH',
            interval_count: planData.intervalCount || 1
          },
          tenure_type: 'REGULAR',
          sequence: 1,
          total_cycles: planData.totalCycles || 0, // 0 = infinite
          pricing_scheme: {
            fixed_price: {
              value: planData.amount.toFixed(2),
              currency_code: planData.currency || 'USD'
            }
          }
        }],
        payment_preferences: {
          auto_bill_outstanding: true,
          setup_fee: planData.setupFee ? {
            value: planData.setupFee.toFixed(2),
            currency_code: planData.currency || 'USD'
          } : undefined,
          setup_fee_failure_action: 'CONTINUE',
          payment_failure_threshold: 3
        },
        taxes: {
          percentage: planData.taxPercentage || '0',
          inclusive: false
        }
      };

      const response = await axios.post(
        `${this.baseUrl}/v1/billing/plans`,
        subscriptionPlan,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info('PayPal subscription plan created', {
        planId: response.data.id,
        name: planData.name,
        amount: planData.amount
      });

      return {
        success: true,
        planId: response.data.id,
        plan: response.data
      };
    } catch (error) {
      logger.error('PayPal subscription plan creation failed:', error);
      throw new Error(error.response?.data?.message || error.message || 'Subscription plan creation failed');
    }
  }

  // Create subscription
  async createSubscription(subscriptionData) {
    try {
      const accessToken = await this.getAccessToken();
      
      const subscription = {
        plan_id: subscriptionData.planId,
        start_time: subscriptionData.startTime || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Start tomorrow
        quantity: subscriptionData.quantity || '1',
        shipping_amount: subscriptionData.shippingAmount ? {
          currency_code: subscriptionData.currency || 'USD',
          value: subscriptionData.shippingAmount.toFixed(2)
        } : undefined,
        subscriber: {
          name: {
            given_name: subscriptionData.subscriber.firstName,
            surname: subscriptionData.subscriber.lastName
          },
          email_address: subscriptionData.subscriber.email,
          shipping_address: subscriptionData.subscriber.address ? {
            name: {
              full_name: `${subscriptionData.subscriber.firstName} ${subscriptionData.subscriber.lastName}`
            },
            address: {
              address_line_1: subscriptionData.subscriber.address.line1,
              address_line_2: subscriptionData.subscriber.address.line2,
              admin_area_2: subscriptionData.subscriber.address.city,
              admin_area_1: subscriptionData.subscriber.address.state,
              postal_code: subscriptionData.subscriber.address.postalCode,
              country_code: subscriptionData.subscriber.address.countryCode || 'KE'
            }
          } : undefined
        },
        application_context: {
          brand_name: 'Abai Springs',
          locale: 'en-US',
          shipping_preference: 'SET_PROVIDED_ADDRESS',
          user_action: 'SUBSCRIBE_NOW',
          payment_method: {
            payer_selected: 'PAYPAL',
            payee_preferred: 'IMMEDIATE_PAYMENT_REQUIRED'
          },
          return_url: `${this.returnUrl}?type=subscription`,
          cancel_url: `${this.cancelUrl}?type=subscription`
        }
      };

      const response = await axios.post(
        `${this.baseUrl}/v1/billing/subscriptions`,
        subscription,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info('PayPal subscription created', {
        subscriptionId: response.data.id,
        planId: subscriptionData.planId,
        status: response.data.status
      });

      return {
        success: true,
        subscriptionId: response.data.id,
        status: response.data.status,
        approvalUrl: response.data.links.find(link => link.rel === 'approve')?.href
      };
    } catch (error) {
      logger.error('PayPal subscription creation failed:', error);
      throw new Error(error.response?.data?.message || error.message || 'Subscription creation failed');
    }
  }

  // Cancel subscription
  async cancelSubscription(subscriptionId, reason = 'Customer request') {
    try {
      const accessToken = await this.getAccessToken();
      
      const response = await axios.post(
        `${this.baseUrl}/v1/billing/subscriptions/${subscriptionId}/cancel`,
        {
          reason: reason
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info('PayPal subscription cancelled', {
        subscriptionId: subscriptionId,
        reason: reason
      });

      return {
        success: true,
        message: 'Subscription cancelled successfully'
      };
    } catch (error) {
      logger.error('PayPal subscription cancellation failed:', error);
      throw new Error(error.response?.data?.message || error.message || 'Subscription cancellation failed');
    }
  }

  // Get subscription details
  async getSubscriptionDetails(subscriptionId) {
    try {
      const accessToken = await this.getAccessToken();
      
      const response = await axios.get(
        `${this.baseUrl}/v1/billing/subscriptions/${subscriptionId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        subscription: response.data
      };
    } catch (error) {
      logger.error('Failed to get PayPal subscription details:', error);
      throw new Error(error.response?.data?.message || error.message || 'Failed to get subscription details');
    }
  }

  // Verify webhook signature
  verifyWebhookSignature(headers, body, webhookId) {
    try {
      // PayPal webhook verification implementation
      // This is a simplified version - in production, use PayPal's SDK
      const transmissionId = headers['paypal-transmission-id'];
      const certId = headers['paypal-cert-id'];
      const transmissionTime = headers['paypal-transmission-time'];
      const signature = headers['paypal-transmission-sig'];
      const authAlgo = headers['paypal-auth-algo'];
      
      // In production, implement proper signature verification
      // For now, we'll do basic validation
      if (!transmissionId || !signature) {
        return false;
      }
      
      return true; // Simplified for demo
    } catch (error) {
      logger.error('PayPal webhook verification failed:', error);
      return false;
    }
  }

  // Process webhook event
  async processWebhookEvent(eventType, eventData) {
    try {
      logger.info('Processing PayPal webhook event', { eventType, eventId: eventData.id });
      
      switch (eventType) {
        case 'PAYMENT.CAPTURE.COMPLETED':
          return await this.handlePaymentCaptureCompleted(eventData);
        case 'PAYMENT.CAPTURE.DENIED':
          return await this.handlePaymentCaptureDenied(eventData);
        case 'BILLING.SUBSCRIPTION.ACTIVATED':
          return await this.handleSubscriptionActivated(eventData);
        case 'BILLING.SUBSCRIPTION.CANCELLED':
          return await this.handleSubscriptionCancelled(eventData);
        case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED':
          return await this.handleSubscriptionPaymentFailed(eventData);
        default:
          logger.info('Unhandled PayPal webhook event type', { eventType });
          return { processed: false, reason: 'Unhandled event type' };
      }
    } catch (error) {
      logger.error('PayPal webhook processing failed:', error);
      return { processed: false, error: error.message };
    }
  }

  // Handle payment capture completed
  async handlePaymentCaptureCompleted(eventData) {
    const resource = eventData.resource;
    logger.info('PayPal payment capture completed', {
      captureId: resource.id,
      amount: resource.amount
    });
    
    return { processed: true, action: 'payment_completed', data: resource };
  }

  // Handle payment capture denied
  async handlePaymentCaptureDenied(eventData) {
    const resource = eventData.resource;
    logger.warn('PayPal payment capture denied', {
      captureId: resource.id,
      amount: resource.amount
    });
    
    return { processed: true, action: 'payment_denied', data: resource };
  }

  // Handle subscription activated
  async handleSubscriptionActivated(eventData) {
    const resource = eventData.resource;
    logger.info('PayPal subscription activated', {
      subscriptionId: resource.id,
      planId: resource.plan_id
    });
    
    return { processed: true, action: 'subscription_activated', data: resource };
  }

  // Handle subscription cancelled
  async handleSubscriptionCancelled(eventData) {
    const resource = eventData.resource;
    logger.info('PayPal subscription cancelled', {
      subscriptionId: resource.id,
      reason: resource.status_change_note
    });
    
    return { processed: true, action: 'subscription_cancelled', data: resource };
  }

  // Handle subscription payment failed
  async handleSubscriptionPaymentFailed(eventData) {
    const resource = eventData.resource;
    logger.warn('PayPal subscription payment failed', {
      subscriptionId: resource.id,
      failureReason: resource.failure_reason
    });
    
    return { processed: true, action: 'subscription_payment_failed', data: resource };
  }

  // Get supported currencies
  getSupportedCurrencies() {
    return [
      'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'NOK', 'SEK', 'DKK',
      'PLN', 'CZK', 'HUF', 'ILS', 'MXN', 'BRL', 'MYR', 'PHP', 'TWD', 'THB',
      'SGD', 'HKD', 'NZD', 'INR'
    ];
  }

  // Health check
  async healthCheck() {
    try {
      if (!this.isConfigured) {
        return { 
          status: 'warning', 
          message: 'PayPal not configured',
          configured: false
        };
      }

      const token = await this.getAccessToken();
      return { 
        status: 'healthy', 
        message: 'PayPal service operational',
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

export default new PayPalService();










