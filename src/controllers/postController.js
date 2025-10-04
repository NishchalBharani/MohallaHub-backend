const Post = require('../models/Post');
const User = require('../models/User');
const Neighborhood = require('../models/Neighborhood');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');

// @desc    Create a new post
// @route   POST /api/posts/create
// @access  Private
exports.createPost = async (req, res) => {
  try {
    console.log('=== CREATE POST STARTED ===');
    console.log('Request body:', req.body);
    console.log('Uploaded files:', req.files);

    let contentText = req.body.content;
    let postTags = req.body.tags ? JSON.parse(req.body.tags) : [];

    if (!contentText || !contentText.trim()) {
      return res.status(400).json({
        message: 'Post content is required',
        hindi_message: 'पोस्ट सामग्री आवश्यक है'
      });
    }

    if (!req.body.neighborhood) {
      return res.status(400).json({
        message: 'Neighborhood is required',
        hindi_message: 'मोहल्ला आवश्यक है'
      });
    }

    // Validate neighborhood as a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.body.neighborhood)) {
      return res.status(400).json({
        message: 'Invalid neighborhood ID',
        hindi_message: 'अमान्य मोहल्ला आईडी'
      });
    }

    const postData = {
      content: {
        text: contentText.trim(),
        tags: Array.isArray(postTags) ? postTags : []
      },
      type: req.body.type || 'general',
      neighborhood: req.body.neighborhood,
      author: req.user.id
    };

    if (req.files && req.files.length > 0) {
      postData.images = req.files.map(file => ({
        filename: file.filename,
        originalName: file.originalname,
        path: file.path,
        mimetype: file.mimetype
      }));
    }

    console.log('Post data to save:', postData);

    const post = new Post(postData);
    await post.save();

    await post.populate('author', 'name profilePicture');

    console.log('=== POST CREATED SUCCESSFULLY ===');

    res.status(201).json({
      message: 'Post created successfully',
      hindi_message: 'पोस्ट सफलतापूर्वक बनाई गई',
      post
    });
  } catch (error) {
    console.error('Create post error:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        message: 'Validation failed',
        hindi_message: 'डेटा सत्यापन विफल',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }
    res.status(500).json({
      message: 'Server error creating post',
      hindi_message: 'पोस्ट बनाने में सर्वर त्रुटि',
      error: error.message
    });
  }
};

// @desc    Get neighborhood feed
// @route   GET /api/posts/feed
// @access  Private
exports.getFeed = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const { type, search } = req.query;

    // Check if user has neighborhood
    if (!req.user.neighborhood) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your address to view feed',
        hindi_message: 'फ़ीड देखने के लिए कृपया अपना पता सत्यापित करें'
      });
    }

    let query = {
      neighborhood: req.user.neighborhood._id,
      status: 'active'
    };

    // Filter by type
    if (type && type !== 'all') {
      query.type = type;
    }

    // Search functionality
    if (search) {
      query.$or = [
        { 'content.text': { $regex: search, $options: 'i' } },
        { 'content.tags': { $regex: search, $options: 'i' } }
      ];
    }

    // Get posts with pagination
    const posts = await Post.find(query)
      .populate('author', 'name avatar verificationLevel')
      .populate({
        path: 'comments.user',
        select: 'name avatar verificationLevel'
      })
      .populate({
        path: 'comments.replies.user',
        select: 'name avatar'
      })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    // Get total count for pagination
    const totalPosts = await Post.countDocuments(query);

    res.json({
      success: true,
      count: posts.length,
      total: totalPosts,
      page,
      pages: Math.ceil(totalPosts / limit),
      message: 'Feed retrieved successfully',
      hindi_message: 'फ़ीड सफलतापूर्वक प्राप्त की गई',
      posts
    });

  } catch (error) {
    console.error('Get feed error:', error);
    next(error);
  }
};

// @desc    Get trending posts
// @route   GET /api/posts/trending
// @access  Private
exports.getTrending = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    if (!req.user.neighborhood) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your address to view trending posts',
        hindi_message: 'ट्रेंडिंग पोस्ट देखने के लिए कृपया अपना पता सत्यापित करें'
      });
    }

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const posts = await Post.find({
      neighborhood: req.user.neighborhood._id,
      status: 'active',
      createdAt: { $gte: twentyFourHoursAgo }
    })
      .populate('author', 'name avatar verificationLevel')
      .sort({ 
        likeCount: -1, 
        commentCount: -1, 
        createdAt: -1 
      })
      .limit(limit);

    res.json({
      success: true,
      count: posts.length,
      message: 'Trending posts retrieved successfully',
      hindi_message: 'ट्रेंडिंग पोस्ट सफलतापूर्वक प्राप्त की गईं',
      posts
    });

  } catch (error) {
    console.error('Get trending error:', error);
    next(error);
  }
};

// @desc    Get single post
// @route   GET /api/posts/:id
// @access  Private
exports.getPost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('author', 'name avatar verificationLevel')
      .populate({
        path: 'comments.user',
        select: 'name avatar verificationLevel'
      })
      .populate({
        path: 'comments.replies.user',
        select: 'name avatar'
      })
      .populate('neighborhood', 'name location.address.city');

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
        hindi_message: 'पोस्ट नहीं मिली'
      });
    }

    // Check if user can view this post (same neighborhood)
    if (!req.user.neighborhood || 
        post.neighborhood._id.toString() !== req.user.neighborhood._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only view posts from your neighborhood',
        hindi_message: 'आप केवल अपने मोहल्ले की पोस्ट देख सकते हैं'
      });
    }

    // Increment view count
    post.views += 1;
    await post.save();

    res.json({
      success: true,
      message: 'Post retrieved successfully',
      hindi_message: 'पोस्ट सफलतापूर्वक प्राप्त की गई',
      post
    });

  } catch (error) {
    console.error('Get post error:', error);
    next(error);
  }
};

// @desc    Like/unlike a post
// @route   PUT /api/posts/:id/like
// @access  Private
exports.toggleLike = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
        hindi_message: 'पोस्ट नहीं मिली'
      });
    }

    // Check if user can interact with this post
    if (!req.user.neighborhood || 
        post.neighborhood.toString() !== req.user.neighborhood._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only interact with posts from your neighborhood',
        hindi_message: 'आप केवल अपने मोहल्ले की पोस्ट से इंटरैक्ट कर सकते हैं'
      });
    }

    const isLiked = post.isLikedBy(req.user.id);
    
    if (isLiked) {
      await post.removeLike(req.user.id);
      res.json({
        success: true,
        message: 'Post unliked successfully',
        hindi_message: 'पोस्ट अनलाइक कर दी गई',
        liked: false,
        likeCount: post.likeCount - 1
      });
    } else {
      await post.addLike(req.user.id);
      res.json({
        success: true,
        message: 'Post liked successfully',
        hindi_message: 'पोस्ट लाइक कर दी गई',
        liked: true,
        likeCount: post.likeCount + 1
      });
    }

  } catch (error) {
    console.error('Toggle like error:', error);
    next(error);
  }
};

// @desc    Add comment to post
// @route   POST /api/posts/:id/comment
// @access  Private
exports.addComment = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        hindi_message: 'सत्यापन विफल रहा',
        errors: errors.array()
      });
    }

    const { content } = req.body;
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
        hindi_message: 'पोस्ट नहीं मिली'
      });
    }

    // Check if user can comment on this post
    if (!req.user.neighborhood || 
        post.neighborhood.toString() !== req.user.neighborhood._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only comment on posts from your neighborhood',
        hindi_message: 'आप केवल अपने मोहल्ले की पोस्ट पर टिप्पणी कर सकते हैं'
      });
    }

    // Add comment
    await post.addComment(req.user.id, content);

    // Populate the new comment
    await post.populate({
      path: 'comments.user',
      select: 'name avatar verificationLevel'
    });

    const newComment = post.comments[post.comments.length - 1];

    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      hindi_message: 'टिप्पणी सफलतापूर्वक जोड़ी गई',
      comment: newComment
    });

  } catch (error) {
    console.error('Add comment error:', error);
    next(error);
  }
};

// @desc    Add reply to comment
// @route   POST /api/posts/:postId/comments/:commentId/reply
// @access  Private
exports.addReply = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        hindi_message: 'सत्यापन विफल रहा',
        errors: errors.array()
      });
    }

    const { content } = req.body;
    const post = await Post.findById(req.params.postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
        hindi_message: 'पोस्ट नहीं मिली'
      });
    }

    // Check if user can reply to this post
    if (!req.user.neighborhood || 
        post.neighborhood.toString() !== req.user.neighborhood._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only reply to posts from your neighborhood',
        hindi_message: 'आप केवल अपने मोहल्ले की पोस्ट का उत्तर दे सकते हैं'
      });
    }

    // Add reply
    await post.addReply(req.params.commentId, req.user.id, content);

    // Populate the new reply
    await post.populate({
      path: 'comments.replies.user',
      select: 'name avatar'
    });

    const comment = post.comments.id(req.params.commentId);
    const newReply = comment.replies[comment.replies.length - 1];

    res.status(201).json({
      success: true,
      message: 'Reply added successfully',
      hindi_message: 'उत्तर सफलतापूर्वक जोड़ा गया',
      reply: newReply
    });

  } catch (error) {
    console.error('Add reply error:', error);
    next(error);
  }
};

// @desc    Delete post (only by author or admin)
// @route   DELETE /api/posts/:id
// @access  Private
exports.deletePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
        hindi_message: 'पोस्ट नहीं मिली'
      });
    }

    // Check if user is authorized to delete
    const isAuthor = post.author.toString() === req.user.id.toString();
    const isAdmin = req.user.role === 'admin';
    const isModerator = req.user.role === 'moderator';

    if (!isAuthor && !isAdmin && !isModerator) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to delete this post',
        hindi_message: 'आप इस पोस्ट को हटाने के लिए अधिकृत नहीं हैं'
      });
    }

    // Soft delete (change status)
    post.status = 'deleted';
    await post.save();

    res.json({
      success: true,
      message: 'Post deleted successfully',
      hindi_message: 'पोस्ट सफलतापूर्वक हटा दी गई'
    });

  } catch (error) {
    console.error('Delete post error:', error);
    next(error);
  }
};

// @desc    Report post
// @route   POST /api/posts/:id/report
// @access  Private
exports.reportPost = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        hindi_message: 'सत्यापन विफल रहा',
        errors: errors.array()
      });
    }

    const { reason, description } = req.body;
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
        hindi_message: 'पोस्ट नहीं मिली'
      });
    }

    // Check if user can report this post
    if (!req.user.neighborhood || 
        post.neighborhood.toString() !== req.user.neighborhood._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only report posts from your neighborhood',
        hindi_message: 'आप केवल अपने मोहल्ले की पोस्ट की रिपोर्ट कर सकते हैं'
      });
    }

    // Check if user already reported
    const alreadyReported = post.reports.some(
      report => report.user.toString() === req.user.id.toString()
    );

    if (alreadyReported) {
      return res.status(400).json({
        success: false,
        message: 'You have already reported this post',
        hindi_message: 'आपने इस पोस्ट की पहले ही रिपोर्ट कर दी है'
      });
    }

    // Report post
    await post.report(req.user.id, reason, description);

    res.json({
      success: true,
      message: 'Post reported successfully',
      hindi_message: 'पोस्ट की रिपोर्ट सफलतापूर्वक की गई'
    });

  } catch (error) {
    console.error('Report post error:', error);
    next(error);
  }
};