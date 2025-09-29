import Stripe from 'stripe';
import cacheManager from '../../utils/cache.js';
import logger from '../../utils/logger.js';

class StripeService {
  constructor() {
    this.secretKey = process.env.STRIPE_SECRET_KEY;
    this.publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    this.environment = process.env.NODE_ENV || 'development';
    
    this.isConfigured = !!(this.secretKey && this.publishableKey);
    
    if (this.isConfigured) {
      this.stripe = new Stripe(this.secretKey, {
        apiVersion: '2024-06-20',
        typescript: false
      });
      logger.info('Stripe service initialized');
    } else {
      logger.warn('Stripe not configured - card payments will not be available');
    }
  }

  // Create payment intent
  async createPaymentIntent(paymentData) {
    try {
      if (!this.isConfigured) {
        throw new Error('Stripe not configured');
      }

      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(paymentData.amount * 100), // Convert to cents
        currency: paymentData.currency || 'usd',
        payment_method_types: paymentData.paymentMethodTypes || ['card'],
        description: paymentData.description || `Abai Springs Water Delivery - Order ${paymentData.orderId}`,
        metadata: {
          orderId: paymentData.orderId,
          customerId: paymentData.customerId,
          customerEmail: paymentData.customerEmail
        },
        receipt_email: paymentData.customerEmail,
        shipping: paymentData.shipping ? {
          name: paymentData.shipping.name,
          address: {
            line1: paymentData.shipping.address.line1,
            line2: paymentData.shipping.address.line2,
            city: paymentData.shipping.address.city,
            state: paymentData.shipping.address.state,
            postal_code: paymentData.shipping.address.postalCode,
            country: paymentData.shipping.address.country || 'KE'
          }
        } : undefined,
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never'
        }
      });

      // Store payment intent details
      const intentData = {
        stripePaymentIntentId: paymentIntent.id,
        orderId: paymentData.orderId,
        customerId: paymentData.customerId,
        amount: paymentData.amount,
        currency: paymentData.currency || 'usd',
        status: paymentIntent.status,
        createdAt: new Date()
      };

      await cacheManager.set(
        `stripe_intent:${paymentIntent.id}`, 
        intentData, 
        2 * 60 * 60 // 2 hours
      );

      logger.info('Stripe payment intent created', {
        paymentIntentId: paymentIntent.id,
        orderId: paymentData.orderId,
        amount: paymentData.amount,
        currency: paymentData.currency || 'usd'
      });

      return {
        success: true,
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency
      };
    } catch (error) {
      logger.error('Stripe payment intent creation failed:', error);
      throw new Error(error.message || 'Payment intent creation failed');
    }
  }

  // Confirm payment intent
  async confirmPaymentIntent(paymentIntentId, paymentMethodId = null) {
    try {
      const confirmData = {};
      if (paymentMethodId) {
        confirmData.payment_method = paymentMethodId;
      }

      const paymentIntent = await this.stripe.paymentIntents.confirm(
        paymentIntentId,
        confirmData
      );

      // Update stored data
      const intentData = await cacheManager.get(`stripe_intent:${paymentIntentId}`);
      if (intentData) {
        intentData.status = paymentIntent.status;
        intentData.confirmedAt = new Date();
        await cacheManager.set(`stripe_intent:${paymentIntentId}`, intentData, 24 * 60 * 60);
      }

      logger.info('Stripe payment intent confirmed', {
        paymentIntentId: paymentIntentId,
        status: paymentIntent.status
      });

      return {
        success: true,
        status: paymentIntent.status,
        paymentIntent: paymentIntent
      };
    } catch (error) {
      logger.error('Stripe payment confirmation failed:', error);
      throw new Error(error.message || 'Payment confirmation failed');
    }
  }

  // Create customer
  async createCustomer(customerData) {
    try {
      const customer = await this.stripe.customers.create({
        email: customerData.email,
        name: customerData.name,
        phone: customerData.phone,
        description: `Abai Springs Customer - ${customerData.name}`,
        metadata: {
          userId: customerData.userId,
          registeredAt: new Date().toISOString()
        },
        address: customerData.address ? {
          line1: customerData.address.line1,
          line2: customerData.address.line2,
          city: customerData.address.city,
          state: customerData.address.state,
          postal_code: customerData.address.postalCode,
          country: customerData.address.country || 'KE'
        } : undefined
      });

      logger.info('Stripe customer created', {
        customerId: customer.id,
        email: customerData.email,
        userId: customerData.userId
      });

      return {
        success: true,
        customerId: customer.id,
        customer: customer
      };
    } catch (error) {
      logger.error('Stripe customer creation failed:', error);
      throw new Error(error.message || 'Customer creation failed');
    }
  }

  // Update customer
  async updateCustomer(customerId, updateData) {
    try {
      const customer = await this.stripe.customers.update(customerId, {
        email: updateData.email,
        name: updateData.name,
        phone: updateData.phone,
        address: updateData.address ? {
          line1: updateData.address.line1,
          line2: updateData.address.line2,
          city: updateData.address.city,
          state: updateData.address.state,
          postal_code: updateData.address.postalCode,
          country: updateData.address.country || 'KE'
        } : undefined
      });

      logger.info('Stripe customer updated', {
        customerId: customerId,
        email: updateData.email
      });

      return {
        success: true,
        customer: customer
      };
    } catch (error) {
      logger.error('Stripe customer update failed:', error);
      throw new Error(error.message || 'Customer update failed');
    }
  }

  // Save payment method
  async savePaymentMethod(customerId, paymentMethodId) {
    try {
      const paymentMethod = await this.stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId
      });

      logger.info('Payment method saved', {
        customerId: customerId,
        paymentMethodId: paymentMethodId,
        type: paymentMethod.type
      });

      return {
        success: true,
        paymentMethod: paymentMethod
      };
    } catch (error) {
      logger.error('Payment method save failed:', error);
      throw new Error(error.message || 'Failed to save payment method');
    }
  }

  // Get customer payment methods
  async getCustomerPaymentMethods(customerId, type = 'card') {
    try {
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: customerId,
        type: type
      });

      return {
        success: true,
        paymentMethods: paymentMethods.data
      };
    } catch (error) {
      logger.error('Failed to get customer payment methods:', error);
      throw new Error(error.message || 'Failed to get payment methods');
    }
  }

  // Delete payment method
  async deletePaymentMethod(paymentMethodId) {
    try {
      const paymentMethod = await this.stripe.paymentMethods.detach(paymentMethodId);

      logger.info('Payment method deleted', {
        paymentMethodId: paymentMethodId
      });

      return {
        success: true,
        paymentMethod: paymentMethod
      };
    } catch (error) {
      logger.error('Payment method deletion failed:', error);
      throw new Error(error.message || 'Failed to delete payment method');
    }
  }

  // Create subscription
  async createSubscription(subscriptionData) {
    try {
      const subscription = await this.stripe.subscriptions.create({
        customer: subscriptionData.customerId,
        items: subscriptionData.items.map(item => ({
          price_data: {
            currency: item.currency || 'usd',
            product_data: {
              name: item.name,
              description: item.description
            },
            recurring: {
              interval: item.interval || 'month',
              interval_count: item.intervalCount || 1
            },
            unit_amount: Math.round(item.amount * 100)
          },
          quantity: item.quantity || 1
        })),
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          orderId: subscriptionData.orderId,
          userId: subscriptionData.userId
        },
        trial_period_days: subscriptionData.trialDays || undefined
      });

      logger.info('Stripe subscription created', {
        subscriptionId: subscription.id,
        customerId: subscriptionData.customerId,
        status: subscription.status
      });

      return {
        success: true,
        subscriptionId: subscription.id,
        clientSecret: subscription.latest_invoice.payment_intent.client_secret,
        status: subscription.status
      };
    } catch (error) {
      logger.error('Stripe subscription creation failed:', error);
      throw new Error(error.message || 'Subscription creation failed');
    }
  }

  // Cancel subscription
  async cancelSubscription(subscriptionId, cancelAtPeriodEnd = true) {
    try {
      const subscription = await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: cancelAtPeriodEnd
      });

      if (!cancelAtPeriodEnd) {
        await this.stripe.subscriptions.cancel(subscriptionId);
      }

      logger.info('Stripe subscription cancelled', {
        subscriptionId: subscriptionId,
        cancelAtPeriodEnd: cancelAtPeriodEnd
      });

      return {
        success: true,
        subscription: subscription
      };
    } catch (error) {
      logger.error('Stripe subscription cancellation failed:', error);
      throw new Error(error.message || 'Subscription cancellation failed');
    }
  }

  // Create refund
  async createRefund(paymentIntentId, amount = null, reason = 'requested_by_customer') {
    try {
      const refundData = {
        payment_intent: paymentIntentId,
        reason: reason
      };

      if (amount) {
        refundData.amount = Math.round(amount * 100);
      }

      const refund = await this.stripe.refunds.create(refundData);

      logger.info('Stripe refund created', {
        refundId: refund.id,
        paymentIntentId: paymentIntentId,
        amount: refund.amount,
        status: refund.status
      });

      return {
        success: true,
        refundId: refund.id,
        status: refund.status,
        amount: refund.amount / 100
      };
    } catch (error) {
      logger.error('Stripe refund creation failed:', error);
      throw new Error(error.message || 'Refund creation failed');
    }
  }

  // Get payment intent
  async getPaymentIntent(paymentIntentId) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);

      return {
        success: true,
        paymentIntent: paymentIntent
      };
    } catch (error) {
      logger.error('Failed to get payment intent:', error);
      throw new Error(error.message || 'Failed to get payment intent');
    }
  }

  // Process webhook
  async processWebhook(payload, signature) {
    try {
      if (!this.webhookSecret) {
        throw new Error('Webhook secret not configured');
      }

      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.webhookSecret
      );

      logger.info('Processing Stripe webhook', { 
        eventType: event.type, 
        eventId: event.id 
      });

      switch (event.type) {
        case 'payment_intent.succeeded':
          return await this.handlePaymentIntentSucceeded(event.data.object);
        case 'payment_intent.payment_failed':
          return await this.handlePaymentIntentFailed(event.data.object);
        case 'customer.subscription.created':
          return await this.handleSubscriptionCreated(event.data.object);
        case 'customer.subscription.updated':
          return await this.handleSubscriptionUpdated(event.data.object);
        case 'customer.subscription.deleted':
          return await this.handleSubscriptionDeleted(event.data.object);
        case 'invoice.payment_succeeded':
          return await this.handleInvoicePaymentSucceeded(event.data.object);
        case 'invoice.payment_failed':
          return await this.handleInvoicePaymentFailed(event.data.object);
        default:
          logger.info('Unhandled Stripe webhook event', { eventType: event.type });
          return { processed: false, reason: 'Unhandled event type' };
      }
    } catch (error) {
      logger.error('Stripe webhook processing failed:', error);
      throw new Error(error.message || 'Webhook processing failed');
    }
  }

  // Handle payment intent succeeded
  async handlePaymentIntentSucceeded(paymentIntent) {
    logger.info('Stripe payment succeeded', {
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount
    });

    return { 
      processed: true, 
      action: 'payment_succeeded', 
      data: paymentIntent 
    };
  }

  // Handle payment intent failed
  async handlePaymentIntentFailed(paymentIntent) {
    logger.warn('Stripe payment failed', {
      paymentIntentId: paymentIntent.id,
      lastPaymentError: paymentIntent.last_payment_error
    });

    return { 
      processed: true, 
      action: 'payment_failed', 
      data: paymentIntent 
    };
  }

  // Handle subscription created
  async handleSubscriptionCreated(subscription) {
    logger.info('Stripe subscription created', {
      subscriptionId: subscription.id,
      customerId: subscription.customer
    });

    return { 
      processed: true, 
      action: 'subscription_created', 
      data: subscription 
    };
  }

  // Handle subscription updated
  async handleSubscriptionUpdated(subscription) {
    logger.info('Stripe subscription updated', {
      subscriptionId: subscription.id,
      status: subscription.status
    });

    return { 
      processed: true, 
      action: 'subscription_updated', 
      data: subscription 
    };
  }

  // Handle subscription deleted
  async handleSubscriptionDeleted(subscription) {
    logger.info('Stripe subscription deleted', {
      subscriptionId: subscription.id,
      customerId: subscription.customer
    });

    return { 
      processed: true, 
      action: 'subscription_deleted', 
      data: subscription 
    };
  }

  // Handle invoice payment succeeded
  async handleInvoicePaymentSucceeded(invoice) {
    logger.info('Stripe invoice payment succeeded', {
      invoiceId: invoice.id,
      subscriptionId: invoice.subscription
    });

    return { 
      processed: true, 
      action: 'invoice_payment_succeeded', 
      data: invoice 
    };
  }

  // Handle invoice payment failed
  async handleInvoicePaymentFailed(invoice) {
    logger.warn('Stripe invoice payment failed', {
      invoiceId: invoice.id,
      subscriptionId: invoice.subscription
    });

    return { 
      processed: true, 
      action: 'invoice_payment_failed', 
      data: invoice 
    };
  }

  // Get publishable key for frontend
  getPublishableKey() {
    return this.publishableKey;
  }

  // Get supported currencies
  getSupportedCurrencies() {
    return [
      'usd', 'eur', 'gbp', 'cad', 'aud', 'jpy', 'chf', 'nok', 'sek', 'dkk',
      'pln', 'czk', 'huf', 'ils', 'mxn', 'brl', 'myr', 'php', 'twd', 'thb',
      'sgd', 'hkd', 'nzd', 'inr', 'krw', 'zar'
    ];
  }

  // Health check
  async healthCheck() {
    try {
      if (!this.isConfigured) {
        return { 
          status: 'warning', 
          message: 'Stripe not configured',
          configured: false
        };
      }

      // Test API connectivity
      await this.stripe.balance.retrieve();
      
      return { 
        status: 'healthy', 
        message: 'Stripe service operational',
        configured: true,
        publishableKey: this.publishableKey ? 'Set' : 'Not set'
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

export default new StripeService();










