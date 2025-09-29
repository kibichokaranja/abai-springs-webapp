import mongoose from 'mongoose';

const newsletterSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email address']
  },
  name: {
    type: String,
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  phone: {
    type: String,
    trim: true,
    match: [/^(\+254|0)[1-9]\d{8}$/, 'Please enter a valid Kenyan phone number']
  },
  preferences: {
    emailUpdates: { type: Boolean, default: true },
    whatsappUpdates: { type: Boolean, default: false },
    promotions: { type: Boolean, default: true },
    productUpdates: { type: Boolean, default: true },
    deliveryUpdates: { type: Boolean, default: true }
  },
  isActive: { type: Boolean, default: true },
  subscribedAt: { type: Date, default: Date.now },
  lastEmailSent: { type: Date },
  lastWhatsappSent: { type: Date },
  source: { type: String, default: 'website' } // website, admin, api
}, { timestamps: true });

// Index for efficient queries
newsletterSchema.index({ email: 1 });
newsletterSchema.index({ isActive: 1 });
newsletterSchema.index({ 'preferences.emailUpdates': 1 });
newsletterSchema.index({ 'preferences.whatsappUpdates': 1 });

// Virtual for subscription status
newsletterSchema.virtual('status').get(function() {
  if (!this.isActive) return 'unsubscribed';
  if (this.preferences.emailUpdates || this.preferences.whatsappUpdates) return 'active';
  return 'inactive';
});

// Method to update preferences
newsletterSchema.methods.updatePreferences = function(newPreferences) {
  this.preferences = { ...this.preferences, ...newPreferences };
  return this.save();
};

// Method to unsubscribe
newsletterSchema.methods.unsubscribe = function() {
  this.isActive = false;
  this.preferences.emailUpdates = false;
  this.preferences.whatsappUpdates = false;
  return this.save();
};

// Static method to get active subscribers
newsletterSchema.statics.getActiveSubscribers = function() {
  return this.find({ 
    isActive: true,
    $or: [
      { 'preferences.emailUpdates': true },
      { 'preferences.whatsappUpdates': true }
    ]
  });
};

// Static method to get email subscribers
newsletterSchema.statics.getEmailSubscribers = function() {
  return this.find({ 
    isActive: true,
    'preferences.emailUpdates': true 
  });
};

// Static method to get WhatsApp subscribers
newsletterSchema.statics.getWhatsappSubscribers = function() {
  return this.find({ 
    isActive: true,
    'preferences.whatsappUpdates': true,
    phone: { $exists: true, $ne: '' }
  });
};

newsletterSchema.set('toJSON', { virtuals: true });
export default mongoose.model('Newsletter', newsletterSchema);











