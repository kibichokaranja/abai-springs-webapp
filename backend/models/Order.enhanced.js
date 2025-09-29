import mongoose from 'mongoose';

// Delivery tracking schema
const deliveryTrackingSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: [
      'order_placed', 'confirmed', 'preparing', 'ready_for_pickup',
      'out_for_delivery', 'at_location', 'delivered', 'failed_delivery',
      'returned_to_outlet', 'cancelled'
    ],
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true
  },
  location: {
    lat: Number,
    lng: Number,
    address: String
  },
  notes: String,
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  automated: {
    type: Boolean,
    default: false
  }
}, { _id: false });

// Subscription details schema
const subscriptionSchema = new mongoose.Schema({
  isSubscription: {
    type: Boolean,
    default: false
  },
  subscriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscription'
  },
  frequency: {
    type: String,
    enum: ['daily', 'weekly', 'biweekly', 'monthly'],
    required: function() { return this.isSubscription; }
  },
  nextDelivery: Date,
  subscriptionOrder: {
    type: Number, // Which order number in the subscription (1st, 2nd, etc.)
    default: 1
  },
  autoRenew: {
    type: Boolean,
    default: true
  }
}, { _id: false });

// Driver assignment schema
const driverAssignmentSchema = new mongoose.Schema({
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  assignedAt: {
    type: Date,
    default: Date.now
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  estimatedArrival: Date,
  route: [{
    lat: Number,
    lng: Number,
    timestamp: Date
  }],
  currentLocation: {
    lat: Number,
    lng: Number,
    lastUpdated: Date
  }
}, { _id: false });

// Quality control schema
const qualityControlSchema = new mongoose.Schema({
  checkedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  checkedAt: {
    type: Date,
    default: Date.now
  },
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    quality: {
      type: String,
      enum: ['excellent', 'good', 'acceptable', 'poor'],
      default: 'good'
    },
    notes: String
  }],
  overallQuality: {
    type: String,
    enum: ['passed', 'failed', 'conditional'],
    default: 'passed'
  },
  notes: String
}, { _id: false });

// Customer feedback schema
const feedbackSchema = new mongoose.Schema({
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  comment: String,
  categories: {
    productQuality: { type: Number, min: 1, max: 5 },
    deliverySpeed: { type: Number, min: 1, max: 5 },
    driverService: { type: Number, min: 1, max: 5 },
    packaging: { type: Number, min: 1, max: 5 }
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  photos: [String], // URLs to uploaded photos
  wouldRecommend: Boolean
}, { _id: false });

// Enhanced order schema
const enhancedOrderSchema = new mongoose.Schema({
  // Core order information (inherited from original)
  orderNumber: {
    type: String,
    unique: true,
    required: true,
    index: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  outlet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Outlet',
    required: true,
    index: true
  },
  
  // Enhanced items with more details
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    variant: String, // Size, flavor, etc.
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
    },
    discountApplied: {
      type: Number,
      default: 0,
      min: 0
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    specialInstructions: String,
    substitutionAllowed: {
      type: Boolean,
      default: true
    },
    actualItem: { // In case of substitution
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
      },
      reason: String
    }
  }],
  
  // Pricing breakdown
  pricing: {
    subtotal: {
      type: Number,
      required: true,
      min: 0
    },
    discounts: {
      couponDiscount: { type: Number, default: 0 },
      loyaltyDiscount: { type: Number, default: 0 },
      bulkDiscount: { type: Number, default: 0 },
      promotionalDiscount: { type: Number, default: 0 }
    },
    fees: {
      deliveryFee: { type: Number, default: 0 },
      serviceFee: { type: Number, default: 0 },
      packagingFee: { type: Number, default: 0 }
    },
    taxes: {
      vat: { type: Number, default: 0 },
      serviceTax: { type: Number, default: 0 }
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0
    }
  },
  
  // Enhanced status management
  status: {
    current: {
      type: String,
      enum: [
        'draft', 'pending', 'confirmed', 'preparing', 'ready_for_pickup',
        'assigned_driver', 'out_for_delivery', 'at_location', 'delivered',
        'failed_delivery', 'returned', 'cancelled', 'refunded'
      ],
      default: 'pending',
      index: true
    },
    history: [deliveryTrackingSchema]
  },
  
  // Payment information
  payment: {
    method: {
      type: String,
      enum: ['wallet', 'mpesa', 'paypal', 'stripe', 'cash_on_delivery', 'bank_transfer'],
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'paid', 'failed', 'refunded', 'partially_refunded'],
      default: 'pending',
      index: true
    },
    gateway: String,
    transactionId: String,
    paidAt: Date,
    refundedAt: Date,
    refundAmount: Number,
    timing: {
      type: String,
      enum: ['on_order', 'on_delivery'],
      default: 'on_order'
    }
  },
  
  // Delivery details
  delivery: {
    type: {
      type: String,
      enum: ['home_delivery', 'pickup', 'office_delivery', 'scheduled_delivery'],
      default: 'home_delivery'
    },
    address: {
      type: String,
      required: function() { 
        return this.delivery.type !== 'pickup'; 
      }
    },
    coordinates: {
      lat: Number,
      lng: Number
    },
    instructions: String,
    contactPhone: String,
    alternateContact: {
      name: String,
      phone: String
    },
    accessInstructions: String, // Building access, gate codes, etc.
    preferredTimeSlot: {
      start: Date,
      end: Date
    },
    scheduledFor: Date,
    estimatedArrival: Date,
    actualArrival: Date,
    deliveryAttempts: {
      type: Number,
      default: 0
    },
    lastAttemptAt: Date,
    successfulDelivery: {
      type: Boolean,
      default: false
    },
    deliveryPhoto: String, // URL to delivery confirmation photo
    recipientName: String,
    deliveryNotes: String
  },
  
  // Driver assignment and tracking
  driverAssignment: driverAssignmentSchema,
  
  // Subscription details
  subscription: subscriptionSchema,
  
  // Quality control
  qualityControl: qualityControlSchema,
  
  // Customer communication
  communications: [{
    type: {
      type: String,
      enum: ['sms', 'email', 'push', 'call'],
      required: true
    },
    subject: String,
    message: String,
    sentAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['sent', 'delivered', 'failed', 'opened'],
      default: 'sent'
    },
    automated: {
      type: Boolean,
      default: false
    }
  }],
  
  // Customer feedback
  feedback: feedbackSchema,
  
  // Order source and attribution
  source: {
    platform: {
      type: String,
      enum: ['web', 'mobile_app', 'phone', 'whatsapp', 'admin'],
      default: 'web'
    },
    campaign: String, // Marketing campaign tracking
    referralCode: String,
    affiliate: String
  },
  
  // Special flags and notes
  flags: {
    isUrgent: { type: Boolean, default: false },
    isGift: { type: Boolean, default: false },
    requiresID: { type: Boolean, default: false },
    fragile: { type: Boolean, default: false },
    bulkOrder: { type: Boolean, default: false },
    vipCustomer: { type: Boolean, default: false }
  },
  
  // Business logic fields
  business: {
    assignedOutlet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Outlet'
    },
    preparationTime: Number, // Minutes
    estimatedDeliveryTime: Number, // Minutes
    actualPreparationTime: Number,
    actualDeliveryTime: Number,
    costAnalysis: {
      productCost: Number,
      deliveryCost: Number,
      operationalCost: Number,
      profit: Number,
      profitMargin: Number
    }
  },
  
  // Inventory impact
  inventory: {
    reserved: [{
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
      },
      quantity: Number,
      reservedAt: Date
    }],
    fulfilled: [{
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
      },
      quantity: Number,
      fulfilledAt: Date,
      batchNumber: String
    }]
  },
  
  // Integration fields
  integrations: {
    externalOrderId: String, // For third-party integrations
    syncStatus: {
      type: String,
      enum: ['pending', 'synced', 'failed'],
      default: 'pending'
    },
    lastSyncAt: Date
  },
  
  // Metadata
  metadata: {
    userAgent: String,
    ipAddress: String,
    sessionId: String,
    customerNotes: String,
    internalNotes: String,
    tags: [String]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Enhanced indexes
enhancedOrderSchema.index({ orderNumber: 1 }, { unique: true });
enhancedOrderSchema.index({ customer: 1, createdAt: -1 });
enhancedOrderSchema.index({ outlet: 1, 'status.current': 1 });
enhancedOrderSchema.index({ 'status.current': 1, createdAt: -1 });
enhancedOrderSchema.index({ 'payment.status': 1, createdAt: -1 });
enhancedOrderSchema.index({ 'delivery.scheduledFor': 1 });
enhancedOrderSchema.index({ 'driverAssignment.driver': 1, 'status.current': 1 });
enhancedOrderSchema.index({ 'subscription.isSubscription': 1, 'subscription.nextDelivery': 1 });
enhancedOrderSchema.index({ 'source.platform': 1, createdAt: -1 });
enhancedOrderSchema.index({ 'flags.isUrgent': 1, createdAt: -1 });
enhancedOrderSchema.index({ 'pricing.totalAmount': 1, createdAt: -1 });

// Virtual properties
enhancedOrderSchema.virtual('orderSummary').get(function() {
  return {
    orderNumber: this.orderNumber,
    totalItems: this.items.reduce((sum, item) => sum + item.quantity, 0),
    totalAmount: this.pricing.totalAmount,
    status: this.status.current,
    paymentStatus: this.payment.status,
    isSubscription: this.subscription.isSubscription,
    deliveryType: this.delivery.type
  };
});

enhancedOrderSchema.virtual('timeMetrics').get(function() {
  const now = new Date();
  const orderAge = now - this.createdAt;
  
  return {
    orderAge: Math.floor(orderAge / (1000 * 60)), // Age in minutes
    preparationTime: this.business.actualPreparationTime,
    deliveryTime: this.business.actualDeliveryTime,
    totalFulfillmentTime: (this.business.actualPreparationTime || 0) + (this.business.actualDeliveryTime || 0),
    isOverdue: this.delivery.estimatedArrival && now > this.delivery.estimatedArrival
  };
});

enhancedOrderSchema.virtual('customerSatisfaction').get(function() {
  if (!this.feedback.rating) return null;
  
  return {
    overall: this.feedback.rating,
    categories: this.feedback.categories,
    wouldRecommend: this.feedback.wouldRecommend,
    hasComment: !!this.feedback.comment
  };
});

// Instance methods
enhancedOrderSchema.methods.updateStatus = function(newStatus, notes = '', updatedBy = null, location = null) {
  const statusUpdate = {
    status: newStatus,
    timestamp: new Date(),
    notes: notes,
    updatedBy: updatedBy,
    location: location,
    automated: !updatedBy
  };
  
  this.status.history.push(statusUpdate);
  this.status.current = newStatus;
  
  return this.save();
};

enhancedOrderSchema.methods.assignDriver = function(driverId, assignedBy, estimatedArrival) {
  this.driverAssignment = {
    driver: driverId,
    assignedAt: new Date(),
    assignedBy: assignedBy,
    estimatedArrival: estimatedArrival
  };
  
  this.updateStatus('assigned_driver', `Driver assigned: ${driverId}`, assignedBy);
  
  return this.save();
};

enhancedOrderSchema.methods.updateDriverLocation = function(lat, lng) {
  if (!this.driverAssignment.driver) {
    throw new Error('No driver assigned to this order');
  }
  
  this.driverAssignment.currentLocation = {
    lat: lat,
    lng: lng,
    lastUpdated: new Date()
  };
  
  this.driverAssignment.route.push({
    lat: lat,
    lng: lng,
    timestamp: new Date()
  });
  
  return this.save();
};

enhancedOrderSchema.methods.addCommunication = function(type, subject, message, automated = false) {
  this.communications.push({
    type: type,
    subject: subject,
    message: message,
    automated: automated
  });
  
  return this.save();
};

enhancedOrderSchema.methods.calculateProfitability = function() {
  const revenue = this.pricing.totalAmount;
  const costs = this.business.costAnalysis;
  
  if (!costs) return null;
  
  const totalCost = (costs.productCost || 0) + (costs.deliveryCost || 0) + (costs.operationalCost || 0);
  const profit = revenue - totalCost;
  const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;
  
  this.business.costAnalysis.profit = profit;
  this.business.costAnalysis.profitMargin = profitMargin;
  
  return {
    revenue: revenue,
    totalCost: totalCost,
    profit: profit,
    profitMargin: profitMargin
  };
};

enhancedOrderSchema.methods.canBeCancelled = function() {
  const nonCancellableStatuses = ['delivered', 'cancelled', 'refunded', 'out_for_delivery'];
  return !nonCancellableStatuses.includes(this.status.current);
};

enhancedOrderSchema.methods.getEstimatedDeliveryWindow = function() {
  if (!this.delivery.scheduledFor) return null;
  
  const start = new Date(this.delivery.scheduledFor);
  const end = new Date(start.getTime() + (this.business.estimatedDeliveryTime || 60) * 60000);
  
  return { start, end };
};

// Static methods
enhancedOrderSchema.statics.generateOrderNumber = function() {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const time = Date.now().toString().slice(-6);
  
  return `AB${year}${month}${day}${time}`;
};

enhancedOrderSchema.statics.findByStatus = function(status) {
  return this.find({ 'status.current': status });
};

enhancedOrderSchema.statics.findActiveDeliveries = function() {
  return this.find({
    'status.current': { 
      $in: ['out_for_delivery', 'at_location', 'assigned_driver'] 
    }
  }).populate('driverAssignment.driver customer outlet');
};

enhancedOrderSchema.statics.findOverdueOrders = function() {
  return this.find({
    'delivery.estimatedArrival': { $lt: new Date() },
    'status.current': { $nin: ['delivered', 'cancelled', 'refunded'] }
  });
};

enhancedOrderSchema.statics.getOrderMetrics = function(startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$pricing.totalAmount' },
        averageOrderValue: { $avg: '$pricing.totalAmount' },
        completedOrders: {
          $sum: { $cond: [{ $eq: ['$status.current', 'delivered'] }, 1, 0] }
        },
        cancelledOrders: {
          $sum: { $cond: [{ $eq: ['$status.current', 'cancelled'] }, 1, 0] }
        }
      }
    }
  ]);
};

// Pre-save middleware
enhancedOrderSchema.pre('save', function(next) {
  // Generate order number if not exists
  if (!this.orderNumber) {
    this.orderNumber = this.constructor.generateOrderNumber();
  }
  
  // Calculate total amount if not set
  if (!this.pricing.totalAmount) {
    this.pricing.totalAmount = this.pricing.subtotal + 
                               Object.values(this.pricing.fees).reduce((a, b) => a + b, 0) +
                               Object.values(this.pricing.taxes).reduce((a, b) => a + b, 0) -
                               Object.values(this.pricing.discounts).reduce((a, b) => a + b, 0);
  }
  
  next();
});

export default mongoose.model('EnhancedOrder', enhancedOrderSchema);











