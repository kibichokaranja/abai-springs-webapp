import mongoose from 'mongoose';

const outletSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Outlet name is required'],
    trim: true,
    maxlength: [100, 'Outlet name cannot exceed 100 characters'],
    index: true // Index for outlet name searches
  },
  address: {
    type: String,
    required: [true, 'Outlet address is required'],
    index: true // Index for address searches
  },
  phone: {
    type: String,
    required: [true, 'Outlet phone is required'],
    match: [/^(\+254|0)[17]\d{8}$/, 'Please enter a valid Kenyan phone number'],
    index: true // Index for phone number lookups
  },
  email: {
    type: String,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email'],
    index: true // Index for email lookups
  },
  coordinates: {
    lat: {
      type: Number,
      required: false
    },
    lng: {
      type: Number,
      required: false
    }
  },
  deliveryZones: [{
    name: String,
    radius: Number, // in kilometers
    deliveryFee: {
      type: Number,
      default: 0
    }
  }],
  operatingHours: {
    monday: { open: String, close: String },
    tuesday: { open: String, close: String },
    wednesday: { open: String, close: String },
    thursday: { open: String, close: String },
    friday: { open: String, close: String },
    saturday: { open: String, close: String },
    sunday: { open: String, close: String }
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true // Index for active outlet queries
  },
  manager: {
    name: String,
    phone: String,
    email: String
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  features: [{
    type: String,
    enum: ['delivery', 'pickup', 'bulk_orders', 'subscription']
  }]
}, {
  timestamps: true
});

// Compound indexes for common query patterns
outletSchema.index({ coordinates: '2dsphere' }); // Geospatial queries
outletSchema.index({ isActive: 1 }); // Active outlets
outletSchema.index({ name: 1, isActive: 1 }); // Name + active status
outletSchema.index({ address: 1, isActive: 1 }); // Address + active status
outletSchema.index({ createdAt: -1, isActive: 1 }); // Recent outlets
outletSchema.index({ updatedAt: -1, isActive: 1 }); // Recently updated

// Text search index for outlet search
outletSchema.index({ 
  name: 'text', 
  address: 'text',
  description: 'text'
}, {
  weights: {
    name: 10,
    address: 8,
    description: 4
  }
});

// Features index for filtering
outletSchema.index({ 'features': 1, isActive: 1 });

// Virtual for full address
outletSchema.virtual('fullAddress').get(function() {
  return `${this.address}`;
});

// Ensure virtuals are included in JSON output
outletSchema.set('toJSON', { virtuals: true });

export default mongoose.model('Outlet', outletSchema); 