const express = require('express');
const { body } = require('express-validator');
const Neighborhood = require('../models/Neighborhood');
const User = require('../models/User');
const { protect, requireAddressVerification } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

// @desc    Get user's neighborhood
// @route   GET /api/neighborhoods/my
// @access  Private
const getMyNeighborhood = asyncHandler(async (req, res, next) => {
  if (!req.user.neighborhood) {
    return res.status(404).json({
      success: false,
      message: 'No neighborhood found. Please verify your address.',
      hindi_message: 'कोई मोहल्ला नहीं मिला। कृपया अपना पता सत्यापित करें।'
    });
  }

  const neighborhood = await Neighborhood.findById(req.user.neighborhood)
    .populate('moderators.user', 'name avatar verificationLevel');

  res.json({
    success: true,
    message: 'Neighborhood retrieved successfully',
    hindi_message: 'मोहल्ला सफलतापूर्वक प्राप्त किया गया',
    neighborhood
  });
});

// @desc    Find nearby neighborhoods
// @route   GET /api/neighborhoods/nearby
// @access  Private
const getNearbyNeighborhoods = asyncHandler(async (req, res, next) => {
  const { latitude, longitude, radius = 5000 } = req.query;

  if (!latitude || !longitude) {
    return res.status(400).json({
      success: false,
      message: 'Latitude and longitude are required',
      hindi_message: 'अक्षांश और देशांश आवश्यक हैं'
    });
  }

  const neighborhoods = await Neighborhood.findByCoordinates(
    parseFloat(latitude),
    parseFloat(longitude),
    parseInt(radius)
  );

  res.json({
    success: true,
    count: neighborhoods.length,
    message: 'Nearby neighborhoods retrieved successfully',
    hindi_message: 'नजदीकी मोहल्ले सफलतापूर्वक प्राप्त किए गए',
    neighborhoods
  });
});

// @desc    Verify address by pincode
// @route   POST /api/neighborhoods/verify-address
// @access  Private
const verifyAddress = asyncHandler(async (req, res, next) => {
  const errors = require('express-validator').validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      hindi_message: 'सत्यापन विफल रहा',
      errors: errors.array()
    });
  }

  const { pincode, fullAddress, city, state, coordinates } = req.body;

  // Find or create neighborhood
  let neighborhood = await Neighborhood.findOne({
    'location.address.pincode': pincode
  });

  if (!neighborhood) {
    // Create new neighborhood
    neighborhood = await Neighborhood.create({
      name: `${city} - ${pincode}`,
      location: {
        address: {
          full: fullAddress,
          pincode,
          city,
          state,
          country: 'India'
        },
        coordinates: coordinates || { latitude: 0, longitude: 0 }
      }
    });
  }

  // Update user
  const user = await User.findByIdAndUpdate(
    req.user.id,
    {
      address: {
        fullAddress,
        pincode,
        city,
        state,
        country: 'India',
        coordinates: coordinates || { latitude: 0, longitude: 0 },
        geohash: neighborhood.location.geohash
      },
      neighborhood: neighborhood._id,
      isAddressVerified: true
    },
    { new: true }
  ).populate('neighborhood');

  // Update neighborhood stats
  await neighborhood.updateStats();

  res.json({
    success: true,
    message: 'Address verified successfully',
    hindi_message: 'पता सफलतापूर्वक सत्यापित हो गया',
    user: {
      id: user._id,
      address: user.address,
      isAddressVerified: user.isAddressVerified,
      neighborhood: user.neighborhood,
      verificationLevel: user.verificationLevel
    }
  });
});

// @desc    Get neighborhood statistics
// @route   GET /api/neighborhoods/:id/stats
// @access  Private
const getNeighborhoodStats = asyncHandler(async (req, res, next) => {
  const neighborhood = await Neighborhood.findById(req.params.id);

  if (!neighborhood) {
    return res.status(404).json({
      success: false,
      message: 'Neighborhood not found',
      hindi_message: 'मोहल्ला नहीं मिला'
    });
  }

  // Update stats before returning
  await neighborhood.updateStats();

  const users = await User.find({ 
    neighborhood: neighborhood._id, 
    status: 'active' 
  }).select('name avatar verificationLevel joinedAt');

  res.json({
    success: true,
    message: 'Neighborhood statistics retrieved successfully',
    hindi_message: 'मोहल्ला सांख्यिकी सफलतापूर्वक प्राप्त की गई',
    stats: neighborhood.stats,
    members: users
  });
});

// @desc    Search neighborhoods by pincode or city
// @route   GET /api/neighborhoods/search
// @access  Private
const searchNeighborhoods = asyncHandler(async (req, res, next) => {
  const { pincode, city, state } = req.query;

  let query = { status: 'active' };

  if (pincode) {
    query['location.address.pincode'] = pincode;
  }
  if (city) {
    query['location.address.city'] = new RegExp(city, 'i');
  }
  if (state) {
    query['location.address.state'] = new RegExp(state, 'i');
  }

  const neighborhoods = await Neighborhood.find(query)
    .sort({ 'stats.totalResidents': -1 })
    .limit(20);

  res.json({
    success: true,
    count: neighborhoods.length,
    message: 'Neighborhoods search completed',
    hindi_message: 'मोहल्ला खोज पूरी हुई',
    neighborhoods
  });
});

// Validation rules
const addressValidation = [
  body('pincode')
    .isLength({ min: 6, max: 6 })
    .withMessage('Pincode must be 6 digits')
    .isNumeric()
    .withMessage('Pincode must contain only numbers'),
  body('fullAddress')
    .isLength({ min: 10, max: 500 })
    .withMessage('Full address must be between 10 and 500 characters'),
  body('city')
    .isLength({ min: 2, max: 50 })
    .withMessage('City must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('City can only contain letters and spaces'),
  body('state')
    .isLength({ min: 2, max: 50 })
    .withMessage('State must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('State can only contain letters and spaces')
];

// Routes
router.get('/my', protect, getMyNeighborhood);
router.get('/nearby', protect, getNearbyNeighborhoods);
router.post('/verify-address', protect, addressValidation, verifyAddress);
router.get('/:id/stats', protect, getNeighborhoodStats);
router.get('/search', protect, searchNeighborhoods);

// Test route
router.get('/test', (req, res) => {
  res.json({ 
    message: 'Neighborhood routes are working!',
    hindi_message: 'मोहल्ला मार्ग काम कर रहे हैं!',
    available_routes: [
      'GET /api/neighborhoods/my',
      'GET /api/neighborhoods/nearby',
      'POST /api/neighborhoods/verify-address',
      'GET /api/neighborhoods/:id/stats',
      'GET /api/neighborhoods/search'
    ]
  });
});

module.exports = router;