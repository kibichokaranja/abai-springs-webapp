import mongoose from 'mongoose';

const supplierSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Supplier name is required'],
    trim: true,
    maxlength: [100, 'Supplier name cannot exceed 100 characters'],
    index: true
  },
  contactPerson: {
    type: String,
    trim: true,
    maxlength: [100, 'Contact person name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    index: true
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
    maxlength: [20, 'Phone number cannot exceed 20 characters']
  },
  address: {
    street: {
      type: String,
      trim: true,
      maxlength: [200, 'Street address cannot exceed 200 characters']
    },
    city: {
      type: String,
      trim: true,
      maxlength: [100, 'City cannot exceed 100 characters']
    },
    postalCode: {
      type: String,
      trim: true,
      maxlength: [20, 'Postal code cannot exceed 20 characters']
    },
    country: {
      type: String,
      trim: true,
      default: 'Kenya',
      maxlength: [100, 'Country cannot exceed 100 characters']
    }
  },
  itemsSupplied: [{
    type: String,
    trim: true,
    enum: ['bottles', 'bottle_tops', 'branding', 'labels', 'packaging', 'other']
  }],
  paymentTerms: {
    type: String,
    enum: ['cash', 'net_15', 'net_30', 'net_60', 'other'],
    default: 'net_30'
  },
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
supplierSchema.index({ name: 1, isActive: 1 });
supplierSchema.index({ email: 1 });
supplierSchema.index({ isActive: 1, createdAt: -1 });

export default mongoose.model('Supplier', supplierSchema);

