const express = require('express');
const { body } = require('express-validator');
const multer = require('multer');
const path = require('path');
const Marketplace = require('../models/Marketplace');
const { protect, requireAddressVerification } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/marketplace/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per image
    files: 5 // Maximum 5 images
  },
  fileFilter: fileFilter
});

// @desc    Create new marketplace listing
// @route   POST /api/marketplace/create
// @access  Private
const createListing = asyncHandler(async (req, res, next) => {
  const errors = require('express-validator').validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      hindi_message: 'सत्यापन विफल रहा',
      errors: errors.array()
    });
  }

  const { title, description, category, condition, price, type, tags, upiId } = req.body;

  if (!req.user.neighborhood) {
    return res.status(403).json({
      success: false,
      message: 'Please verify your address to create listings',
      hindi_message: 'लिस्टिंग बनाने के लिए कृपया अपना पता सत्यापित करें'
    });
  }

  // Handle file uploads
  const images = [];
  if (req.files && req.files.length > 0) {
    req.files.forEach((file, index) => {
      images.push({
        url: `/uploads/marketplace/${file.filename}`,
        filename: file.filename,
        size: file.size,
        mimeType: file.mimetype,
        isPrimary: index === 0 // First image as primary
      });
    });
  }

  const listing = await Marketplace.create({
    seller: req.user.id,
    title,
    description,
    category,
    condition,
    price: {
      amount: price.amount,
      currency: price.currency || 'INR',
      isNegotiable: price.isNegotiable !== false,
      originalPrice: price.originalPrice
    },
    type: type || 'sell',
    images,
    neighborhood: req.user.neighborhood._id,
    location: {
      address: req.user.address.fullAddress,
      coordinates: req.user.address.coordinates
    },
    upiId,
    tags: tags || []
  });

  await listing.populate('seller', 'name avatar verificationLevel');

  res.status(201).json({
    success: true,
    message: 'Listing created successfully',
    hindi_message: 'लिस्टिंग सफलतापूर्वक बनाई गई',
    listing
  });
});

// @desc    Get marketplace listings
// @route   GET /api/marketplace/listings
// @access  Private
const getListings = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const { category, type, condition, minPrice, maxPrice, search } = req.query;

  if (!req.user.neighborhood) {
    return res.status(403).json({
      success: false,
      message: 'Please verify your address to view listings',
      hindi_message: 'लिस्टिंग देखने के लिए कृपया अपना पता सत्यापित करें'
    });
  }

  const filters = {};
  if (category) filters.category = category;
  if (type) filters.type = type;
  if (condition) filters.condition = condition;
  if (minPrice || maxPrice) {
    filters.minPrice = parseFloat(minPrice);
    filters.maxPrice = parseFloat(maxPrice);
  }
  if (search) filters.search = search;

  const listings = await Marketplace.findByNeighborhood(
    req.user.neighborhood._id,
    filters,
    page,
    limit
  );

  res.json({
    success: true,
    count: listings.length,
    message: 'Listings retrieved successfully',
    hindi_message: 'लिस्टिंग सफलतापूर्वक प्राप्त की गई',
    listings
  });
});

// @desc    Get single listing
// @route   GET /api/marketplace/:id
// @access  Private
const getListing = asyncHandler(async (req, res, next) => {
  const listing = await Marketplace.findById(req.params.id)
    .populate('seller', 'name avatar verificationLevel')
    .populate('neighborhood', 'name location.address.city');

  if (!listing) {
    return res.status(404).json({
      success: false,
      message: 'Listing not found',
      hindi_message: 'लिस्टिंग नहीं मिली'
    });
  }

  if (!req.user.neighborhood || 
      listing.neighborhood._id.toString() !== req.user.neighborhood._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'You can only view listings from your neighborhood',
      hindi_message: 'आप केवल अपने मोहल्ले की लिस्टिंग देख सकते हैं'
    });
  }

  // Increment view count
  listing.views += 1;
  await listing.save();

  res.json({
    success: true,
    message: 'Listing retrieved successfully',
    hindi_message: 'लिस्टिंग सफलतापूर्वक प्राप्त की गई',
    listing
  });
});

// @desc    Toggle like on listing
// @route   PUT /api/marketplace/:id/like
// @access  Private
const toggleLike = asyncHandler(async (req, res, next) => {
  const listing = await Marketplace.findById(req.params.id);

  if (!listing) {
    return res.status(404).json({
      success: false,
      message: 'Listing not found',
      hindi_message: 'लिस्टिंग नहीं मिली'
    });
  }

  if (!req.user.neighborhood || 
      listing.neighborhood.toString() !== req.user.neighborhood._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'You can only interact with listings from your neighborhood',
      hindi_message: 'आप केवल अपने मोहल्ले की लिस्टिंग से इंटरैक्ट कर सकते हैं'
    });
  }

  const isLiked = listing.isLikedBy(req.user.id);
  
  if (isLiked) {
    await listing.removeLike(req.user.id);
    res.json({
      success: true,
      message: 'Listing unliked successfully',
      hindi_message: 'लिस्टिंग अनलाइक कर दी गई',
      liked: false,
      likeCount: listing.likeCount - 1
    });
  } else {
    await listing.addLike(req.user.id);
    res.json({
      success: true,
      message: 'Listing liked successfully',
      hindi_message: 'लिस्टिंग लाइक कर दी गई',
      liked: true,
      likeCount: listing.likeCount + 1
    });
  }
});

// @desc    Express interest in listing
// @route   POST /api/marketplace/:id/interest
// @access  Private
const expressInterest = asyncHandler(async (req, res, next) => {
  const errors = require('express-validator').validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      hindi_message: 'सत्यापन विफल रहा',
      errors: errors.array()
    });
  }

  const { message, contactInfo } = req.body;
  const listing = await Marketplace.findById(req.params.id);

  if (!listing) {
    return res.status(404).json({
      success: false,
      message: 'Listing not found',
      hindi_message: 'लिस्टिंग नहीं मिली'
    });
  }

  if (!req.user.neighborhood || 
      listing.neighborhood.toString() !== req.user.neighborhood._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'You can only express interest in listings from your neighborhood',
      hindi_message: 'आप केवल अपने मोहल्ले की लिस्टिंग में रुचि व्यक्त कर सकते हैं'
    });
  }

  if (listing.seller.toString() === req.user.id.toString()) {
    return res.status(400).json({
      success: false,
      message: 'You cannot express interest in your own listing',
      hindi_message: 'आप अपनी खुद की लिस्टिंग में रुचि व्यक्त नहीं कर सकते'
    });
  }

  await listing.addInterest(req.user.id, message, contactInfo);

  res.json({
    success: true,
    message: 'Interest expressed successfully',
    hindi_message: 'रुचि सफलतापूर्वक व्यक्त की गई'
  });
});

// @desc    Get user's listings
// @route   GET /api/marketplace/my-listings
// @access  Private
const getMyListings = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const { status } = req.query;

  let query = { seller: req.user.id };
  if (status) query.status = status;

  const listings = await Marketplace.find(query)
    .populate('neighborhood', 'name location.address.city')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  const totalListings = await Marketplace.countDocuments(query);

  res.json({
    success: true,
    count: listings.length,
    total: totalListings,
    page,
    pages: Math.ceil(totalListings / limit),
    message: 'Your listings retrieved successfully',
    hindi_message: 'आपकी लिस्टिंग सफलतापूर्वक प्राप्त की गई',
    listings
  });
});

// @desc    Update listing status
// @route   PUT /api/marketplace/:id/status
// @access  Private
const updateListingStatus = asyncHandler(async (req, res, next) => {
  const errors = require('express-validator').validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      hindi_message: 'सत्यापन विफल रहा',
      errors: errors.array()
    });
  }

  const { status } = req.body;
  const listing = await Marketplace.findById(req.params.id);

  if (!listing) {
    return res.status(404).json({
      success: false,
      message: 'Listing not found',
      hindi_message: 'लिस्टिंग नहीं मिली'
    });
  }

  if (listing.seller.toString() !== req.user.id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'You can only update your own listings',
      hindi_message: 'आप केवल अपनी खुद की लिस्टिंग अपडेट कर सकते हैं'
    });
  }

  listing.availabilityStatus = status;
  listing.isAvailable = status === 'available';
  await listing.save();

  res.json({
    success: true,
    message: 'Listing status updated successfully',
    hindi_message: 'लिस्टिंग स्थिति सफलतापूर्वक अपडेट की गई',
    listing
  });
});

// Validation rules
const createListingValidation = [
  body('title')
    .isLength({ min: 5, max: 100 })
    .withMessage('Title must be between 5 and 100 characters'),
  body('description')
    .isLength({ min: 10, max: 1000 })
    .withMessage('Description must be between 10 and 1000 characters'),
  body('category')
    .isIn([
      'electronics', 'furniture', 'vehicles', 'clothing', 'books', 'sports',
      'home_garden', 'baby_kids', 'services', 'jobs', 'real_estate', 'other'
    ])
    .withMessage('Invalid category'),
  body('condition')
    .isIn(['new', 'like_new', 'good', 'fair', 'poor'])
    .withMessage('Invalid condition'),
  body('price.amount')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  body('type')
    .optional()
    .isIn(['sell', 'buy', 'rent', 'free'])
    .withMessage('Invalid listing type'),
  body('upiId')
    .optional()
    .matches(/^[ -~]+@[ -~]+$/)
    .withMessage('Invalid UPI ID format')
];

const interestValidation = [
  body('message')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Message cannot exceed 500 characters'),
  body('contactInfo')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Contact info cannot exceed 100 characters')
];

const statusValidation = [
  body('status')
    .isIn(['available', 'reserved', 'sold', 'expired'])
    .withMessage('Invalid status')
];

// Routes
router.post(
  '/create',
  protect,
  requireAddressVerification,
  upload.array('images', 5),
  createListingValidation,
  createListing
);

router.get('/listings', protect, requireAddressVerification, getListings);
router.get('/my-listings', protect, getMyListings);
router.get('/:id', protect, requireAddressVerification, getListing);
router.put('/:id/like', protect, requireAddressVerification, toggleLike);
router.post('/:id/interest', protect, requireAddressVerification, interestValidation, expressInterest);
router.put('/:id/status', protect, statusValidation, updateListingStatus);

// Test route
router.get('/test', (req, res) => {
  res.json({ 
    message: 'Marketplace routes are working!',
    hindi_message: 'मार्केटप्लेस मार्ग काम कर रहे हैं!',
    available_routes: [
      'POST /api/marketplace/create',
      'GET /api/marketplace/listings',
      'GET /api/marketplace/my-listings',
      'GET /api/marketplace/:id',
      'PUT /api/marketplace/:id/like',
      'POST /api/marketplace/:id/interest',
      'PUT /api/marketplace/:id/status'
    ]
  });
});

module.exports = router;