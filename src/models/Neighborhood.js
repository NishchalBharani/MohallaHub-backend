const mongoose = require('mongoose');

// Simple and reliable geohash implementation
const generateGeohash = (lat, lng, precision = 7) => {
  const base32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  let hash = '';
  let bits = 0;
  let bitCount = 0;
  
  let minLat = -90, maxLat = 90;
  let minLng = -180, maxLng = 180;
  
  for (let i = 0; i < precision * 5; i++) {
    if (i % 2 === 0) {
      // Longitude
      const mid = (minLng + maxLng) / 2;
      if (lng >= mid) {
        bits = (bits << 1) + 1;
        minLng = mid;
      } else {
        bits = (bits << 1);
        maxLng = mid;
      }
    } else {
      // Latitude
      const mid = (minLat + maxLat) / 2;
      if (lat >= mid) {
        bits = (bits << 1) + 1;
        minLat = mid;
      } else {
        bits = (bits << 1);
        maxLat = mid;
      }
    }
    
    bitCount++;
    
    if (bitCount === 5) {
      hash += base32[bits];
      bits = 0;
      bitCount = 0;
    }
  }
  
  return hash;
};

const neighborhoodSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: [true, 'Neighborhood name is required'],
    trim: true,
    maxlength: [100, 'Neighborhood name cannot exceed 100 characters']
  },
  
  slug: {
    type: String,
    unique: true,
    lowercase: true
  },
  
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  
  // Location Data
  location: {
    address: {
      full: { type: String, required: true },
      pincode: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      country: { type: String, default: 'India' }
    },
    coordinates: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true }
    },
    geohash: {
      type: String,
      index: true
    }
  },
  
  // Administrative Boundaries
  boundaries: {
    type: {
      type: String,
      enum: ['Polygon'],
      default: 'Polygon'
    },
    coordinates: {
      type: [[[Number]]],
      default: []
    }
  },
  
  // Statistics
  stats: {
    totalResidents: {
      type: Number,
      default: 0
    },
    verifiedResidents: {
      type: Number,
      default: 0
    },
    totalPosts: {
      type: Number,
      default: 0
    },
    activeEvents: {
      type: Number,
      default: 0
    },
    marketplaceListings: {
      type: Number,
      default: 0
    }
  },
  
  // Community Features
  features: {
    allowPublicPosts: { type: Boolean, default: true },
    allowMarketplace: { type: Boolean, default: true },
    allowEvents: { type: Boolean, default: true },
    requireApproval: { type: Boolean, default: false },
    autoApproveVerified: { type: Boolean, default: true }
  },
  
  // Moderation
  moderators: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      enum: ['moderator', 'admin'],
      default: 'moderator'
    },
    assignedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Verification
  isVerified: {
    type: Boolean,
    default: false
  },
  
  verificationMethod: {
    type: String,
    enum: ['manual', 'automatic', 'community'],
    default: 'automatic'
  },
  
  // Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  
  // Metadata
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  // Additional Info
  nearbyAmenities: [{
    name: String,
    type: {
      type: String,
      enum: ['hospital', 'school', 'market', 'temple', 'park', 'police', 'fire_station', 'bank']
    },
    coordinates: {
      latitude: Number,
      longitude: Number
    },
    distance: Number
  }],
  
  languages: [{
    type: String,
    enum: ['en', 'hi', 'mr', 'ta', 'te', 'bn', 'kn', 'ml', 'gu', 'pa'],
    default: ['en', 'hi']
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
neighborhoodSchema.index({ 'location.geohash': 1 });
neighborhoodSchema.index({ 'location.coordinates': '2dsphere' });
neighborhoodSchema.index({ 'location.address.pincode': 1 });
neighborhoodSchema.index({ status: 1, isVerified: 1 });
neighborhoodSchema.index({ slug: 1 });

// Virtuals
neighborhoodSchema.virtual('displayName').get(function() {
  return `${this.name}, ${this.location.address.city}`;
});

neighborhoodSchema.virtual('fullAddress').get(function() {
  const { address } = this.location;
  return `${address.full}, ${address.city}, ${address.state} - ${address.pincode}`;
});

neighborhoodSchema.virtual('memberCount').get(function() {
  return this.stats.totalResidents;
});

neighborhoodSchema.virtual('activeMembersCount').get(function() {
  return this.stats.verifiedResidents;
});

// Pre-validation middleware - WORKING GEOHASH
neighborhoodSchema.pre('validate', function(next) {
  // Generate slug from name
  if (this.isModified('name') && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
  
  // Generate geohash - SIMPLIFIED AND RELIABLE
  if (this.location && this.location.coordinates) {
    const { latitude, longitude } = this.location.coordinates;
    if (latitude !== undefined && longitude !== undefined && 
        latitude !== null && longitude !== null) {
      try {
        this.location.geohash = generateGeohash(latitude, longitude, 7);
      } catch (error) {
        console.warn('Geohash generation failed, using fallback:', error);
        // Simple fallback - combine coordinates as string
        this.location.geohash = `loc${Math.round(latitude * 10000)}${Math.round(longitude * 10000)}`;
      }
    }
  }
  
  // Ensure geohash is always set
  if (!this.location.geohash) {
    this.location.geohash = generateGeohash(20.5937, 78.9629, 7); // India center
  }
  
  this.updatedAt = new Date();
  next();
});

// Instance methods
neighborhoodSchema.methods.isWithinBoundary = function(latitude, longitude) {
  const distance = this.calculateDistance(latitude, longitude);
  return distance <= 2000; // 2km radius
};

neighborhoodSchema.methods.calculateDistance = function(latitude, longitude) {
  const { latitude: centerLat, longitude: centerLng } = this.location.coordinates;
  
  const R = 6371e3; // Earth's radius in meters
  const φ1 = centerLat * Math.PI/180;
  const φ2 = latitude * Math.PI/180;
  const Δφ = (latitude - centerLat) * Math.PI/180;
  const Δλ = (longitude - centerLng) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
};

neighborhoodSchema.methods.updateStats = async function() {
  const User = mongoose.model('User');
  const Post = mongoose.model('Post');
  
  const [totalResidents, verifiedResidents, totalPosts] = await Promise.all([
    User.countDocuments({ neighborhood: this._id, status: 'active' }),
    User.countDocuments({ 
      neighborhood: this._id, 
      status: 'active', 
      isPhoneVerified: true,
      isAddressVerified: true 
    }),
    Post.countDocuments({ neighborhood: this._id, status: 'active' })
  ]);
  
  this.stats = {
    ...this.stats,
    totalResidents,
    verifiedResidents,
    totalPosts
  };
  
  return this.save();
};

neighborhoodSchema.methods.addModerator = function(userId, role = 'moderator') {
  const existingModerator = this.moderators.find(m => m.user.toString() === userId.toString());
  
  if (!existingModerator) {
    this.moderators.push({
      user: userId,
      role,
      assignedAt: new Date()
    });
    return this.save();
  }
  
  return Promise.resolve(this);
};

neighborhoodSchema.methods.removeModerator = function(userId) {
  this.moderators = this.moderators.filter(m => m.user.toString() !== userId.toString());
  return this.save();
};

// Static methods
neighborhoodSchema.statics.findByCoordinates = function(latitude, longitude, radius = 5000) {
  return this.find({
    'location.coordinates': {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        $maxDistance: radius
      }
    },
    status: 'active',
    isVerified: true
  });
};

neighborhoodSchema.statics.findByPincode = function(pincode) {
  return this.find({
    'location.address.pincode': pincode,
    status: 'active'
  });
};

neighborhoodSchema.statics.findByGeohash = function(geohashPrefix) {
  return this.find({
    'location.geohash': new RegExp(`^${geohashPrefix}`),
    status: 'active'
  });
};

neighborhoodSchema.statics.createNeighborhood = async function(neighborhoodData) {
  const existing = await this.findOne({
    'location.address.pincode': neighborhoodData.location.address.pincode,
    name: neighborhoodData.name
  });
  
  if (existing) {
    throw new Error('Neighborhood already exists');
  }
  
  const neighborhood = new this(neighborhoodData);
  return neighborhood.save();
};

module.exports = mongoose.model('Neighborhood', neighborhoodSchema);