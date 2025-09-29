import mongoose from 'mongoose';

const staffSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Staff name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
    match: [/^(\+254|0)[17]\d{8}$/, 'Please enter a valid Kenyan phone number']
  },
  role: {
    type: String,
    required: [true, 'Role is required'],
    enum: ['admin', 'sales', 'driver', 'warehouse', 'manager', 'staff'],
    default: 'staff'
  },
  department: {
    type: String,
    enum: ['sales', 'operations', 'logistics', 'administration', 'finance', 'marketing'],
    default: 'operations'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'pending', 'suspended'],
    default: 'active'
  },
  hireDate: {
    type: Date,
    default: Date.now
  },
  salary: {
    type: Number,
    min: [0, 'Salary cannot be negative']
  },
  manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff'
  },
  permissions: [{
    type: String,
    enum: ['read', 'write', 'delete', 'admin']
  }],
  lastLogin: {
    type: Date
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
staffSchema.index({ email: 1 });
staffSchema.index({ role: 1 });
staffSchema.index({ department: 1 });
staffSchema.index({ status: 1 });

// Virtual for full name
staffSchema.virtual('fullName').get(function() {
  return this.name;
});

// Virtual for isActive
staffSchema.virtual('isActive').get(function() {
  return this.status === 'active';
});

// Pre-save middleware
staffSchema.pre('save', function(next) {
  // Ensure email is lowercase
  if (this.email) {
    this.email = this.email.toLowerCase();
  }
  next();
});

// Static method to get active staff count
staffSchema.statics.getActiveCount = function() {
  return this.countDocuments({ status: 'active' });
};

// Static method to get staff by role
staffSchema.statics.getByRole = function(role) {
  return this.find({ role: role, status: 'active' });
};

const Staff = mongoose.model('Staff', staffSchema);

export default Staff;











































