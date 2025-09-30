const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  // Basic Information
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    match: [/^[6-9]\d{9}$/, 'Please enter a valid Indian phone number']
  },
  
  // Authentication
  isPhoneVerified: {
    type: Boolean,
    default: false
  },
  
  otp: {
    code: String,
    expiresAt: Date,
    attempts: {
      type: Number,
      default: 0
    }
  },
  
  // Profile Information
  name: {
    type: String,
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  
  email: {
    type: String,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  
  avatar: {
    type: String,
    default: ''
  },
  
  // Address & Location
  address: {
    fullAddress: String,
    pincode: String,
    city: String,
    state: String,
    country: { type: String, default: 'India' },
    coordinates: {
      latitude: Number,
      longitude: Number
    },
    geohash: String
  },
  
  isAddressVerified: {
    type: Boolean,
    default: false
  },
  
  neighborhood: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Neighborhood'
  },
  
  // Preferences
  language: {
    type: String,
    enum: ['en', 'hi'],
    default: 'en'
  },
  
  notifications: {
    push: { type: Boolean, default: true },
    email: { type: Boolean, default: false },
    sms: { type: Boolean, default: true },
    safetyAlerts: { type: Boolean, default: true },
    marketplace: { type: Boolean, default: true },
    events: { type: Boolean, default: true }
  },
  
  // Account Status
  status: {
    type: String,
    enum: ['active', 'suspended', 'deleted'],
    default: 'active'
  },
  
  role: {
    type: String,
    enum: ['user', 'moderator', 'admin'],
    default: 'user'
  },
  
  // Social Features
  joinedAt: {
    type: Date,
    default: Date.now
  },
  
  lastActiveAt: {
    type: Date,
    default: Date.now
  },
  
  // Push Notification Token
  pushToken: {
    type: String,
    default: ''
  },
  
  // Trust Score
  trustScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  
  // Verification Level
  verificationLevel: {
    type: String,
    enum: ['basic', 'phone', 'address', 'verified'],
    default: 'basic'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
userSchema.index({ phone: 1 });
userSchema.index({ 'address.geohash': 1 });
userSchema.index({ neighborhood: 1 });
userSchema.index({ status: 1, role: 1 });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return this.name || `User${this.phone.slice(-4)}`;
});

// Virtual for verification status
userSchema.virtual('isVerified').get(function() {
  return this.isPhoneVerified && this.isAddressVerified && this.status === 'active';
});

// Pre-save middleware for password hashing (if we add password auth later)
userSchema.pre('save', async function(next) {
  // Update verification level based on completed steps
  if (this.isPhoneVerified && this.isAddressVerified) {
    this.verificationLevel = 'verified';
  } else if (this.isAddressVerified) {
    this.verificationLevel = 'address';
  } else if (this.isPhoneVerified) {
    this.verificationLevel = 'phone';
  } else {
    this.verificationLevel = 'basic';
  }
  
  next();
});

// Instance methods
userSchema.methods.generateAuthToken = function() {
  return jwt.sign(
    { 
      id: this._id, 
      phone: this.phone, 
      role: this.role,
      neighborhood: this.neighborhood 
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '30d' }
  );
};

userSchema.methods.generateOTP = function() {
  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  
  this.otp = {
    code: otp,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    attempts: 0
  };
  
  return otp;
};

userSchema.methods.verifyOTP = function(otpCode) {
  if (!this.otp.code || !this.otp.expiresAt) {
    return { valid: false, message: 'No OTP found' };
  }
  
  if (this.otp.attempts >= 3) {
    return { valid: false, message: 'Maximum attempts exceeded' };
  }
  
  if (new Date() > this.otp.expiresAt) {
    return { valid: false, message: 'OTP expired' };
  }
  
  if (this.otp.code !== otpCode) {
    this.otp.attempts += 1;
    return { valid: false, message: 'Invalid OTP' };
  }
  
  // OTP is valid
  this.isPhoneVerified = true;
  this.otp = undefined; // Clear OTP after successful verification
  
  return { valid: true, message: 'OTP verified successfully' };
};

userSchema.methods.updateLastActive = function() {
  this.lastActiveAt = new Date();
  return this.save();
};

// Static methods
userSchema.statics.findByPhone = function(phone) {
  return this.findOne({ phone });
};

userSchema.statics.findByNeighborhood = function(neighborhoodId) {
  return this.find({ 
    neighborhood: neighborhoodId, 
    status: 'active',
    isPhoneVerified: true 
  });
};

module.exports = mongoose.model('User', userSchema);