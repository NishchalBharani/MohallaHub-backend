const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

// Import controllers
const {
  register,
  login,
  verifyOTP,
  resendOTP,
  getMe,
  updateProfile,
  logout,
  verifyAddress
} = require('../controllers/authController');

// Import middleware
const { protect } = require('../middleware/auth');

// Validation rules
const phoneValidation = [
  body('phone')
    .isMobilePhone('en-IN')
    .withMessage('Please enter a valid Indian phone number')
    .custom((phone) => {
      // Indian phone number validation (starts with 6-9 and has 10 digits)
      const indianPhoneRegex = /^[6-9]\d{9}$/;
      if (!indianPhoneRegex.test(phone)) {
        throw new Error('Please enter a valid Indian phone number (10 digits, starts with 6-9)');
      }
      return true;
    })
];

const otpValidation = [
  body('otp')
    .isLength({ min: 6, max: 6 })
    .withMessage('OTP must be 6 digits')
    .isNumeric()
    .withMessage('OTP must contain only numbers')
];

const nameValidation = [
  body('name')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Name can only contain letters and spaces')
];

const emailValidation = [
  body('email')
    .optional()
    .isEmail()
    .withMessage('Please enter a valid email address')
    .normalizeEmail()
];

const languageValidation = [
  body('language')
    .optional()
    .isIn(['en', 'hi'])
    .withMessage('Language must be either English (en) or Hindi (hi)')
];

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
    .withMessage('State can only contain letters and spaces'),
  body('coordinates.latitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  body('coordinates.longitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180')
];

// Routes

// @route   POST /api/auth/register
// @desc    Register new user
router.post(
  '/register',
  [
    ...phoneValidation,
    ...nameValidation,
    ...languageValidation
  ],
  register
);

// @route   POST /api/auth/login
// @desc    Login user
router.post(
  '/login',
  phoneValidation,
  login
);

// @route   POST /api/auth/verify-otp
// @desc    Verify OTP
router.post(
  '/verify-otp',
  [
    ...phoneValidation,
    ...otpValidation
  ],
  verifyOTP
);

// @route   POST /api/auth/resend-otp
// @desc    Resend OTP
router.post(
  '/resend-otp',
  phoneValidation,
  resendOTP
);

// @route   GET /api/auth/me
// @desc    Get current user profile
router.get(
  '/me',
  protect,
  getMe
);

// @route   PUT /api/auth/update-profile
// @desc    Update user profile
router.put(
  '/update-profile',
  protect,
  [
    ...nameValidation,
    ...emailValidation,
    ...languageValidation
  ],
  updateProfile
);

// @route   POST /api/auth/verify-address
// @desc    Verify user address
router.post(
  '/verify-address',
  protect,
  addressValidation,
  verifyAddress
);

// @route   POST /api/auth/logout
// @desc    Logout user
router.post(
  '/logout',
  protect,
  logout
);

// @route   GET /api/auth/test
// @desc    Test authentication route
router.get('/test', (req, res) => {
  res.json({ 
    message: 'Auth routes are working!',
    hindi_message: 'प्रमाणीकरण मार्ग काम कर रहे हैं!',
    available_routes: [
      'POST /api/auth/register',
      'POST /api/auth/login', 
      'POST /api/auth/verify-otp',
      'POST /api/auth/resend-otp',
      'GET /api/auth/me',
      'PUT /api/auth/update-profile',
      'POST /api/auth/verify-address',
      'POST /api/auth/logout'
    ]
  });
});

module.exports = router;