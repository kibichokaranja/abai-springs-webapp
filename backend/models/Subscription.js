import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  subscriptionNumber: {
    type: String,
    unique: true,
    required: true,
    index: true
  },
  
  // Subscription details
  name: {
    type: String,
    required: true,
    trim: true
  },
  
  description: String,
  
  // Product configuration
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0
    }
  }],
  
  // Delivery schedule
  schedule: {
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'biweekly', 'monthly', 'custom'],
      required: true
    },
    interval: {
      type: Number,
      default: 1, // Every X frequency periods
      min: 1
    },
    dayOfWeek: {
      type: Number,
      min: 0,
      max: 6 // 0 = Sunday, 6 = Saturday
    },
    dayOfMonth: {
      type: Number,
      min: 1,
      max: 31
    },
    timeOfDay: {
      type: String,
      match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ // HH:MM format
    },
    timezone: {
      type: String,
      default: 'Africa/Nairobi'
    },
    customDays: [Number] // For custom frequencies
  },
  
  // Delivery details
  delivery: {
    address: {
      type: String,
      required: true
    },
    coordinates: {
      lat: Number,
      lng: Number
    },
    instructions: String,
    preferredTimeSlot: {
      start: String, // HH:MM
      end: String    // HH:MM
    },
    outlet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Outlet'
    }
  },
  
  // Pricing
  pricing: {
    subtotal: {
      type: Number,
      required: true,
      min: 0
    },
    deliveryFee: {
      type: Number,
      default: 0,
      min: 0
    },
    discount: {
      type: Number,
      default: 0,
      min: 0
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0
    }
  },
  
  // Payment configuration
  payment: {
    method: {
      type: String,
      enum: ['wallet', 'mpesa', 'paypal', 'stripe', 'cash_on_delivery'],
      required: true
    },
    autoPayment: {
      type: Boolean,
      default: true
    },
    paymentMethodId: String, // Saved payment method reference
    failureRetries: {
      type: Number,
      default: 3,
      min: 0,
      max: 5
    }
  },
  
  // Subscription lifecycle
  status: {
    type: String,
    enum: ['active', 'paused', 'cancelled', 'expired', 'payment_failed'],
    default: 'active',
    index: true
  },
  
  // Dates
  startDate: {
    type: Date,
    required: true,
    index: true
  },
  
  endDate: {
    type: Date,
    index: true
  },
  
  nextDelivery: {
    type: Date,
    required: true,
    index: true
  },
  
  lastDelivery: Date,
  
  // Pause functionality
  pausedUntil: Date,
  pauseReason: String,
  
  // Statistics
  stats: {
    totalOrders: {
      type: Number,
      default: 0
    },
    successfulDeliveries: {
      type: Number,
      default: 0
    },
    failedDeliveries: {
      type: Number,
      default: 0
    },
    totalSpent: {
      type: Number,
      default: 0
    },
    averageRating: {
      type: Number,
      min: 1,
      max: 5
    },
    lastPaymentFailure: Date,
    consecutiveFailures: {
      type: Number,
      default: 0
    }
  },
  
  // Customer preferences
  preferences: {
    skipHolidays: {
      type: Boolean,
      default: false
    },
    vacationMode: {
      enabled: {
        type: Boolean,
        default: false
      },
      startDate: Date,
      endDate: Date
    },
    substituteProducts: {
      type: Boolean,
      default: true
    },
    notifications: {
      beforeDelivery: {
        type: Number,
        default: 24 // Hours before delivery
      },
      paymentReminder: {
        type: Number,
        default: 48 // Hours before payment
      },
      enableSMS: {
        type: Boolean,
        default: true
      },
      enableEmail: {
        type: Boolean,
        default: true
      }
    }
  },
  
  // Modification history
  modifications: [{
    field: String,
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed,
    modifiedAt: {
      type: Date,
      default: Date.now
    },
    modifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: String
  }],
  
  // Generated orders
  orders: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EnhancedOrder'
  }],
  
  // Cancellation details
  cancellation: {
    cancelledAt: Date,
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: String,
    refundAmount: Number,
    refundStatus: {
      type: String,
      enum: ['pending', 'processed', 'failed']
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
subscriptionSchema.index({ customer: 1, status: 1 });
subscriptionSchema.index({ nextDelivery: 1, status: 1 });
subscriptionSchema.index({ 'payment.method': 1, status: 1 });
subscriptionSchema.index({ startDate: 1, endDate: 1 });
subscriptionSchema.index({ 'delivery.outlet': 1, status: 1 });

// Virtual properties
subscriptionSchema.virtual('isActive').get(function() {
  return this.status === 'active' && 
         (!this.endDate || this.endDate > new Date()) &&
         (!this.pausedUntil || this.pausedUntil <= new Date());
});

subscriptionSchema.virtual('daysUntilNextDelivery').get(function() {
  if (!this.nextDelivery) return null;
  const now = new Date();
  const diffTime = this.nextDelivery - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

subscriptionSchema.virtual('successRate').get(function() {
  const total = this.stats.successfulDeliveries + this.stats.failedDeliveries;
  if (total === 0) return 100;
  return (this.stats.successfulDeliveries / total) * 100;
});

subscriptionSchema.virtual('monthlyValue').get(function() {
  const frequency = this.schedule.frequency;
  const total = this.pricing.totalAmount;
  
  switch (frequency) {
    case 'daily': return total * 30;
    case 'weekly': return total * 4;
    case 'biweekly': return total * 2;
    case 'monthly': return total;
    default: return total;
  }
});

// Instance methods
subscriptionSchema.methods.calculateNextDelivery = function() {
  const current = this.nextDelivery || new Date();
  const schedule = this.schedule;
  
  let next = new Date(current);
  
  switch (schedule.frequency) {
    case 'daily':
      next.setDate(next.getDate() + schedule.interval);
      break;
    case 'weekly':
      next.setDate(next.getDate() + (7 * schedule.interval));
      break;
    case 'biweekly':
      next.setDate(next.getDate() + (14 * schedule.interval));
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + schedule.interval);
      break;
    default:
      // Custom frequency logic would go here
      break;
  }
  
  // Set time of day if specified
  if (schedule.timeOfDay) {
    const [hours, minutes] = schedule.timeOfDay.split(':').map(Number);
    next.setHours(hours, minutes, 0, 0);
  }
  
  // Skip holidays if preference is set
  if (this.preferences.skipHolidays) {
    next = this.skipHolidays(next);
  }
  
  // Check vacation mode
  if (this.preferences.vacationMode.enabled) {
    const vacationStart = this.preferences.vacationMode.startDate;
    const vacationEnd = this.preferences.vacationMode.endDate;
    
    if (next >= vacationStart && next <= vacationEnd) {
      next = new Date(vacationEnd);
      next.setDate(next.getDate() + 1);
    }
  }
  
  this.nextDelivery = next;
  return next;
};

subscriptionSchema.methods.skipHolidays = function(date) {
  // Simple holiday checking - in production, integrate with a holiday API
  const holidays = [
    '01-01', // New Year
    '12-25', // Christmas
    '12-26'  // Boxing Day
  ];
  
  const dateStr = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  
  if (holidays.includes(dateStr)) {
    date.setDate(date.getDate() + 1);
    return this.skipHolidays(date); // Recursive check
  }
  
  return date;
};

subscriptionSchema.methods.pause = function(reason, pauseUntil) {
  this.status = 'paused';
  this.pauseReason = reason;
  this.pausedUntil = pauseUntil;
  
  // Adjust next delivery date
  if (pauseUntil && this.nextDelivery < pauseUntil) {
    this.nextDelivery = new Date(pauseUntil);
    this.nextDelivery.setDate(this.nextDelivery.getDate() + 1);
  }
  
  return this.save();
};

subscriptionSchema.methods.resume = function() {
  this.status = 'active';
  this.pauseReason = undefined;
  this.pausedUntil = undefined;
  
  // Recalculate next delivery
  this.calculateNextDelivery();
  
  return this.save();
};

subscriptionSchema.methods.cancel = function(reason, cancelledBy) {
  this.status = 'cancelled';
  this.cancellation = {
    cancelledAt: new Date(),
    cancelledBy: cancelledBy,
    reason: reason
  };
  
  return this.save();
};

subscriptionSchema.methods.addModification = function(field, oldValue, newValue, modifiedBy, reason) {
  this.modifications.push({
    field: field,
    oldValue: oldValue,
    newValue: newValue,
    modifiedBy: modifiedBy,
    reason: reason
  });
  
  return this.save();
};

subscriptionSchema.methods.recordOrderGenerated = function(orderId) {
  this.orders.push(orderId);
  this.stats.totalOrders += 1;
  this.lastDelivery = new Date();
  
  return this.save();
};

subscriptionSchema.methods.recordDeliverySuccess = function(rating = null) {
  this.stats.successfulDeliveries += 1;
  this.stats.totalSpent += this.pricing.totalAmount;
  this.stats.consecutiveFailures = 0;
  
  if (rating) {
    const totalRatings = this.stats.successfulDeliveries;
    const currentAvg = this.stats.averageRating || 0;
    this.stats.averageRating = ((currentAvg * (totalRatings - 1)) + rating) / totalRatings;
  }
  
  return this.save();
};

subscriptionSchema.methods.recordDeliveryFailure = function(reason) {
  this.stats.failedDeliveries += 1;
  this.stats.consecutiveFailures += 1;
  this.stats.lastPaymentFailure = new Date();
  
  // Auto-pause after too many consecutive failures
  if (this.stats.consecutiveFailures >= this.payment.failureRetries) {
    this.pause('Too many consecutive payment failures', null);
  }
  
  return this.save();
};

subscriptionSchema.methods.updateDeliveryAddress = function(newAddress, coordinates, modifiedBy) {
  const oldAddress = this.delivery.address;
  
  this.delivery.address = newAddress;
  if (coordinates) {
    this.delivery.coordinates = coordinates;
  }
  
  this.addModification('delivery.address', oldAddress, newAddress, modifiedBy, 'Address update');
  
  return this.save();
};

subscriptionSchema.methods.updateItems = function(newItems, modifiedBy) {
  const oldItems = [...this.items];
  
  this.items = newItems;
  
  // Recalculate pricing
  this.pricing.subtotal = newItems.reduce((sum, item) => sum + item.totalPrice, 0);
  this.pricing.totalAmount = this.pricing.subtotal + this.pricing.deliveryFee - this.pricing.discount;
  
  this.addModification('items', oldItems, newItems, modifiedBy, 'Items update');
  
  return this.save();
};

subscriptionSchema.methods.updateSchedule = function(newSchedule, modifiedBy) {
  const oldSchedule = { ...this.schedule };
  
  this.schedule = { ...this.schedule, ...newSchedule };
  this.calculateNextDelivery();
  
  this.addModification('schedule', oldSchedule, this.schedule, modifiedBy, 'Schedule update');
  
  return this.save();
};

subscriptionSchema.methods.canGenerateOrder = function() {
  if (!this.isActive) return false;
  if (this.nextDelivery > new Date()) return false;
  if (this.pausedUntil && this.pausedUntil > new Date()) return false;
  
  return true;
};

// Static methods
subscriptionSchema.statics.generateSubscriptionNumber = function() {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const time = Date.now().toString().slice(-6);
  
  return `SUB${year}${month}${day}${time}`;
};

subscriptionSchema.statics.findDueForDelivery = function(date = new Date()) {
  return this.find({
    status: 'active',
    nextDelivery: { $lte: date },
    $or: [
      { pausedUntil: { $exists: false } },
      { pausedUntil: { $lte: date } }
    ]
  }).populate('customer items.product delivery.outlet');
};

subscriptionSchema.statics.findByCustomer = function(customerId, status = null) {
  const query = { customer: customerId };
  if (status) query.status = status;
  
  return this.find(query)
    .populate('items.product delivery.outlet')
    .sort({ createdAt: -1 });
};

subscriptionSchema.statics.getActiveSubscriptionsCount = function() {
  return this.countDocuments({ status: 'active' });
};

subscriptionSchema.statics.getRevenuePotential = function() {
  return this.aggregate([
    { $match: { status: 'active' } },
    {
      $group: {
        _id: '$schedule.frequency',
        count: { $sum: 1 },
        totalValue: { $sum: '$pricing.totalAmount' }
      }
    }
  ]);
};

// Pre-save middleware
subscriptionSchema.pre('save', function(next) {
  // Generate subscription number if not exists
  if (!this.subscriptionNumber) {
    this.subscriptionNumber = this.constructor.generateSubscriptionNumber();
  }
  
  // Calculate total amount if not set
  if (!this.pricing.totalAmount) {
    this.pricing.totalAmount = this.pricing.subtotal + this.pricing.deliveryFee - this.pricing.discount;
  }
  
  // Set initial next delivery if not set
  if (!this.nextDelivery && this.startDate) {
    this.nextDelivery = new Date(this.startDate);
    this.calculateNextDelivery();
  }
  
  next();
});

export default mongoose.model('Subscription', subscriptionSchema);












