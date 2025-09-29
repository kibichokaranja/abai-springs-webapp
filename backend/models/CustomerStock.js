import mongoose from 'mongoose';

const { ObjectId } = mongoose.Types;

const customerStockSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  customerEmail: {
    type: String,
    required: true,
    index: true
  },
  customerPhone: {
    type: String,
    required: true
  },
  customerName: {
    type: String,
    required: true
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productName: {
    type: String,
    required: true
  },
  currentStock: {
    type: Number,
    default: 0,
    min: 0
  },
  consumptionRate: {
    type: Number,
    default: 0, // bottles per day
    min: 0
  },
  averageOrderSize: {
    type: Number,
    default: 0,
    min: 0
  },
  averageOrderFrequency: {
    type: Number,
    default: 0, // days between orders
    min: 0
  },
  lastOrderDate: {
    type: Date,
    default: Date.now
  },
  predictedRunOutDate: {
    type: Date
  },
  alertThreshold: {
    type: Number,
    default: 2, // alert when stock reaches this level
    min: 1
  },
  alertSettings: {
    email: {
      type: Boolean,
      default: true
    },
    whatsapp: {
      type: Boolean,
      default: true
    },
    sms: {
      type: Boolean,
      default: false
    }
  },
  consumptionHistory: [{
    date: {
      type: Date,
      default: Date.now
    },
    quantityConsumed: {
      type: Number,
      required: true
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: false
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  lastAlertSent: {
    type: Date
  },
  alertLevel: {
    type: String,
    enum: ['none', 'warning', 'urgent', 'critical'],
    default: 'none'
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
customerStockSchema.index({ customerEmail: 1, product: 1 }, { unique: true });
customerStockSchema.index({ customerEmail: 1 });
customerStockSchema.index({ predictedRunOutDate: 1 });
customerStockSchema.index({ alertLevel: 1 });

// Virtual for days until run out
customerStockSchema.virtual('daysUntilRunOut').get(function() {
  if (!this.predictedRunOutDate || this.consumptionRate === 0) {
    return null;
  }
  const now = new Date();
  const diffTime = this.predictedRunOutDate - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Method to update stock after order
customerStockSchema.methods.updateStockAfterOrder = function(orderQuantity) {
  this.currentStock += orderQuantity;
  this.lastOrderDate = new Date();
  
  // Update consumption history
  this.consumptionHistory.push({
    date: new Date(),
    quantityConsumed: orderQuantity
  });
  
  // Keep only last 10 consumption records
  if (this.consumptionHistory.length > 10) {
    this.consumptionHistory = this.consumptionHistory.slice(-10);
  }
  
  // Recalculate consumption rate
  this.calculateConsumptionRate();
  
  // Update predicted run out date
  this.updatePredictedRunOutDate();
  
  return this.save();
};

// Method to calculate consumption rate
customerStockSchema.methods.calculateConsumptionRate = function() {
  if (this.consumptionHistory.length < 2) {
    this.consumptionRate = 0;
    return;
  }
  
  // Calculate average consumption per day based on history
  const totalConsumption = this.consumptionHistory.reduce((sum, record) => sum + record.quantityConsumed, 0);
  const daysSpan = (this.consumptionHistory[this.consumptionHistory.length - 1].date - this.consumptionHistory[0].date) / (1000 * 60 * 60 * 24);
  
  if (daysSpan > 0) {
    this.consumptionRate = totalConsumption / daysSpan;
  } else {
    this.consumptionRate = 0;
  }
};

// Method to update predicted run out date
customerStockSchema.methods.updatePredictedRunOutDate = function() {
  if (this.consumptionRate > 0) {
    const daysUntilRunOut = this.currentStock / this.consumptionRate;
    this.predictedRunOutDate = new Date(Date.now() + (daysUntilRunOut * 24 * 60 * 60 * 1000));
  } else {
    this.predictedRunOutDate = null;
  }
};

// Method to check if alert should be sent
customerStockSchema.methods.shouldSendAlert = function() {
  if (this.currentStock <= this.alertThreshold) {
    // Check if we haven't sent an alert recently (avoid spam)
    const now = new Date();
    const lastAlert = this.lastAlertSent;
    
    if (!lastAlert || (now - lastAlert) > (24 * 60 * 60 * 1000)) { // 24 hours
      return true;
    }
  }
  return false;
};

// Method to update alert level
customerStockSchema.methods.updateAlertLevel = function() {
  if (this.currentStock <= 0) {
    this.alertLevel = 'critical';
  } else if (this.currentStock <= this.alertThreshold) {
    this.alertLevel = 'urgent';
  } else if (this.currentStock <= (this.alertThreshold * 2)) {
    this.alertLevel = 'warning';
  } else {
    this.alertLevel = 'none';
  }
};

// Static method to find customers needing alerts
customerStockSchema.statics.findCustomersNeedingAlerts = function() {
  return this.find({
    isActive: true,
    $expr: { $lte: ['$currentStock', '$alertThreshold'] },
    $or: [
      { lastAlertSent: { $exists: false } },
      { lastAlertSent: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } // 24 hours ago
    ]
  }).populate('product');
};

// Static method to create or update customer stock
customerStockSchema.statics.createOrUpdateCustomerStock = async function(customerInfo, orderItems) {
  const results = [];
  
  for (const item of orderItems) {
    const productId = item.product;
    const quantity = item.quantity;
    
    try {
      // Find existing customer stock record
      let customerStock = await this.findOne({
        customerEmail: customerInfo.email,
        product: productId
      });
      
      if (customerStock) {
        // Update existing record
        await customerStock.updateStockAfterOrder(quantity);
        results.push(customerStock);
      } else {
        // Create new record with proper error handling
        const customerStockData = {
          customer: customerInfo.userId && ObjectId.isValid(customerInfo.userId) ? new ObjectId(customerInfo.userId) : null,
          customerEmail: customerInfo.email,
          customerPhone: customerInfo.phone || 'Not provided',
          customerName: customerInfo.name || 'Valued Customer',
          product: ObjectId.isValid(productId) ? new ObjectId(productId) : productId,
          productName: item.productName || 'Unknown Product',
          currentStock: quantity,
          alertThreshold: this.calculateDefaultAlertThreshold(quantity),
          consumptionHistory: [{
            date: new Date(),
            quantityConsumed: quantity,
            orderId: item.orderId && ObjectId.isValid(item.orderId) ? new ObjectId(item.orderId) : null
          }]
        };
        
        customerStock = new this(customerStockData);
        await customerStock.save();
        results.push(customerStock);
      }
    } catch (error) {
      // Handle duplicate key errors gracefully
      if (error.code === 11000) {
        console.log(`⚠️ Duplicate customer stock record found for ${customerInfo.email} and product ${productId}, updating existing record`);
        
        // Try to find and update the existing record
        const existingStock = await this.findOne({
          customerEmail: customerInfo.email,
          product: productId
        });
        
        if (existingStock) {
          await existingStock.updateStockAfterOrder(quantity);
          results.push(existingStock);
        }
      } else {
        console.error('❌ Error creating/updating customer stock:', error.message);
        throw error;
      }
    }
  }
  
  return results;
};

// Static method to calculate default alert threshold
customerStockSchema.statics.calculateDefaultAlertThreshold = function(orderQuantity) {
  // Smart threshold based on order size
  if (orderQuantity <= 2) {
    return 1; // Alert when 1 bottle left
  } else if (orderQuantity <= 5) {
    return 2; // Alert when 2 bottles left
  } else if (orderQuantity <= 10) {
    return 3; // Alert when 3 bottles left
  } else {
    return Math.ceil(orderQuantity * 0.2); // 20% of order size
  }
};

export default mongoose.model('CustomerStock', customerStockSchema);
