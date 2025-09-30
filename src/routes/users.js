const express = require('express');
const { body } = require('express-validator');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

// @desc    Get all users in neighborhood
// @route   GET /api/users/neighborhood
// @access  Private
const getNeighborhoodUsers = asyncHandler(async (req, res, next) => {
  if (!req.user.neighborhood) {
    return res.status(403).json({
      success: false,
      message: 'Please verify your address first',
      hindi_message: 'कृपया पहले अपना पता सत्यापित करें'
    });
  }

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;

  const users = await User.find({
    neighborhood: req.user.neighborhood,
    status: 'active',
    isPhoneVerified: true
  })
    .select('name avatar verificationLevel trustScore joinedAt lastActiveAt')
    .sort({ joinedAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  const totalUsers = await User.countDocuments({
    neighborhood: req.user.neighborhood,
    status: 'active',
    isPhoneVerified: true
  });

  res.json({
    success: true,
    count: users.length,
    total: totalUsers,
    page,
    pages: Math.ceil(totalUsers / limit),
    message: 'Neighborhood users retrieved successfully',
    hindi_message: 'मोहल्ला उपयोगकर्ता सफलतापूर्वक प्राप्त किए गए',
    users
  });
});

// @desc    Get user profile by ID
// @route   GET /api/users/:id
// @access  Private
const getUserProfile = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id)
    .select('-otp -notifications')
    .populate('neighborhood', 'name location.address.city');

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
      hindi_message: 'उपयोगकर्ता नहीं मिला'
    });
  }

  // Check if user is in same neighborhood
  if (!req.user.neighborhood || 
      user.neighborhood._id.toString() !== req.user.neighborhood._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'You can only view profiles from your neighborhood',
      hindi_message: 'आप केवल अपने मोहल्ले की प्रोफ़ाइल देख सकते हैं'
    });
  }

  res.json({
    success: true,
    message: 'User profile retrieved successfully',
    hindi_message: 'उपयोगकर्ता प्रोफ़ाइल सफलतापूर्वक प्राप्त की गई',
    user: {
      id: user._id,
      name: user.name,
      avatar: user.avatar,
      verificationLevel: user.verificationLevel,
      trustScore: user.trustScore,
      joinedAt: user.joinedAt,
      lastActiveAt: user.lastActiveAt,
      neighborhood: user.neighborhood
    }
  });
});

// @desc    Update user avatar
// @route   PUT /api/users/avatar
// @access  Private
const updateAvatar = asyncHandler(async (req, res, next) => {
  const errors = require('express-validator').validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      hindi_message: 'सत्यापन विफल रहा',
      errors: errors.array()
    });
  }

  const { avatar } = req.body;

  const user = await User.findByIdAndUpdate(
    req.user.id,
    { avatar },
    { new: true }
  ).select('name avatar');

  res.json({
    success: true,
    message: 'Avatar updated successfully',
    hindi_message: 'अवतार सफलतापूर्वक अपडेट किया गया',
    user: {
      id: user._id,
      name: user.name,
      avatar: user.avatar
    }
  });
});

// @desc    Search users in neighborhood
// @route   GET /api/users/search
// @access  Private
const searchUsers = asyncHandler(async (req, res, next) => {
  const { query } = req.query;

  if (!query || query.length < 2) {
    return res.status(400).json({
      success: false,
      message: 'Search query must be at least 2 characters',
      hindi_message: 'खोज क्वेरी कम से कम 2 अक्षरों की होनी चाहिए'
    });
  }

  if (!req.user.neighborhood) {
    return res.status(403).json({
      success: false,
      message: 'Please verify your address first',
      hindi_message: 'कृपया पहले अपना पता सत्यापित करें'
    });
  }

  const users = await User.find({
    neighborhood: req.user.neighborhood,
    status: 'active',
    isPhoneVerified: true,
    $or: [
      { name: { $regex: query, $options: 'i' } },
      { phone: { $regex: query, $options: 'i' } }
    ]
  })
    .select('name avatar verificationLevel trustScore joinedAt')
    .limit(20);

  res.json({
    success: true,
    count: users.length,
    message: 'User search completed',
    hindi_message: 'उपयोगकर्ता खोज पूरी हुई',
    users
  });
});

// @desc    Get user statistics (Admin only)
// @route   GET /api/users/stats
// @access  Private (Admin)
const getUserStats = asyncHandler(async (req, res, next) => {
  const totalUsers = await User.countDocuments();
  const activeUsers = await User.countDocuments({ status: 'active' });
  const verifiedUsers = await User.countDocuments({ 
    isPhoneVerified: true, 
    isAddressVerified: true,
    status: 'active'
  });

  const usersByRole = await User.aggregate([
    { $match: { status: 'active' } },
    { $group: { _id: '$role', count: { $sum: 1 } } }
  ]);

  const usersByLanguage = await User.aggregate([
    { $match: { status: 'active' } },
    { $group: { _id: '$language', count: { $sum: 1 } } }
  ]);

  const recentUsers = await User.find({ status: 'active' })
    .select('name phone language joinedAt')
    .sort({ joinedAt: -1 })
    .limit(10);

  res.json({
    success: true,
    message: 'User statistics retrieved successfully',
    hindi_message: 'उपयोगकर्ता सांख्यिकी सफलतापूर्वक प्राप्त की गई',
    stats: {
      totalUsers,
      activeUsers,
      verifiedUsers,
      usersByRole,
      usersByLanguage,
      recentUsers
    }
  });
});

// Validation rules
const avatarValidation = [
  body('avatar')
    .isURL()
    .withMessage('Avatar must be a valid URL')
    .isLength({ max: 500 })
    .withMessage('Avatar URL cannot exceed 500 characters')
];

// Routes
router.get('/neighborhood', protect, getNeighborhoodUsers);
router.get('/search', protect, searchUsers);
router.get('/:id', protect, getUserProfile);
router.put('/avatar', protect, avatarValidation, updateAvatar);
router.get('/stats', protect, authorize('admin'), getUserStats);

// Test route
router.get('/test', (req, res) => {
  res.json({ 
    message: 'Users routes are working!',
    hindi_message: 'उपयोगकर्ता मार्ग काम कर रहे हैं!',
    available_routes: [
      'GET /api/users/neighborhood',
      'GET /api/users/search',
      'GET /api/users/:id',
      'PUT /api/users/avatar',
      'GET /api/users/stats'
    ]
  });
});

module.exports = router;