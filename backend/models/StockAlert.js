import mongoose from 'mongoose';

const stockAlertSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  outletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Outlet',
    required: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  // Consumption tracking
  averageConsumption: {
    type: Number, // bottles per week
    default: 0
  },
  lastOrderDate: {
    type: Date,
    default: Date.now
  },
  lastOrderQuantity: {
    type: Number,
    default: 0
  },
  // Alert preferences
  alertEnabled: {
    type: Boolean,
    default: true
  },
  alertThreshold: {
    type: Number, // days before running out
    default: 3
  },
  preferredChannels: {
    email: { type: Boolean, default: true },
    whatsapp: { type: Boolean, default: true }
  },
  // Prediction data
  predictedRunOutDate: {
    type: Date
  },
  currentStockLevel: {
    type: Number,
    default: 0
  },
  // Alert history
  lastAlertSent: {
    type: Date
  },
  alertHistory: [{
    date: { type: Date, default: Date.now },
    type: { type: String, enum: ['low_stock', 'reorder_reminder', 'stock_update'] },
    message: String,
    channel: { type: String, enum: ['email', 'whatsapp'] }
  }],
  // Status
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
stockAlertSchema.index({ customerId: 1, outletId: 1, productId: 1 });
stockAlertSchema.index({ predictedRunOutDate: 1, alertEnabled: 1 });

const StockAlert = mongoose.model('StockAlert', stockAlertSchema);

export default StockAlert;











