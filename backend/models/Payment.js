import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    index: true // Index for order-based queries
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true // Index for customer-based queries
  },
  amount: {
    type: Number,
    required: true,
    index: true // Index for amount-based queries
  },
  currency: {
    type: String,
    default: 'KES',
    index: true // Index for currency-based queries
  },
  paymentMethod: {
    type: String,
    enum: ['mpesa', 'airtel_money', 'equitel', 'cash', 'card', 'bank_transfer'],
    required: true,
    index: true // Index for payment method queries
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending',
    index: true // Index for status-based queries
  },
  transactionId: {
    type: String,
    unique: true,
    sparse: true,
    index: true // Index for transaction ID lookups
  },
  mpesaDetails: {
    phoneNumber: String,
    checkoutRequestId: String,
    merchantRequestId: String,
    resultCode: String,
    resultDesc: String,
    callbackUrl: String
  },
  cardDetails: {
    cardType: String,
    last4Digits: String,
    maskedCardNumber: String
  },
  bankDetails: {
    bankName: String,
    accountNumber: String,
    reference: String
  },
  metadata: {
    type: Map,
    of: String
  },
  errorMessage: String,
  processedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
paymentSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Generate transaction ID
paymentSchema.pre('save', function(next) {
  if (!this.transactionId) {
    this.transactionId = `TXN${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
  }
  next();
});

// Compound indexes for common query patterns
paymentSchema.index({ customer: 1, createdAt: -1 }); // Customer payments by date
paymentSchema.index({ order: 1, status: 1 }); // Order payments by status
paymentSchema.index({ status: 1, createdAt: -1 }); // Payments by status and date
paymentSchema.index({ paymentMethod: 1, status: 1 }); // Payment method analytics
paymentSchema.index({ amount: 1, createdAt: -1 }); // Amount-based analytics
paymentSchema.index({ customer: 1, paymentMethod: 1 }); // Customer payment methods
paymentSchema.index({ status: 1, paymentMethod: 1 }); // Status + method queries
paymentSchema.index({ processedAt: 1, status: 1 }); // Processing time analytics

// Text search index for transaction IDs
paymentSchema.index({ transactionId: 'text' });

// TTL index for failed payments (auto-delete after 30 days)
paymentSchema.index({ 
  createdAt: 1 
}, { 
  expireAfterSeconds: 2592000,
  partialFilterExpression: { status: 'failed' }
});

const Payment = mongoose.model('Payment', paymentSchema);

export default Payment;

