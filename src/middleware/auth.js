const jwt = require('jsonwebtoken');
const User = require('../models/User');
const asyncHandler = require('./asyncHandler');

// Protect routes
exports.protect = asyncHandler(async (req, res, next) => {
  let token;

  // Check for token in Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  // Check for token in cookies (if using cookie-based auth)
  else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  // Make sure token exists
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route',
      hindi_message: 'इस मार्ग तक पहुंचने के लिए अधिकृत नहीं है'
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "95ea572432f58e4557a3390709ead8608025f361eabd45c4f37040c6724886e3");

    // Check if user still exists
    const user = await User.findById(decoded.id).populate('neighborhood');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User no longer exists',
        hindi_message: 'उपयोगकर्ता अब मौजूद नहीं है'
      });
    }

    // Check if user is active
    if (user.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: 'Account is suspended or deleted',
        hindi_message: 'खाता निलंबित या हटा दिया गया है'
      });
    }

    // Check if phone is verified (for routes that require phone verification)
    if (!user.isPhoneVerified && req.path !== '/update-profile') {
      return res.status(403).json({
        success: false,
        message: 'Please verify your phone number first',
        hindi_message: 'कृपया पहले अपना फोन नंबर सत्यापित करें'
      });
    }

    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route',
      hindi_message: 'इस मार्ग तक पहुंचने के लिए अधिकृत नहीं है'
    });
  }
});

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.role} is not authorized to access this route`,
        hindi_message: `उपयोगकर्ता भूमिका ${req.user.role} इस मार्ग तक पहुंचने के लिए अधिकृत नहीं है`
      });
    }
    next();
  };
};

// Check if user has verified address (for neighborhood-specific routes)
exports.requireAddressVerification = asyncHandler(async (req, res, next) => {
  if (!req.user.isAddressVerified || !req.user.neighborhood) {
    return res.status(403).json({
      success: false,
      message: 'Please verify your address to access neighborhood features',
      hindi_message: 'मोहल्ला सुविधाओं तक पहुंचने के लिए कृपया अपना पता सत्यापित करें'
    });
  }
  next();
});

// Optional authentication (for public routes that can benefit from user context)
exports.optionalAuth = asyncHandler(async (req, res, next) => {
  let token;

  // Check for token in Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  // Check for token in cookies
  else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return next(); // Continue without user
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "95ea572432f58e4557a3390709ead8608025f361eabd45c4f37040c6724886e3");

    // Check if user exists and is active
    const user = await User.findById(decoded.id).populate('neighborhood');
    
    if (user && user.status === 'active') {
      req.user = user;
    }
    
    next();
  } catch (error) {
    // Token is invalid, but continue without user
    next();
  }
});

// Rate limiting for authentication attempts
exports.authRateLimit = (maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
  const attempts = new Map();

  return (req, res, next) => {
    const identifier = req.ip || req.connection.remoteAddress;
    const now = Date.now();

    if (!attempts.has(identifier)) {
      attempts.set(identifier, { count: 1, resetTime: now + windowMs });
    } else {
      const record = attempts.get(identifier);
      
      if (now > record.resetTime) {
        // Reset the counter
        attempts.set(identifier, { count: 1, resetTime: now + windowMs });
      } else {
        record.count++;
        
        if (record.count > maxAttempts) {
          const remainingTime = Math.ceil((record.resetTime - now) / 1000 / 60);
          return res.status(429).json({
            success: false,
            message: `Too many authentication attempts. Please try again in ${remainingTime} minutes.`,
            hindi_message: `बहुत अधिक प्रमाणीकरण प्रयास। कृपया ${remainingTime} मिनट में पुनः प्रयास करें।`
          });
        }
      }
    }

    next();
  };
};

// Validate JWT token without requiring authentication
exports.validateToken = asyncHandler(async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'No token provided',
      hindi_message: 'कोई टोकन प्रदान नहीं किया गया'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "95ea572432f58e4557a3390709ead8608025f361eabd45c4f37040c6724886e3");
    const user = await User.findById(decoded.id).select('phone name isPhoneVerified isAddressVerified role');
    
    if (!user || user.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
        hindi_message: 'अमान्य टोकन'
      });
    }

    res.json({
      success: true,
      valid: true,
      user: {
        id: user._id,
        phone: user.phone,
        name: user.name,
        isPhoneVerified: user.isPhoneVerified,
        isAddressVerified: user.isAddressVerified,
        role: user.role
      }
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid token',
      hindi_message: 'अमान्य टोकन'
    });
  }
});

module.exports = exports;