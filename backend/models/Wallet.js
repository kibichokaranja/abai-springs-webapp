import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  transactionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  type: {
    type: String,
    enum: ['credit', 'debit'],
    required: true,
    index: true
  },
  category: {
    type: String,
    enum: [
      'topup', 'purchase', 'refund', 'cashback', 'bonus', 
      'loyalty_reward', 'referral_bonus', 'withdrawal',
      'fee', 'reversal', 'adjustment'
    ],
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'KES',
    enum: ['KES', 'USD', 'EUR', 'GBP'],
    index: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  reference: {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order'
    },
    paymentId: String,
    externalTransactionId: String,
    gateway: {
      type: String,
      enum: ['mpesa', 'paypal', 'stripe', 'bank', 'manual']
    }
  },
  balanceBefore: {
    type: Number,
    required: true
  },
  balanceAfter: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled', 'reversed'],
    default: 'pending',
    index: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  processedAt: Date,
  reversedAt: Date,
  reversalReason: String
}, {
  timestamps: true
});

const walletSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  
  // Multi-currency balances
  balances: {
    KES: {
      available: { type: Number, default: 0, min: 0 },
      pending: { type: Number, default: 0, min: 0 },
      reserved: { type: Number, default: 0, min: 0 } // For pending orders
    },
    USD: {
      available: { type: Number, default: 0, min: 0 },
      pending: { type: Number, default: 0, min: 0 },
      reserved: { type: Number, default: 0, min: 0 }
    },
    EUR: {
      available: { type: Number, default: 0, min: 0 },
      pending: { type: Number, default: 0, min: 0 },
      reserved: { type: Number, default: 0, min: 0 }
    },
    GBP: {
      available: { type: Number, default: 0, min: 0 },
      pending: { type: Number, default: 0, min: 0 },
      reserved: { type: Number, default: 0, min: 0 }
    }
  },
  
  // Transaction history
  transactions: [transactionSchema],
  
  // Wallet settings
  settings: {
    autoTopup: {
      enabled: { type: Boolean, default: false },
      threshold: { type: Number, default: 100 }, // KES
      amount: { type: Number, default: 500 }, // KES
      paymentMethod: String // Saved payment method ID
    },
    notifications: {
      lowBalance: { type: Boolean, default: true },
      transactions: { type: Boolean, default: true },
      topups: { type: Boolean, default: true }
    },
    limits: {
      dailySpend: { type: Number, default: 10000 }, // KES
      monthlySpend: { type: Number, default: 100000 }, // KES
      maxBalance: { type: Number, default: 500000 } // KES
    }
  },
  
  // Security and verification
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  isVerified: {
    type: Boolean,
    default: false,
    index: true
  },
  verificationLevel: {
    type: String,
    enum: ['basic', 'verified', 'premium'],
    default: 'basic',
    index: true
  },
  
  // KYC information
  kyc: {
    status: {
      type: String,
      enum: ['not_submitted', 'pending', 'approved', 'rejected'],
      default: 'not_submitted'
    },
    documentType: String,
    documentNumber: String,
    submittedAt: Date,
    approvedAt: Date,
    rejectedAt: Date,
    rejectionReason: String
  },
  
  // Statistics
  stats: {
    totalDeposits: { type: Number, default: 0 },
    totalWithdrawals: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    transactionCount: { type: Number, default: 0 },
    lastTopupAt: Date,
    lastTransactionAt: Date,
    averageMonthlySpend: { type: Number, default: 0 }
  },
  
  // Loyalty and rewards
  loyalty: {
    points: { type: Number, default: 0 },
    tier: {
      type: String,
      enum: ['bronze', 'silver', 'gold', 'platinum'],
      default: 'bronze'
    },
    tierProgress: { type: Number, default: 0 },
    nextTierAt: { type: Number, default: 1000 }
  }
}, {
  timestamps: true
});

// Indexes
walletSchema.index({ userId: 1, 'transactions.createdAt': -1 });
walletSchema.index({ 'transactions.transactionId': 1 });
walletSchema.index({ 'transactions.status': 1 });
walletSchema.index({ 'transactions.type': 1, 'transactions.createdAt': -1 });
walletSchema.index({ 'balances.KES.available': 1 });
walletSchema.index({ isActive: 1, isVerified: 1 });

// Virtual for total balance across currencies (in KES)
walletSchema.virtual('totalBalanceKES').get(function() {
  // Exchange rates would be fetched from external API
  const exchangeRates = { KES: 1, USD: 150, EUR: 165, GBP: 190 };
  
  let total = 0;
  for (const [currency, rates] of Object.entries(exchangeRates)) {
    if (this.balances[currency]) {
      total += this.balances[currency].available * rates;
    }
  }
  return total;
});

// Methods
walletSchema.methods.getBalance = function(currency = 'KES') {
  return this.balances[currency] || { available: 0, pending: 0, reserved: 0 };
};

walletSchema.methods.hasEnoughBalance = function(amount, currency = 'KES') {
  const balance = this.getBalance(currency);
  return balance.available >= amount;
};

walletSchema.methods.reserveFunds = function(amount, currency = 'KES') {
  if (!this.hasEnoughBalance(amount, currency)) {
    throw new Error('Insufficient balance');
  }
  
  this.balances[currency].available -= amount;
  this.balances[currency].reserved += amount;
};

walletSchema.methods.releaseFunds = function(amount, currency = 'KES') {
  if (this.balances[currency].reserved < amount) {
    throw new Error('Insufficient reserved funds');
  }
  
  this.balances[currency].reserved -= amount;
  this.balances[currency].available += amount;
};

walletSchema.methods.deductReservedFunds = function(amount, currency = 'KES') {
  if (this.balances[currency].reserved < amount) {
    throw new Error('Insufficient reserved funds');
  }
  
  this.balances[currency].reserved -= amount;
};

walletSchema.methods.addTransaction = function(transactionData) {
  const transaction = {
    transactionId: transactionData.transactionId,
    type: transactionData.type,
    category: transactionData.category,
    amount: transactionData.amount,
    currency: transactionData.currency || 'KES',
    description: transactionData.description,
    reference: transactionData.reference || {},
    balanceBefore: transactionData.balanceBefore,
    balanceAfter: transactionData.balanceAfter,
    status: transactionData.status || 'completed',
    metadata: transactionData.metadata || {},
    processedAt: new Date()
  };
  
  this.transactions.push(transaction);
  
  // Update stats
  this.stats.transactionCount += 1;
  this.stats.lastTransactionAt = new Date();
  
  if (transaction.type === 'credit' && transaction.category === 'topup') {
    this.stats.totalDeposits += transaction.amount;
    this.stats.lastTopupAt = new Date();
  } else if (transaction.type === 'debit' && transaction.category === 'purchase') {
    this.stats.totalSpent += transaction.amount;
  } else if (transaction.type === 'debit' && transaction.category === 'withdrawal') {
    this.stats.totalWithdrawals += transaction.amount;
  }
  
  // Update loyalty points (1 point per 10 KES spent)
  if (transaction.type === 'debit' && transaction.category === 'purchase') {
    const pointsEarned = Math.floor(transaction.amount / 10);
    this.loyalty.points += pointsEarned;
    this.updateLoyaltyTier();
  }
  
  return transaction;
};

walletSchema.methods.updateLoyaltyTier = function() {
  const points = this.loyalty.points;
  let newTier = 'bronze';
  let nextTierAt = 1000;
  
  if (points >= 10000) {
    newTier = 'platinum';
    nextTierAt = points; // Max tier reached
  } else if (points >= 5000) {
    newTier = 'gold';
    nextTierAt = 10000;
  } else if (points >= 1000) {
    newTier = 'silver';
    nextTierAt = 5000;
  }
  
  this.loyalty.tier = newTier;
  this.loyalty.nextTierAt = nextTierAt;
  this.loyalty.tierProgress = nextTierAt > points ? ((points / nextTierAt) * 100) : 100;
};

walletSchema.methods.getTransactionHistory = function(limit = 50, currency = null, category = null) {
  let transactions = this.transactions.slice().reverse(); // Most recent first
  
  if (currency) {
    transactions = transactions.filter(t => t.currency === currency);
  }
  
  if (category) {
    transactions = transactions.filter(t => t.category === category);
  }
  
  return transactions.slice(0, limit);
};

walletSchema.methods.getMonthlySpend = function(month = new Date().getMonth(), year = new Date().getFullYear()) {
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0);
  
  return this.transactions
    .filter(t => 
      t.type === 'debit' && 
      t.category === 'purchase' &&
      t.createdAt >= startDate && 
      t.createdAt <= endDate
    )
    .reduce((total, t) => total + t.amount, 0);
};

walletSchema.methods.getDailySpend = function(date = new Date()) {
  const startDate = new Date(date);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(date);
  endDate.setHours(23, 59, 59, 999);
  
  return this.transactions
    .filter(t => 
      t.type === 'debit' && 
      t.category === 'purchase' &&
      t.createdAt >= startDate && 
      t.createdAt <= endDate
    )
    .reduce((total, t) => total + t.amount, 0);
};

walletSchema.methods.canSpend = function(amount, currency = 'KES') {
  // Check balance
  if (!this.hasEnoughBalance(amount, currency)) {
    return { allowed: false, reason: 'Insufficient balance' };
  }
  
  // Check daily limit
  const dailySpend = this.getDailySpend();
  if (dailySpend + amount > this.settings.limits.dailySpend) {
    return { allowed: false, reason: 'Daily spending limit exceeded' };
  }
  
  // Check monthly limit
  const monthlySpend = this.getMonthlySpend();
  if (monthlySpend + amount > this.settings.limits.monthlySpend) {
    return { allowed: false, reason: 'Monthly spending limit exceeded' };
  }
  
  return { allowed: true };
};

walletSchema.methods.needsAutoTopup = function() {
  if (!this.settings.autoTopup.enabled) {
    return false;
  }
  
  const kesBalance = this.getBalance('KES');
  return kesBalance.available <= this.settings.autoTopup.threshold;
};

// Pre-save middleware
walletSchema.pre('save', function(next) {
  // Ensure balances don't go negative
  for (const currency of ['KES', 'USD', 'EUR', 'GBP']) {
    if (this.balances[currency]) {
      this.balances[currency].available = Math.max(0, this.balances[currency].available);
      this.balances[currency].pending = Math.max(0, this.balances[currency].pending);
      this.balances[currency].reserved = Math.max(0, this.balances[currency].reserved);
    }
  }
  
  next();
});

// Statics
walletSchema.statics.findByUserId = function(userId) {
  return this.findOne({ userId: userId });
};

walletSchema.statics.createForUser = function(userId) {
  return this.create({
    userId: userId,
    balances: {
      KES: { available: 0, pending: 0, reserved: 0 },
      USD: { available: 0, pending: 0, reserved: 0 },
      EUR: { available: 0, pending: 0, reserved: 0 },
      GBP: { available: 0, pending: 0, reserved: 0 }
    }
  });
};

export default mongoose.model('Wallet', walletSchema);











