import crypto from 'crypto';
import Wallet from '../models/Wallet.js';
import User from '../models/User.js';
import paymentGatewayService from './paymentGateway/paymentGatewayService.js';
import notificationService from './notificationService.js';
import logger from '../utils/logger.js';
import cacheManager from '../utils/cache.js';

class WalletService {
  constructor() {
    this.exchangeRates = {
      KES: 1,
      USD: 150, // 1 USD = 150 KES (would be fetched from API)
      EUR: 165, // 1 EUR = 165 KES
      GBP: 190  // 1 GBP = 190 KES
    };
  }

  // Create wallet for new user
  async createWallet(userId) {
    try {
      const existingWallet = await Wallet.findByUserId(userId);
      if (existingWallet) {
        return { success: true, wallet: existingWallet, created: false };
      }

      const wallet = await Wallet.createForUser(userId);
      
      logger.info('Wallet created for user', { userId, walletId: wallet._id });
      
      return { success: true, wallet: wallet, created: true };
    } catch (error) {
      logger.error('Wallet creation failed:', error);
      throw new Error('Failed to create wallet');
    }
  }

  // Get wallet for user
  async getWallet(userId) {
    try {
      let wallet = await Wallet.findByUserId(userId);
      
      if (!wallet) {
        const result = await this.createWallet(userId);
        wallet = result.wallet;
      }
      
      return { success: true, wallet: wallet };
    } catch (error) {
      logger.error('Failed to get wallet:', error);
      throw new Error('Failed to retrieve wallet');
    }
  }

  // Get wallet balance
  async getBalance(userId, currency = 'KES') {
    try {
      const { wallet } = await this.getWallet(userId);
      const balance = wallet.getBalance(currency);
      
      return {
        success: true,
        balance: balance,
        currency: currency,
        totalKES: currency === 'KES' ? balance.available : balance.available * this.exchangeRates[currency]
      };
    } catch (error) {
      logger.error('Failed to get balance:', error);
      throw new Error('Failed to retrieve balance');
    }
  }

  // Top up wallet
  async topUpWallet(topupData) {
    try {
      const { userId, amount, currency = 'KES', paymentMethod, gateway } = topupData;
      
      // Get wallet
      const { wallet } = await this.getWallet(userId);
      
      // Check limits
      const newBalance = wallet.getBalance(currency).available + amount;
      if (newBalance > wallet.settings.limits.maxBalance) {
        throw new Error('Top-up would exceed maximum wallet balance limit');
      }
      
      // Generate transaction ID
      const transactionId = this.generateTransactionId('TOPUP');
      
      // Process payment through gateway
      const paymentData = {
        orderId: transactionId,
        customerId: userId,
        amount: amount,
        currency: currency,
        paymentMethod: paymentMethod,
        description: `Wallet top-up - ${amount} ${currency}`,
        metadata: {
          type: 'wallet_topup',
          walletId: wallet._id
        }
      };
      
      const paymentResult = await paymentGatewayService.processPayment(paymentData, gateway);
      
      if (!paymentResult.success) {
        throw new Error('Payment processing failed');
      }
      
      // Add pending transaction
      const balanceBefore = wallet.getBalance(currency).available;
      wallet.balances[currency].pending += amount;
      
      const transaction = wallet.addTransaction({
        transactionId: transactionId,
        type: 'credit',
        category: 'topup',
        amount: amount,
        currency: currency,
        description: `Wallet top-up via ${gateway}`,
        reference: {
          paymentId: paymentResult.transactionId,
          gateway: paymentResult.gateway
        },
        balanceBefore: balanceBefore,
        balanceAfter: balanceBefore, // Will be updated when payment confirms
        status: 'pending'
      });
      
      await wallet.save();
      
      logger.info('Wallet top-up initiated', {
        userId: userId,
        amount: amount,
        currency: currency,
        transactionId: transactionId,
        paymentGateway: paymentResult.gateway
      });
      
      return {
        success: true,
        transactionId: transactionId,
        amount: amount,
        currency: currency,
        status: 'pending',
        paymentResult: paymentResult,
        transaction: transaction
      };
    } catch (error) {
      logger.error('Wallet top-up failed:', error);
      throw error;
    }
  }

  // Confirm top-up (called from webhook)
  async confirmTopUp(transactionId, paymentData) {
    try {
      const wallet = await Wallet.findOne({ 'transactions.transactionId': transactionId });
      
      if (!wallet) {
        throw new Error('Transaction not found');
      }
      
      const transaction = wallet.transactions.find(t => t.transactionId === transactionId);
      
      if (!transaction) {
        throw new Error('Transaction not found in wallet');
      }
      
      if (transaction.status !== 'pending') {
        logger.warn('Attempted to confirm non-pending transaction', { transactionId });
        return { success: false, reason: 'Transaction not pending' };
      }
      
      // Move from pending to available
      const currency = transaction.currency;
      wallet.balances[currency].pending -= transaction.amount;
      wallet.balances[currency].available += transaction.amount;
      
      // Update transaction
      transaction.status = 'completed';
      transaction.processedAt = new Date();
      transaction.balanceAfter = wallet.getBalance(currency).available;
      
      await wallet.save();
      
      // Send notification
      const user = await User.findById(wallet.userId);
      if (user) {
        await this.sendTopUpNotification(user, transaction);
      }
      
      logger.info('Wallet top-up confirmed', {
        userId: wallet.userId,
        transactionId: transactionId,
        amount: transaction.amount,
        currency: transaction.currency
      });
      
      return { success: true, transaction: transaction };
    } catch (error) {
      logger.error('Top-up confirmation failed:', error);
      throw error;
    }
  }

  // Withdraw from wallet
  async withdrawFromWallet(withdrawalData) {
    try {
      const { userId, amount, currency = 'KES', withdrawalMethod, destination } = withdrawalData;
      
      // Get wallet
      const { wallet } = await this.getWallet(userId);
      
      // Check if user has enough balance
      if (!wallet.hasEnoughBalance(amount, currency)) {
        throw new Error('Insufficient wallet balance');
      }
      
      // Check verification requirements for large withdrawals
      if (amount > 10000 && !wallet.isVerified) {
        throw new Error('Account verification required for large withdrawals');
      }
      
      // Generate transaction ID
      const transactionId = this.generateTransactionId('WITHDRAW');
      
      // Reserve funds
      const balanceBefore = wallet.getBalance(currency).available;
      wallet.reserveFunds(amount, currency);
      
      // Add transaction
      const transaction = wallet.addTransaction({
        transactionId: transactionId,
        type: 'debit',
        category: 'withdrawal',
        amount: amount,
        currency: currency,
        description: `Withdrawal to ${withdrawalMethod}`,
        reference: {
          withdrawalMethod: withdrawalMethod,
          destination: destination
        },
        balanceBefore: balanceBefore,
        balanceAfter: balanceBefore - amount,
        status: 'pending'
      });
      
      await wallet.save();
      
      // Process withdrawal based on method
      let withdrawalResult;
      if (withdrawalMethod === 'mpesa') {
        withdrawalResult = await this.processMpesaWithdrawal({
          phoneNumber: destination,
          amount: amount,
          transactionId: transactionId
        });
      } else if (withdrawalMethod === 'bank') {
        withdrawalResult = await this.processBankWithdrawal({
          accountDetails: destination,
          amount: amount,
          transactionId: transactionId
        });
      } else {
        throw new Error('Unsupported withdrawal method');
      }
      
      if (withdrawalResult.success) {
        // Deduct reserved funds
        wallet.deductReservedFunds(amount, currency);
        transaction.status = 'completed';
        transaction.processedAt = new Date();
      } else {
        // Release reserved funds on failure
        wallet.releaseFunds(amount, currency);
        transaction.status = 'failed';
      }
      
      await wallet.save();
      
      logger.info('Wallet withdrawal processed', {
        userId: userId,
        transactionId: transactionId,
        amount: amount,
        currency: currency,
        method: withdrawalMethod,
        success: withdrawalResult.success
      });
      
      return {
        success: withdrawalResult.success,
        transactionId: transactionId,
        amount: amount,
        currency: currency,
        withdrawalResult: withdrawalResult,
        transaction: transaction
      };
    } catch (error) {
      logger.error('Wallet withdrawal failed:', error);
      throw error;
    }
  }

  // Pay from wallet
  async payFromWallet(paymentData) {
    try {
      const { userId, orderId, amount, currency = 'KES', description } = paymentData;
      
      // Get wallet
      const { wallet } = await this.getWallet(userId);
      
      // Check spending limits and balance
      const spendCheck = wallet.canSpend(amount, currency);
      if (!spendCheck.allowed) {
        throw new Error(spendCheck.reason);
      }
      
      // Generate transaction ID
      const transactionId = this.generateTransactionId('PAY');
      
      // Deduct from available balance
      const balanceBefore = wallet.getBalance(currency).available;
      wallet.balances[currency].available -= amount;
      
      // Add transaction
      const transaction = wallet.addTransaction({
        transactionId: transactionId,
        type: 'debit',
        category: 'purchase',
        amount: amount,
        currency: currency,
        description: description || `Payment for order ${orderId}`,
        reference: {
          orderId: orderId
        },
        balanceBefore: balanceBefore,
        balanceAfter: balanceBefore - amount,
        status: 'completed'
      });
      
      await wallet.save();
      
      logger.info('Wallet payment processed', {
        userId: userId,
        orderId: orderId,
        transactionId: transactionId,
        amount: amount,
        currency: currency
      });
      
      return {
        success: true,
        transactionId: transactionId,
        amount: amount,
        currency: currency,
        transaction: transaction,
        newBalance: wallet.getBalance(currency).available
      };
    } catch (error) {
      logger.error('Wallet payment failed:', error);
      throw error;
    }
  }

  // Refund to wallet
  async refundToWallet(refundData) {
    try {
      const { userId, orderId, amount, currency = 'KES', reason } = refundData;
      
      // Get wallet
      const { wallet } = await this.getWallet(userId);
      
      // Generate transaction ID
      const transactionId = this.generateTransactionId('REFUND');
      
      // Add to available balance
      const balanceBefore = wallet.getBalance(currency).available;
      wallet.balances[currency].available += amount;
      
      // Add transaction
      const transaction = wallet.addTransaction({
        transactionId: transactionId,
        type: 'credit',
        category: 'refund',
        amount: amount,
        currency: currency,
        description: reason || `Refund for order ${orderId}`,
        reference: {
          orderId: orderId
        },
        balanceBefore: balanceBefore,
        balanceAfter: balanceBefore + amount,
        status: 'completed'
      });
      
      await wallet.save();
      
      // Send notification
      const user = await User.findById(userId);
      if (user) {
        await this.sendRefundNotification(user, transaction);
      }
      
      logger.info('Wallet refund processed', {
        userId: userId,
        orderId: orderId,
        transactionId: transactionId,
        amount: amount,
        currency: currency
      });
      
      return {
        success: true,
        transactionId: transactionId,
        amount: amount,
        currency: currency,
        transaction: transaction,
        newBalance: wallet.getBalance(currency).available
      };
    } catch (error) {
      logger.error('Wallet refund failed:', error);
      throw error;
    }
  }

  // Add loyalty bonus
  async addLoyaltyBonus(userId, points, reason) {
    try {
      const { wallet } = await this.getWallet(userId);
      
      // Convert points to KES (1 point = 1 KES)
      const amount = points;
      const currency = 'KES';
      
      // Generate transaction ID
      const transactionId = this.generateTransactionId('BONUS');
      
      // Add to available balance
      const balanceBefore = wallet.getBalance(currency).available;
      wallet.balances[currency].available += amount;
      
      // Add transaction
      const transaction = wallet.addTransaction({
        transactionId: transactionId,
        type: 'credit',
        category: 'loyalty_reward',
        amount: amount,
        currency: currency,
        description: reason || `Loyalty bonus - ${points} points`,
        balanceBefore: balanceBefore,
        balanceAfter: balanceBefore + amount,
        status: 'completed'
      });
      
      await wallet.save();
      
      logger.info('Loyalty bonus added', {
        userId: userId,
        points: points,
        amount: amount,
        transactionId: transactionId
      });
      
      return {
        success: true,
        transactionId: transactionId,
        points: points,
        amount: amount,
        transaction: transaction
      };
    } catch (error) {
      logger.error('Loyalty bonus failed:', error);
      throw error;
    }
  }

  // Get transaction history
  async getTransactionHistory(userId, options = {}) {
    try {
      const { limit = 50, currency = null, category = null, startDate = null, endDate = null } = options;
      
      const { wallet } = await this.getWallet(userId);
      
      let transactions = wallet.getTransactionHistory(limit, currency, category);
      
      // Apply date filters
      if (startDate || endDate) {
        transactions = transactions.filter(t => {
          const transDate = new Date(t.createdAt);
          if (startDate && transDate < new Date(startDate)) return false;
          if (endDate && transDate > new Date(endDate)) return false;
          return true;
        });
      }
      
      return {
        success: true,
        transactions: transactions,
        total: transactions.length,
        walletBalance: wallet.getBalance(currency || 'KES')
      };
    } catch (error) {
      logger.error('Failed to get transaction history:', error);
      throw new Error('Failed to retrieve transaction history');
    }
  }

  // Get wallet analytics
  async getWalletAnalytics(userId) {
    try {
      const { wallet } = await this.getWallet(userId);
      
      const analytics = {
        currentBalance: wallet.totalBalanceKES,
        monthlySpend: wallet.getMonthlySpend(),
        dailySpend: wallet.getDailySpend(),
        totalTransactions: wallet.stats.transactionCount,
        totalDeposits: wallet.stats.totalDeposits,
        totalWithdrawals: wallet.stats.totalWithdrawals,
        totalSpent: wallet.stats.totalSpent,
        averageMonthlySpend: wallet.stats.averageMonthlySpend,
        loyaltyPoints: wallet.loyalty.points,
        loyaltyTier: wallet.loyalty.tier,
        spendingLimits: {
          daily: {
            limit: wallet.settings.limits.dailySpend,
            used: wallet.getDailySpend(),
            remaining: wallet.settings.limits.dailySpend - wallet.getDailySpend()
          },
          monthly: {
            limit: wallet.settings.limits.monthlySpend,
            used: wallet.getMonthlySpend(),
            remaining: wallet.settings.limits.monthlySpend - wallet.getMonthlySpend()
          }
        },
        topCategories: this.getTopSpendingCategories(wallet),
        recentActivity: wallet.getTransactionHistory(10)
      };
      
      return { success: true, analytics: analytics };
    } catch (error) {
      logger.error('Failed to get wallet analytics:', error);
      throw new Error('Failed to retrieve wallet analytics');
    }
  }

  // Update wallet settings
  async updateWalletSettings(userId, settings) {
    try {
      const { wallet } = await this.getWallet(userId);
      
      // Merge new settings with existing
      wallet.settings = {
        ...wallet.settings,
        ...settings
      };
      
      await wallet.save();
      
      logger.info('Wallet settings updated', { userId, settings });
      
      return { success: true, settings: wallet.settings };
    } catch (error) {
      logger.error('Failed to update wallet settings:', error);
      throw new Error('Failed to update wallet settings');
    }
  }

  // Check auto top-up
  async checkAutoTopUp(userId) {
    try {
      const { wallet } = await this.getWallet(userId);
      
      if (wallet.needsAutoTopup()) {
        logger.info('Auto top-up triggered', {
          userId: userId,
          currentBalance: wallet.getBalance('KES').available,
          threshold: wallet.settings.autoTopup.threshold,
          topupAmount: wallet.settings.autoTopup.amount
        });
        
        // Process auto top-up
        return await this.topUpWallet({
          userId: userId,
          amount: wallet.settings.autoTopup.amount,
          currency: 'KES',
          paymentMethod: wallet.settings.autoTopup.paymentMethod,
          gateway: 'stripe' // Default for auto top-up
        });
      }
      
      return { success: true, autoTopupTriggered: false };
    } catch (error) {
      logger.error('Auto top-up check failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Helper methods
  generateTransactionId(prefix = 'TXN') {
    return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  }

  async processMpesaWithdrawal(withdrawalData) {
    try {
      // This would integrate with M-Pesa B2C
      // For now, return success simulation
      return {
        success: true,
        transactionId: `MP${Date.now()}`,
        message: 'M-Pesa withdrawal processed'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async processBankWithdrawal(withdrawalData) {
    try {
      // This would integrate with bank transfer APIs
      // For now, return pending status
      return {
        success: true,
        transactionId: `BK${Date.now()}`,
        message: 'Bank withdrawal initiated - processing may take 1-3 business days'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  getTopSpendingCategories(wallet) {
    const categoryTotals = {};
    
    wallet.transactions
      .filter(t => t.type === 'debit' && t.status === 'completed')
      .forEach(t => {
        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
      });
    
    return Object.entries(categoryTotals)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([category, amount]) => ({ category, amount }));
  }

  async sendTopUpNotification(user, transaction) {
    try {
      if (user.preferences?.notifications?.email?.orderUpdates) {
        const subject = 'Wallet Top-up Successful';
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #28a745; padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">Wallet Topped Up!</h1>
            </div>
            <div style="padding: 30px; background: #f9f9f9;">
              <h2 style="color: #333;">Hello ${user.name},</h2>
              <p style="color: #666; font-size: 16px;">
                Your wallet has been successfully topped up.
              </p>
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #333; margin-top: 0;">Top-up Details</h3>
                <p><strong>Amount:</strong> ${transaction.currency} ${transaction.amount}</p>
                <p><strong>Transaction ID:</strong> ${transaction.transactionId}</p>
                <p><strong>Date:</strong> ${transaction.createdAt.toLocaleString()}</p>
              </div>
              <p style="color: #666; font-size: 14px;">
                You can now use your wallet balance for purchases on Abai Springs.
              </p>
            </div>
          </div>
        `;
        
        await notificationService.sendEmail(user.email, subject, html);
      }
    } catch (error) {
      logger.error('Failed to send top-up notification:', error);
    }
  }

  async sendRefundNotification(user, transaction) {
    try {
      if (user.preferences?.notifications?.email?.orderUpdates) {
        const subject = 'Refund Processed';
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #17a2b8; padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">Refund Processed</h1>
            </div>
            <div style="padding: 30px; background: #f9f9f9;">
              <h2 style="color: #333;">Hello ${user.name},</h2>
              <p style="color: #666; font-size: 16px;">
                A refund has been processed to your wallet.
              </p>
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #333; margin-top: 0;">Refund Details</h3>
                <p><strong>Amount:</strong> ${transaction.currency} ${transaction.amount}</p>
                <p><strong>Reason:</strong> ${transaction.description}</p>
                <p><strong>Transaction ID:</strong> ${transaction.transactionId}</p>
                <p><strong>Date:</strong> ${transaction.createdAt.toLocaleString()}</p>
              </div>
            </div>
          </div>
        `;
        
        await notificationService.sendEmail(user.email, subject, html);
      }
    } catch (error) {
      logger.error('Failed to send refund notification:', error);
    }
  }
}

export default new WalletService();






