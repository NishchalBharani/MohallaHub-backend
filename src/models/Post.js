const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  // Author Information
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Content
  content: {
    text: {
      type: String,
      required: [true, 'Post content is required'],
      maxlength: [2000, 'Post cannot exceed 2000 characters'],
      trim: true
    },
    images: [{
      url: String,
      filename: String,
      size: Number,
      mimeType: String
    }],
    tags: [String]
  },
  
  // Post Type
  type: {
    type: String,
    enum: ['general', 'safety', 'event', 'announcement', 'help', 'recommendation', 'lost_found'],
    default: 'general'
  },
  
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
  
  // Engagement
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
  
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    content: {
      type: String,
      required: true,
      maxlength: [500, 'Comment cannot exceed 500 characters']
    },
    images: [{
      url: String,
      filename: String
    }],
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
    replies: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      content: {
        type: String,
        required: true,
        maxlength: [300, 'Reply cannot exceed 300 characters']
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Post Status
  status: {
    type: String,
    enum: ['active', 'hidden', 'deleted', 'reported'],
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
      enum: ['spam', 'inappropriate', 'harassment', 'false_information', 'other']
    },
    description: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Metadata
  views: {
    type: Number,
    default: 0
  },
  
  shareCount: {
    type: Number,
    default: 0
  },
  
  isEdited: {
    type: Boolean,
    default: false
  },
  
  editedAt: Date,
  
  // For Events
  eventDetails: {
    title: String,
    date: Date,
    time: String,
    venue: String,
    isOnline: Boolean,
    meetingUrl: String,
    maxAttendees: Number,
    attendees: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      status: {
        type: String,
        enum: ['going', 'interested', 'not_going'],
        default: 'interested'
      },
      registeredAt: {
        type: Date,
        default: Date.now
      }
    }]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ neighborhood: 1, createdAt: -1 });
postSchema.index({ type: 1, status: 1 });
postSchema.index({ 'content.tags': 1 });
postSchema.index({ createdAt: -1 });

// Virtuals
postSchema.virtual('likeCount').get(function() {
  return this.likes.length;
});

postSchema.virtual('commentCount').get(function() {
  return this.comments.length;
});

postSchema.virtual('isEvent').get(function() {
  return this.type === 'event' && this.eventDetails.title;
});

postSchema.virtual('eventAttendeeCount').get(function() {
  return this.eventDetails ? this.eventDetails.attendees.length : 0;
});

// Instance methods
postSchema.methods.isLikedBy = function(userId) {
  return this.likes.some(like => like.user.toString() === userId.toString());
};

postSchema.methods.addLike = function(userId) {
  if (!this.isLikedBy(userId)) {
    this.likes.push({ user: userId });
    return this.save();
  }
  return Promise.resolve(this);
};

postSchema.methods.removeLike = function(userId) {
  this.likes = this.likes.filter(like => like.user.toString() !== userId.toString());
  return this.save();
};

postSchema.methods.addComment = function(userId, content, images = []) {
  const comment = {
    user: userId,
    content,
    images,
    createdAt: new Date()
  };
  
  this.comments.push(comment);
  return this.save();
};

postSchema.methods.addReply = function(commentId, userId, content) {
  const comment = this.comments.id(commentId);
  if (comment) {
    comment.replies.push({
      user: userId,
      content,
      createdAt: new Date()
    });
    return this.save();
  }
  return Promise.reject(new Error('Comment not found'));
};

postSchema.methods.report = function(userId, reason, description) {
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
postSchema.statics.findByNeighborhood = function(neighborhoodId, page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  
  return this.find({ 
    neighborhood: neighborhoodId, 
    status: 'active' 
  })
    .populate('author', 'name avatar verificationLevel')
    .populate('comments.user', 'name avatar')
    .populate('comments.replies.user', 'name avatar')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

postSchema.statics.findByType = function(type, neighborhoodId, page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  
  return this.find({ 
    type, 
    neighborhood: neighborhoodId, 
    status: 'active' 
  })
    .populate('author', 'name avatar')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

postSchema.statics.findTrending = function(neighborhoodId, limit = 10) {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  return this.find({
    neighborhood: neighborhoodId,
    status: 'active',
    createdAt: { $gte: twentyFourHoursAgo }
  })
    .populate('author', 'name avatar')
    .sort({ 
      likeCount: -1, 
      commentCount: -1, 
      createdAt: -1 
    })
    .limit(limit);
};

module.exports = mongoose.model('Post', postSchema);