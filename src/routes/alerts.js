const express = require('express');
const { body } = require('express-validator');
const { protect, authorize, requireAddressVerification } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

// In-memory storage for alerts (use Redis in production)
let alerts = [];

// @desc    Create safety alert
// @route   POST /api/alerts/create
// @access  Private (Moderators/Admins)
const createAlert = asyncHandler(async (req, res, next) => {
  const errors = require('express-validator').validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      hindi_message: 'सत्यापन विफल रहा',
      kannada_message: 'ಪರಿಶೀಲನೆ ವಿಫಲವಾಗಿದೆ',
      errors: errors.array()
    });
  }

  const { title, message, hindi_message, type, severity, expiresIn } = req.body;

  if (!req.user.neighborhood) {
    return res.status(403).json({
      success: false,
      message: 'Please verify your address to create alerts',
      hindi_message: 'अलर्ट बनाने के लिए कृपया अपना पता सत्यापित करें',
      kannada_message: 'ಎಚ್ಚರಿಕೆಗಳನ್ನು ರಚಿಸಲು ದಯವಿಟ್ಟು ನಿಮ್ಮ ವಿಳಾಸವನ್ನು ಪರಿಶೀಲಿಸಿ'
    });
  }

  const alert = {
    id: Date.now().toString(),
    title,
    message,
    hindi_message: hindi_message || message,
    type: type || 'safety',
    severity: severity || 'medium',
    neighborhood: req.user.neighborhood._id,
    createdBy: req.user.id,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + (expiresIn || 24) * 60 * 60 * 1000), // Default 24 hours
    isActive: true
  };

  alerts.push(alert);

  res.status(201).json({
    success: true,
    message: 'Alert created successfully',
    hindi_message: 'अलर्ट सफलतापूर्वक बनाया गया',
    kannada_message: 'ಎಚ್ಚರಿಕೆ ಯಶಸ್ವಿಯಾಗಿ ರಚಿಸಲಾಗಿದೆ',
    alert
  });
});

// @desc    Get active alerts for neighborhood
// @route   GET /api/alerts/active
// @access  Private
const getActiveAlerts = asyncHandler(async (req, res, next) => {
  if (!req.user.neighborhood) {
    return res.status(403).json({
      success: false,
      message: 'Please verify your address to view alerts',
      hindi_message: 'अलर्ट देखने के लिए कृपया अपना पता सत्यापित करें',
      kannada_message: 'ಎಚ್ಚರಿಕೆಗಳನ್ನು ವೀಕ್ಷಿಸಲು ದಯವಿಟ್ಟು ನಿಮ್ಮ ವಿಳಾಸವನ್ನು ಪರಿಶೀಲಿಸಿ'
    });
  }

  const now = new Date();
  const activeAlerts = alerts.filter(alert => 
    alert.neighborhood.toString() === req.user.neighborhood._id.toString() &&
    alert.isActive &&
    alert.expiresAt > now
  );

  res.json({
    success: true,
    count: activeAlerts.length,
    message: 'Active alerts retrieved successfully',
    hindi_message: 'सक्रिय अलर्ट सफलतापूर्वक प्राप्त किए गए',
    kannada_message: 'ಸಕ್ರಿಯ ಎಚ್ಚರಿಕೆಗಳನ್ನು ಯಶಸ್ವಿಯಾಗಿ ಪಡೆಯಲಾಗಿದೆ',
    alerts: activeAlerts
  });
});

// @desc    Get all alerts (Admin only)
// @route   GET /api/alerts/all
// @access  Private (Admin)
const getAllAlerts = asyncHandler(async (req, res, next) => {
  res.json({
    success: true,
    count: alerts.length,
    message: 'All alerts retrieved successfully',
    hindi_message: 'सभी अलर्ट सफलतापूर्वक प्राप्त किए गए',
    kannada_message: 'ಎಲ್ಲಾ ಎಚ್ಚರಿಕೆಗಳನ್ನು ಯಶಸ್ವಿಯಾಗಿ ಪಡೆಯಲಾಗಿದೆ',
    alerts
  });
});

// @desc    Deactivate alert
// @route   PUT /api/alerts/:id/deactivate
// @access  Private (Moderators/Admins)
const deactivateAlert = asyncHandler(async (req, res, next) => {
  const alert = alerts.find(a => a.id === req.params.id);

  if (!alert) {
    return res.status(404).json({
      success: false,
      message: 'Alert not found',
      hindi_message: 'अलर्ट नहीं मिला',
      kannada_message: 'ಎಚ್ಚರಿಕೆ ಕಂಡುಬಂದಿಲ್ಲ'
    });
  }

  // Check if user can deactivate this alert
  if (alert.createdBy.toString() !== req.user.id.toString() && 
      req.user.role !== 'admin' && req.user.role !== 'moderator') {
    return res.status(403).json({
      success: false,
      message: 'You are not authorized to deactivate this alert',
      hindi_message: 'आप इस अलर्ट को निष्क्रिय करने के लिए अधिकृत नहीं हैं',
      kannada_message: 'ನೀವು ಈ ಎಚ್ಚರಿಕೆಯನ್ನು ನಿಷ್ಕ್ರಿಯಗೊಳಿಸಲು ಅಧಿಕೃತರಾಗಿಲ್ಲ'
    });
  }

  alert.isActive = false;

  res.json({
    success: true,
    message: 'Alert deactivated successfully',
    hindi_message: 'अलर्ट सफलतापूर्वक निष्क्रिय कर दिया गया',
    kannada_message: 'ಎಚ್ಚರಿಕೆ ಯಶಸ್ವಿಯಾಗಿ ನಿಷ್ಕ್ರಿಯಗೊಳಿಸಲಾಗಿದೆ'
  });
});

// @desc    Send community notification
// @route   POST /api/alerts/notify
// @access  Private (Moderators/Admins)
const sendNotification = asyncHandler(async (req, res, next) => {
  const errors = require('express-validator').validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      hindi_message: 'सत्यापन विफल रहा',
      kannada_message: 'ಪರಿಶೀಲನೆ ವಿಫಲವಾಗಿದೆ',
      errors: errors.array()
    });
  }

  const { title, message, hindi_message, type } = req.body;

  // In a real app, this would send push notifications
  // For MVP, we'll just create a notification record
  const notification = {
    id: Date.now().toString(),
    title,
    message,
    hindi_message: hindi_message || message,
    type: type || 'community',
    neighborhood: req.user.neighborhood._id,
    createdBy: req.user.id,
    createdAt: new Date(),
    isRead: false
  };

  res.json({
    success: true,
    message: 'Notification sent successfully',
    hindi_message: 'अधिसूचना सफलतापूर्वक भेजी गई',
    kannada_message: 'ಅಧಿಸೂಚನೆ ಯಶಸ್ವಿಯಾಗಿ ಕಳುಹಿಸಲಾಗಿದೆ',
    notification
  });
});

// @desc    Get emergency contacts
// @route   GET /api/alerts/emergency-contacts
// @access  Private
const getEmergencyContacts = asyncHandler(async (req, res, next) => {
  const emergencyContacts = [
    {
      name: 'Police',
      hindi_name: 'पुलिस',
      kannada_name: 'ಪೊಲೀಸ್',
      number: '100',
      description: 'For immediate police assistance',
      hindi_description: 'तत्काल पुलिस सहायता के लिए',
      kannada_description: 'ತಕ್ಷಣದ ಪೊಲೀಸ್ ಸಹಾಯಕ್ಕಾಗಿ'
    },
    {
      name: 'Fire Department',
      hindi_name: 'फायर ब्रिगेड',
      kannada_name: 'ಅಗ್ನಿಶಾಮಕ ದಳ',
      number: '101',
      description: 'For fire emergencies',
      hindi_description: 'आग की आपात स्थिति के लिए',
      kannada_description: 'ಬೆಂಕಿಯ ತುರ್ತು ಸಂದರ್ಭಗಳಿಗೆ'
    },
    {
      name: 'Ambulance',
      hindi_name: 'एम्बुलेंस',
      kannada_name: 'ಆಂಬುಲೆನ್ಸ್',
      number: '108',
      description: 'For medical emergencies',
      hindi_description: 'चिकित्सा आपात स्थिति के लिए',
      kannada_description: 'ವೈದ್ಯಕೀಯ ತುರ್ತು ಸಂದರ್ಭಗಳಿಗೆ'
    },
    {
      name: 'Women Helpline',
      hindi_name: 'महिला हेल्पलाइन',
      kannada_name: 'ಮಹಿಳಾ ಸಹಾಯವಾಣಿ',
      number: '1091',
      description: 'For women safety emergencies',
      hindi_description: 'महिला सुरक्षा आपात स्थिति के लिए',
      kannada_description: 'ಮಹಿಳಾ ಸುರಕ್ಷತೆ ತುರ್ತು ಸಂದರ್ಭಗಳಿಗೆ'
    },
    {
      name: 'Child Helpline',
      hindi_name: 'बाल हेल्पलाइन',
      kannada_name: 'ಮಕ್ಕಳ ಸಹಾಯವಾಣಿ',
      number: '1098',
      description: 'For child protection emergencies',
      hindi_description: 'बाल संरक्षण आपात स्थिति के लिए',
      kannada_description: 'ಮಕ್ಕಳ ರಕ್ಷಣೆ ತುರ್ತು ಸಂದರ್ಭಗಳಿಗೆ'
    }
  ];

  res.json({
    success: true,
    message: 'Emergency contacts retrieved successfully',
    hindi_message: 'आपातकालीन संपर्क सफलतापूर्वक प्राप्त किए गए',
    kannada_message: 'ತುರ್ತು ಸಂಪರ್ಕಗಳನ್ನು ಯಶಸ್ವಿಯಾಗಿ ಪಡೆಯಲಾಗಿದೆ',
    contacts: emergencyContacts
  });
});

// @desc    Report safety incident
// @route   POST /api/alerts/report-incident
// @access  Private
const reportIncident = asyncHandler(async (req, res, next) => {
  const errors = require('express-validator').validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      hindi_message: 'सत्यापन विफल रहा',
      kannada_message: 'ಪರಿಶೀಲನೆ ವಿಫಲವಾಗಿದೆ',
      errors: errors.array()
    });
  }

  const { type, description, location, severity } = req.body;

  if (!req.user.neighborhood) {
    return res.status(403).json({
      success: false,
      message: 'Please verify your address to report incidents',
      hindi_message: 'घटना की रिपोर्ट करने के लिए कृपया अपना पता सत्यापित करें',
      kannada_message: 'ಘಟನೆಯನ್ನು ವರದಿ ಮಾಡಲು ದಯವಿಟ್ಟು ನಿಮ್ಮ ವಿಳಾಸವನ್ನು ಪರಿಶೀಲಿಸಿ'
    });
  }

  const incident = {
    id: Date.now().toString(),
    type,
    description,
    location,
    severity: severity || 'medium',
    neighborhood: req.user.neighborhood._id,
    reportedBy: req.user.id,
    reportedAt: new Date(),
    status: 'pending'
  };

  res.json({
    success: true,
    message: 'Incident reported successfully',
    hindi_message: 'घटना की रिपोर्ट सफलतापूर्वक की गई',
    kannada_message: 'ಘಟನೆಯನ್ನು ಯಶಸ್ವಿಯಾಗಿ ವರದಿಮಾಡಲಾಗಿದೆ',
    incident
  });
});

// Validation rules
const alertValidation = [
  body('title')
    .isLength({ min: 5, max: 100 })
    .withMessage('Title must be between 5 and 100 characters'),
  body('message')
    .isLength({ min: 10, max: 500 })
    .withMessage('Message must be between 10 and 500 characters'),
  body('hindi_message')
    .optional()
    .isLength({ min: 10, max: 500 })
    .withMessage('Hindi message must be between 10 and 500 characters'),
  body('type')
    .optional()
    .isIn(['safety', 'event', 'announcement', 'emergency'])
    .withMessage('Invalid alert type'),
  body('severity')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Invalid severity level'),
  body('expiresIn')
    .optional()
    .isInt({ min: 1, max: 168 })
    .withMessage('Expires in must be between 1 and 168 hours')
];

const incidentValidation = [
  body('type')
    .isIn(['suspicious_activity', 'noise_complaint', 'parking_issue', 'safety_concern', 'other'])
    .withMessage('Invalid incident type'),
  body('description')
    .isLength({ min: 10, max: 1000 })
    .withMessage('Description must be between 10 and 1000 characters'),
  body('location')
    .optional()
    .isString()
    .withMessage('Location must be a string'),
  body('severity')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('Invalid severity level')
];

// Routes
router.post('/create', protect, authorize('moderator', 'admin'), alertValidation, createAlert);
router.get('/active', protect, requireAddressVerification, getActiveAlerts);
router.get('/all', protect, authorize('admin'), getAllAlerts);
router.put('/:id/deactivate', protect, authorize('moderator', 'admin'), deactivateAlert);
router.post('/notify', protect, authorize('moderator', 'admin'), alertValidation, sendNotification);
router.get('/emergency-contacts', protect, getEmergencyContacts);
router.post('/report-incident', protect, requireAddressVerification, incidentValidation, reportIncident);

// Test route
router.get('/test', (req, res) => {
  res.json({ 
    message: 'Alerts routes are working!',
    hindi_message: 'अलर्ट मार्ग काम कर रहे हैं!',
    kannada_message: 'ಎಚ್ಚರಿಕೆ ಮಾರ್ಗಗಳು ಕಾರ್ಯನಿರ್ವಹಿಸುತ್ತಿವೆ!',
    available_routes: [
      'POST /api/alerts/create',
      'GET /api/alerts/active',
      'GET /api/alerts/all',
      'PUT /api/alerts/:id/deactivate',
      'POST /api/alerts/notify',
      'GET /api/alerts/emergency-contacts',
      'POST /api/alerts/report-incident'
    ]
  });
});

module.exports = router;