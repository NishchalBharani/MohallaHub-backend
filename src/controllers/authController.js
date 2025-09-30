const User = require('../models/User');
const Neighborhood = require('../models/Neighborhood');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const crypto = require('crypto');

// @desc    Register user with phone number
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
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

    const { phone, name, language = 'en' } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this phone number',
        hindi_message: 'इस फोन नंबर से उपयोगकर्ता पहले से मौजूद है',
        existingUser: {
          isPhoneVerified: existingUser.isPhoneVerified,
          isAddressVerified: existingUser.isAddressVerified
        }
      });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Create new user
    const user = await User.create({
      phone,
      name: name || `User${phone.slice(-4)}`,
      language,
      otp: {
        code: otp,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        attempts: 0
      }
    });

    // In development, return OTP directly
    // In production, send via SMS
    const response = {
      success: true,
      message: 'Registration successful. Please verify your phone number.',
      hindi_message: 'पंजीकरण सफल। कृपया अपना फोन नंबर सत्यापित करें।',
      userId: user._id,
      phone: user.phone
    };

    // Add OTP in development mode
    if (process.env.NODE_ENV === 'development') {
      response.otp = otp; // Only for development/testing
    }

    res.status(201).json(response);

  } catch (error) {
    console.error('Registration error:', error);
    next(error);
  }
};

// @desc    Login with phone number
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
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

    const { phone } = req.body;

    // Find user by phone
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found with this phone number',
        hindi_message: 'इस फोन नंबर से उपयोगकर्ता नहीं मिला'
      });
    }

    // Check if user is active
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Account is suspended or deleted',
        hindi_message: 'खाता निलंबित या हटा दिया गया है'
      });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Update user with new OTP
    user.otp = {
      code: otp,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      attempts: 0
    };
    await user.save();

    const response = {
      success: true,
      message: 'OTP sent successfully',
      hindi_message: 'ओटीपी सफलतापूर्वक भेजा गया',
      userId: user._id,
      phone: user.phone,
      isPhoneVerified: user.isPhoneVerified,
      isAddressVerified: user.isAddressVerified
    };

    // Add OTP in development mode
    if (process.env.NODE_ENV === 'development') {
      response.otp = otp; // Only for development/testing
    }

    res.json(response);

  } catch (error) {
    console.error('Login error:', error);
    next(error);
  }
};

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
// @access  Public
exports.verifyOTP = async (req, res, next) => {
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

    const { phone, otp } = req.body;

    // Find user
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        hindi_message: 'उपयोगकर्ता नहीं मिला'
      });
    }

    // Verify OTP
    const otpResult = user.verifyOTP(otp);
    
    if (!otpResult.valid) {
      await user.save(); // Save the attempt count
      return res.status(400).json({
        success: false,
        message: otpResult.message,
        hindi_message: otpResult.message === 'Invalid OTP' ? 'अमान्य ओटीपी' : 
                     otpResult.message === 'OTP expired' ? 'ओटीपी समाप्त हो गया' :
                     otpResult.message === 'Maximum attempts exceeded' ? 'अधिकतम प्रयास पार कर गए' :
                     otpResult.message
      });
    }

    // Save user (OTP is cleared in verifyOTP method)
    await user.save();

    // Generate JWT token
    const token = user.generateAuthToken();

    // Update last active
    await user.updateLastActive();

    res.json({
      success: true,
      message: 'Phone number verified successfully',
      hindi_message: 'फोन नंबर सफलतापूर्वक सत्यापित हो गया',
      token,
      user: {
        id: user._id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        language: user.language,
        isPhoneVerified: user.isPhoneVerified,
        isAddressVerified: user.isAddressVerified,
        verificationLevel: user.verificationLevel,
        neighborhood: user.neighborhood,
        role: user.role,
        trustScore: user.trustScore
      }
    });

  } catch (error) {
    console.error('OTP verification error:', error);
    next(error);
  }
};

// @desc    Resend OTP
// @route   POST /api/auth/resend-otp
// @access  Public
exports.resendOTP = async (req, res, next) => {
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

    const { phone } = req.body;

    // Find user
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        hindi_message: 'उपयोगकर्ता नहीं मिला'
      });
    }

    // Check if too many resend attempts
    if (user.otp && user.otp.attempts >= 5) {
      return res.status(429).json({
        success: false,
        message: 'Too many OTP requests. Please try again later.',
        hindi_message: 'बहुत अधिक ओटीपी अनुरोध। कृपया बाद में पुनः प्रयास करें।'
      });
    }

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    user.otp = {
      code: otp,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      attempts: user.otp ? user.otp.attempts + 1 : 1
    };
    
    await user.save();

    const response = {
      success: true,
      message: 'OTP resent successfully',
      hindi_message: 'ओटीपी पुनः भेजा गया',
      userId: user._id
    };

    // Add OTP in development mode
    if (process.env.NODE_ENV === 'development') {
      response.otp = otp; // Only for development/testing
    }

    res.json(response);

  } catch (error) {
    console.error('Resend OTP error:', error);
    next(error);
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('neighborhood', 'name location.address.city')
      .select('-otp');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        hindi_message: 'उपयोगकर्ता नहीं मिला'
      });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        language: user.language,
        address: user.address,
        isPhoneVerified: user.isPhoneVerified,
        isAddressVerified: user.isAddressVerified,
        verificationLevel: user.verificationLevel,
        neighborhood: user.neighborhood,
        role: user.role,
        trustScore: user.trustScore,
        notifications: user.notifications,
        joinedAt: user.joinedAt,
        lastActiveAt: user.lastActiveAt
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    next(error);
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/update-profile
// @access  Private
exports.updateProfile = async (req, res, next) => {
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

    const { name, email, language, notifications } = req.body;

    // Build update object
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (language !== undefined) updateData.language = language;
    if (notifications !== undefined) updateData.notifications = notifications;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('neighborhood', 'name location.address.city');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      hindi_message: 'प्रोफ़ाइल सफलतापूर्वक अपडेट की गई',
      user: {
        id: user._id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        language: user.language,
        notifications: user.notifications,
        verificationLevel: user.verificationLevel,
        neighborhood: user.neighborhood
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    next(error);
  }
};

// @desc    Logout user (client-side token removal)
// @route   POST /api/auth/logout
// @access  Private
exports.logout = async (req, res, next) => {
  try {
    // Update last active
    await User.findByIdAndUpdate(req.user.id, {
      lastActiveAt: new Date()
    });

    res.json({
      success: true,
      message: 'Logged out successfully',
      hindi_message: 'सफलतापूर्वक लॉग आउट हो गया'
    });

  } catch (error) {
    console.error('Logout error:', error);
    next(error);
  }
};

// @desc    Verify neighborhood address
// @route   POST /api/auth/verify-address
// @access  Private
exports.verifyAddress = async (req, res, next) => {
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

    // Update user address
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
    ).populate('neighborhood', 'name location.address.city');

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

  } catch (error) {
    console.error('Address verification error:', error);
    next(error);
  }
};