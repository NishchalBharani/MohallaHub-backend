const mongoose = require('mongoose');

const marketplaceSchema = new mongoose.Schema({
  // Seller Information
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Item Details
  title: {
    type: String,
    required: [true, 'Item title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  
  description: {
    type: String,
    required: [true, 'Item description is required'],
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  
  category: {
    type: String,
    required: true,
    enum: [
      'electronics', 'furniture', 'vehicles', 'clothing', 'books', 'sports',
      'home_garden', 'baby_kids', 'services', 'jobs', 'real_estate', 'other'
    ]
  },
  
  condition: {
    type: String,
    required: true,
    enum: ['new', 'like_new', 'good', 'fair', 'poor']
  },
  
  price: {
    amount: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative']
    },
    currency: {
      type: String,
      default: 'INR'
    },
    isNegotiable: {
      type: Boolean,
      default: true
    },
    originalPrice: Number // For showing discount
  },
  
  // Item Type
  type: {
    type: String,
    enum: ['sell', 'buy', 'rent', 'free'],
    default: 'sell'
  },
  
  // Images
  images: [{
    url: {
      type: String,
      required: true
    },
    filename: String,
    size: Number,
    mimeType: String,
    isPrimary: {
      type: Boolean,
      default: false
    }
  }],
  
  // Location Context
  neighborhood: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Neighborhood',
    required: true
  },
  
  location: {
    address: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  
  // Availability
  isAvailable: {
    type: Boolean,
    default: true
  },
  
  availabilityStatus: {
    type: String,
    enum: ['available', 'reserved', 'sold', 'expired'],
    default: 'available'
  },
  
  // Contact Information
  contactPreference: {
    type: String,
    enum: ['chat', 'phone', 'both'],
    default: 'both'
  },
  
  phoneNumber: String, // Optional contact number
  
  // UPI Payment Information (Display only in MVP)
  upiId: String, // For future payment integration
  
  // Engagement
  views: {
    type: Number,
    default: 0
  },
  
  likes: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Interested Buyers
  interestedUsers: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    message: String,
    contactInfo: String,
    status: {
      type: String,
      enum: ['interested', 'contacted', 'negotiating', 'sold'],
      default: 'interested'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Metadata
  tags: [String],
  
  // Expiry
  expiresAt: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    }
  },
  
  // Status
  status: {
    type: String,
    enum: ['active', 'hidden', 'deleted', 'reported', 'expired'],
    default: 'active'
  },
  
  // Moderation
  isReported: {
    type: Boolean,
    default: false
  },
  
  reports: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: {
      type: String,
      enum: ['spam', 'inappropriate', 'fraudulent', 'prohibited', 'other']
    },
    description: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
marketplaceSchema.index({ seller: 1, createdAt: -1 });
marketplaceSchema.index({ neighborhood: 1, status: 1, createdAt: -1 });
marketplaceSchema.index({ category: 1, status: 1 });
marketplaceSchema.index({ type: 1, status: 1 });
marketplaceSchema.index({ 'price.amount': 1 });
marketplaceSchema.index({ expiresAt: 1 });
marketplaceSchema.index({ tags: 1 });

// Virtuals
marketplaceSchema.virtual('likeCount').get(function() {
  return this.likes.length;
});

marketplaceSchema.virtual('interestCount').get(function() {
  return this.interestedUsers.length;
});

marketplaceSchema.virtual('primaryImage').get(function() {
  return this.images.find(img => img.isPrimary) || this.images[0];
});

marketplaceSchema.virtual('daysUntilExpiry').get(function() {
  const now = new Date();
  const diffTime = this.expiresAt - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
});

marketplaceSchema.virtual('isExpiringSoon').get(function() {
  return this.daysUntilExpiry <= 3;
});

marketplaceSchema.virtual('conditionLabel').get(function() {
  const conditionMap = {
    'new': 'Brand New',
    'like_new': 'Like New',
    'good': 'Good Condition',
    'fair': 'Fair Condition',
    'poor': 'Needs Repair'
  };
  return conditionMap[this.condition] || this.condition;
});

marketplaceSchema.virtual('categoryLabel').get(function() {
  const categoryMap = {
    'electronics': 'Electronics',
    'furniture': 'Furniture',
    'vehicles': 'Vehicles',
    'clothing': 'Clothing',
    'books': 'Books',
    'sports': 'Sports & Fitness',
    'home_garden': 'Home & Garden',
    'baby_kids': 'Baby & Kids',
    'services': 'Services',
    'jobs': 'Jobs',
    'real_estate': 'Real Estate',
    'other': 'Other'
  };
  return categoryMap[this.category] || this.category;
});

// Instance methods
marketplaceSchema.methods.isLikedBy = function(userId) {
  return this.likes.some(like => like.user.toString() === userId.toString());
};

marketplaceSchema.methods.addLike = function(userId) {
  if (!this.isLikedBy(userId)) {
    this.likes.push({ user: userId });
    return this.save();
  }
  return Promise.resolve(this);
};

marketplaceSchema.methods.removeLike = function(userId) {
  this.likes = this.likes.filter(like => like.user.toString() !== userId.toString());
  return this.save();
};

marketplaceSchema.methods.addInterest = function(userId, message = '', contactInfo = '') {
  const existingInterest = this.interestedUsers.find(
    interest => interest.user.toString() === userId.toString()
  );
  
  if (!existingInterest) {
    this.interestedUsers.push({
      user: userId,
      message,
      contactInfo,
      status: 'interested',
      createdAt: new Date()
    });
    return this.save();
  }
  
  return Promise.resolve(this);
};

marketplaceSchema.methods.updateInterestStatus = function(userId, status) {
  const interest = this.interestedUsers.find(
    interest => interest.user.toString() === userId.toString()
  );
  
  if (interest) {
    interest.status = status;
    
    if (status === 'sold') {
      this.availabilityStatus = 'sold';
      this.isAvailable = false;
    }
    
    return this.save();
  }
  
  return Promise.reject(new Error('Interest not found'));
};

marketplaceSchema.methods.markAsSold = function() {
  this.availabilityStatus = 'sold';
  this.isAvailable = false;
  return this.save();
};

marketplaceSchema.methods.renew = function(days = 30) {
  this.expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  this.availabilityStatus = 'available';
  this.isAvailable = true;
  return this.save();
};

marketplaceSchema.methods.report = function(userId, reason, description) {
  this.reports.push({
    user: userId,
    reason,
    description,
    createdAt: new Date()
  });
  
  if (this.reports.length >= 3) {
    this.isReported = true;
    this.status = 'reported';
  }
  
  return this.save();
};

// Static methods
marketplaceSchema.statics.findByNeighborhood = function(neighborhoodId, filters = {}, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  
  let query = { 
    neighborhood: neighborhoodId, 
    status: 'active',
    isAvailable: true,
    expiresAt: { $gt: new Date() }
  };
  
  // Apply filters
  if (filters.category) query.category = filters.category;
  if (filters.type) query.type = filters.type;
  if (filters.condition) query.condition = filters.condition;
  if (filters.minPrice || filters.maxPrice) {
    query['price.amount'] = {};
    if (filters.minPrice) query['price.amount'].$gte = filters.minPrice;
    if (filters.maxPrice) query['price.amount'].$lte = filters.maxPrice;
  }
  if (filters.search) {
    query.$or = [
      { title: new RegExp(filters.search, 'i') },
      { description: new RegExp(filters.search, 'i') },
      { tags: new RegExp(filters.search, 'i') }
    ];
  }
  
  return this.find(query)
    .populate('seller', 'name avatar verificationLevel phone')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

marketplaceSchema.statics.findByCategory = function(category, filters = {}, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  
  let query = { 
    category, 
    status: 'active',
    isAvailable: true,
    expiresAt: { $gt: new Date() }
  };
  
  return this.find(query)
    .populate('seller', 'name avatar')
    .populate('neighborhood', 'name location.address.city')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

marketplaceSchema.statics.findTrending = function(neighborhoodId, limit = 10) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  return this.find({
    neighborhood: neighborhoodId,
    status: 'active',
    isAvailable: true,
    createdAt: { $gte: sevenDaysAgo }
  })
    .populate('seller', 'name avatar')
    .sort({ 
      views: -1, 
      likeCount: -1, 
      createdAt: -1 
    })
    .limit(limit);
};

marketplaceSchema.statics.findExpiringSoon = function(neighborhoodId, limit = 10) {
  const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  
  return this.find({
    neighborhood: neighborhoodId,
    status: 'active',
    isAvailable: true,
    expiresAt: { $lte: threeDaysFromNow, $gt: new Date() }
  })
    .populate('seller', 'name avatar')
    .sort({ expiresAt: 1 })
    .limit(limit);
};

// Cleanup expired listings
eighborhoodSchema.statics.cleanupExpired = function() {
  return this.updateMany(
    { 
      expiresAt: { $lte: new Date() },
      status: 'active',
      isAvailable: true
    },
    { 
      $set: { 
        status: 'expired',
        isAvailable: false,
        availabilityStatus: 'expired'
      }
    }
  );
};

module.exports = mongoose.model('Marketplace', marketplaceSchema);