import mongoose from 'mongoose';

const stockMovementSchema = new mongoose.Schema({
  type: {
    type: String,
    required: [true, 'Movement type is required'],
    enum: ['inbound', 'outbound', 'transfer', 'adjustment'],
    default: 'inbound'
  },
  product: {
    type: String,
    required: [true, 'Product is required'],
    trim: true,
    maxlength: [100, 'Product name cannot exceed 100 characters']
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1']
  },
  date: {
    type: Date,
    required: [true, 'Movement date is required'],
    default: Date.now
  },
  reason: {
    type: String,
    required: [true, 'Reason for movement is required'],
    trim: true,
    maxlength: [200, 'Reason cannot exceed 200 characters']
  },
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  location: {
    from: {
      type: String,
      trim: true,
      maxlength: [100, 'From location cannot exceed 100 characters']
    },
    to: {
      type: String,
      trim: true,
      maxlength: [100, 'To location cannot exceed 100 characters']
    }
  },
  reference: {
    type: String,
    trim: true,
    maxlength: [100, 'Reference cannot exceed 100 characters']
  },
  authorizedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: [true, 'Authorized by is required']
  },
  cost: {
    type: Number,
    min: [0, 'Cost cannot be negative']
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'completed', 'cancelled'],
    default: 'pending'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
stockMovementSchema.index({ type: 1 });
stockMovementSchema.index({ product: 1 });
stockMovementSchema.index({ date: -1 });
stockMovementSchema.index({ status: 1 });
stockMovementSchema.index({ authorizedBy: 1 });

// Virtual for movement description
stockMovementSchema.virtual('description').get(function() {
  return `${this.type.toUpperCase()}: ${this.quantity} units of ${this.product}`;
});

// Virtual for isCompleted
stockMovementSchema.virtual('isCompleted').get(function() {
  return this.status === 'completed';
});

// Pre-save middleware
stockMovementSchema.pre('save', function(next) {
  // Set default location based on type
  if (this.type === 'inbound' && !this.location.to) {
    this.location.to = 'Main Warehouse';
  }
  if (this.type === 'outbound' && !this.location.from) {
    this.location.from = 'Main Warehouse';
  }
  
  next();
});

// Static method to get movements by type
stockMovementSchema.statics.getByType = function(type) {
  return this.find({ type: type }).sort({ date: -1 });
};

// Static method to get movements by product
stockMovementSchema.statics.getByProduct = function(product) {
  return this.find({ product: product }).sort({ date: -1 });
};

// Static method to get movements by date range
stockMovementSchema.statics.getByDateRange = function(startDate, endDate) {
  return this.find({
    date: {
      $gte: startDate,
      $lte: endDate
    }
  }).sort({ date: -1 });
};

// Static method to get pending movements
stockMovementSchema.statics.getPending = function() {
  return this.find({ status: 'pending' }).sort({ date: 1 });
};

const StockMovement = mongoose.model('StockMovement', stockMovementSchema);

export default StockMovement;
















































































