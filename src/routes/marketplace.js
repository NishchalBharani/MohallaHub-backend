const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const { protect, requireAddressVerification } = require('../middleware/auth');

// Import controller
const {
  createListing,
  getListings,
  getListing,
  toggleLike,
  expressInterest,
  getMyListings,
  updateListingStatus,
  deleteListing,
  getTrendingListings,
  getListingsByCategory
} = require('../controllers/marketplaceController');

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
    .matches(/^[a-zA-Z0-9.\-_]{2,49}@[a-zA-Z]{2,}$/)
    .withMessage('Invalid UPI ID format (e.g., name@ybl, name@okicici)')
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
  (req, res, next) => {
    console.log('=== MARKETPLACE CREATE DEBUG ===');
    console.log('Request body:', req.body);
    console.log('Files:', req.files ? req.files.map(f => f.fieldname) : 'No files');
    console.log('User:', req.user.id);
    console.log('Neighborhood:', req.user.neighborhood._id);
    next();
  },
  createListingValidation,
  (req, res, next) => {
    const errors = validationResult(req);
    console.log('=== VALIDATION ERRORS ===');
    console.log('Validation errors:', errors.array());
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        hindi_message: 'सत्यापन विफल रहा',
        errors: errors.array()
      });
    }
    next();
  },
  createListing
);

router.get('/listings', protect, requireAddressVerification, getListings);
router.get('/my-listings', protect, getMyListings);
router.get('/trending', protect, requireAddressVerification, getTrendingListings);
router.get('/category/:category', protect, requireAddressVerification, getListingsByCategory);
router.get('/:id', protect, requireAddressVerification, getListing);
router.put('/:id/like', protect, requireAddressVerification, toggleLike);
router.post('/:id/interest', protect, requireAddressVerification, interestValidation, expressInterest);
router.put('/:id/status', protect, statusValidation, updateListingStatus);
router.delete('/:id', protect, deleteListing);

// Test route
router.get('/test', (req, res) => {
  res.json({ 
    message: 'Marketplace routes are working!',
    hindi_message: 'मार्केटप्लेस मार्ग काम कर रहे हैं!',
    available_routes: [
      'POST /api/marketplace/create',
      'GET /api/marketplace/listings',
      'GET /api/marketplace/my-listings',
      'GET /api/marketplace/trending',
      'GET /api/marketplace/category/:category',
      'GET /api/marketplace/:id',
      'PUT /api/marketplace/:id/like',
      'POST /api/marketplace/:id/interest',
      'PUT /api/marketplace/:id/status',
      'DELETE /api/marketplace/:id'
    ]
  });
});

module.exports = router;