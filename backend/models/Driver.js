import mongoose from 'mongoose';

const driverSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Driver name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
    match: [/^(\+254|0)[17]\d{8}$/, 'Please enter a valid Kenyan phone number']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  license: {
    type: String,
    required: [true, 'Driver license number is required'],
    unique: true,
    trim: true,
    maxlength: [20, 'License number cannot exceed 20 characters']
  },
  vehicle: {
    type: String,
    required: [true, 'Vehicle information is required'],
    trim: true,
    maxlength: [100, 'Vehicle info cannot exceed 100 characters']
  },
  territory: {
    type: String,
    required: [true, 'Delivery territory is required'],
    trim: true,
    maxlength: [100, 'Territory cannot exceed 100 characters']
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'on-delivery', 'off-duty', 'suspended'],
    default: 'active'
  },
  hireDate: {
    type: Date,
    default: Date.now
  },
  experience: {
    type: Number,
    min: [0, 'Experience cannot be negative'],
    default: 0
  },
  rating: {
    type: Number,
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5'],
    default: 5
  },
  performance: {
    totalDeliveries: {
      type: Number,
      default: 0
    },
    successfulDeliveries: {
      type: Number,
      default: 0
    },
    totalDistance: {
      type: Number,
      default: 0
    },
    averageDeliveryTime: {
      type: Number,
      default: 0
    }
  },
  currentLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      default: [0, 0]
    }
  },
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
driverSchema.index({ email: 1 });
driverSchema.index({ license: 1 });
driverSchema.index({ territory: 1 });
driverSchema.index({ status: 1 });
driverSchema.index({ currentLocation: '2dsphere' });

// Virtual for delivery success rate
driverSchema.virtual('successRate').get(function() {
  if (this.performance.totalDeliveries === 0) return 0;
  return Math.round((this.performance.successfulDeliveries / this.performance.totalDeliveries) * 100);
});

// Virtual for isActive
driverSchema.virtual('isActive').get(function() {
  return this.status === 'active';
});

// Pre-save middleware
driverSchema.pre('save', function(next) {
  // Ensure email is lowercase
  if (this.email) {
    this.email = this.email.toLowerCase();
  }
  
  // Calculate success rate
  if (this.performance.totalDeliveries > 0) {
    this.performance = this.performance || {};
  }
  
  next();
});

// Static method to get available drivers
driverSchema.statics.getAvailable = function() {
  return this.find({ status: 'active' });
};

// Static method to get drivers by territory
driverSchema.statics.getByTerritory = function(territory) {
  return this.find({ territory: territory, status: 'active' });
};

// Static method to get top performing drivers
driverSchema.statics.getTopPerformers = function(limit = 10) {
  return this.find({ status: 'active' })
    .sort({ 'performance.successfulDeliveries': -1 })
    .limit(limit);
};

const Driver = mongoose.model('Driver', driverSchema);

export default Driver;
















































































