import mongoose from 'mongoose';

const salespersonSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Salesperson name is required'],
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
  territory: {
    type: String,
    required: [true, 'Sales territory is required'],
    trim: true,
    maxlength: [100, 'Territory cannot exceed 100 characters']
  },
  salesTarget: {
    type: Number,
    required: [true, 'Monthly sales target is required'],
    min: [0, 'Sales target cannot be negative']
  },
  currentSales: {
    type: Number,
    default: 0,
    min: [0, 'Current sales cannot be negative']
  },
  commission: {
    type: Number,
    default: 0.05, // 5% default commission
    min: [0, 'Commission cannot be negative'],
    max: [1, 'Commission cannot exceed 100%']
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'on-leave', 'terminated'],
    default: 'active'
  },
  hireDate: {
    type: Date,
    default: Date.now
  },
  manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff'
  },
  performance: {
    monthlyTargets: [{
      month: {
        type: String,
        required: true
      },
      target: Number,
      achieved: Number,
      percentage: Number
    }],
    totalSales: {
      type: Number,
      default: 0
    },
    totalOrders: {
      type: Number,
      default: 0
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
salespersonSchema.index({ email: 1 });
salespersonSchema.index({ territory: 1 });
salespersonSchema.index({ status: 1 });
salespersonSchema.index({ 'performance.totalSales': -1 });

// Virtual for target achievement percentage
salespersonSchema.virtual('targetAchievement').get(function() {
  if (this.salesTarget === 0) return 0;
  return Math.round((this.currentSales / this.salesTarget) * 100);
});

// Virtual for isActive
salespersonSchema.virtual('isActive').get(function() {
  return this.status === 'active';
});

// Pre-save middleware
salespersonSchema.pre('save', function(next) {
  // Ensure email is lowercase
  if (this.email) {
    this.email = this.email.toLowerCase();
  }
  
  // Calculate target achievement percentage
  if (this.salesTarget > 0) {
    this.performance = this.performance || {};
    this.performance.totalSales = this.currentSales;
  }
  
  next();
});

// Static method to get top performers
salespersonSchema.statics.getTopPerformers = function(limit = 10) {
  return this.find({ status: 'active' })
    .sort({ 'performance.totalSales': -1 })
    .limit(limit);
};

// Static method to get salespeople by territory
salespersonSchema.statics.getByTerritory = function(territory) {
  return this.find({ territory: territory, status: 'active' });
};

const Salesperson = mongoose.model('Salesperson', salespersonSchema);

export default Salesperson;











































