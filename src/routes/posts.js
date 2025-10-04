const express = require('express');
const { body } = require('express-validator');
const multer = require('multer');
const path = require('path');
const router = express.Router();

// Import controllers
const {
  createPost,
  getFeed,
  getTrending,
  getPost,
  toggleLike,
  addComment,
  addReply,
  deletePost,
  reportPost
} = require('../controllers/postController');

// Import middleware
const { protect, requireAddressVerification } = require('../middleware/auth');

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/posts/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  console.log('Multer received file:', {
    fieldname: file.fieldname,
    mimetype: file.mimetype,
    originalname: file.originalname
  });
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 5 // Maximum 5 files
  },
  fileFilter: fileFilter
});

const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error('Multer error:', {
      code: err.code,
      field: err.field,
      message: err.message
    });
    return res.status(400).json({
      message: `Unexpected field: ${err.field}`,
      hindi_message: `अप्रत्याशित फ़ील्ड: ${err.field}`,
      error: err.code,
      field: err.field
    });
  }
  next(err);
};

const createPostValidation = [
  body('content').isLength({ min: 1, max: 2000 }).withMessage('Post content must be between 1 and 2000 characters'),
  body('type').isIn(['general', 'safety', 'event', 'announcement', 'help', 'recommendation', 'lost_found']).withMessage('Invalid post type'),
  body('neighborhood').notEmpty().withMessage('Neighborhood is required'),
  body('tags').optional().isString().withMessage('Tags must be a string')
];

const commentValidation = [
  body('content')
    .isLength({ min: 1, max: 500 })
    .withMessage('Comment must be between 1 and 500 characters')
];

const replyValidation = [
  body('content')
    .isLength({ min: 1, max: 300 })
    .withMessage('Reply must be between 1 and 300 characters')
];

const reportValidation = [
  body('reason')
    .isIn(['spam', 'inappropriate', 'harassment', 'false_information', 'other'])
    .withMessage('Invalid report reason'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters')
];

// Routes

// @route   POST /api/posts/create
// @desc    Create new post
// Add this debugging middleware BEFORE multer
router.post(
  '/create',
  protect,
  requireAddressVerification,
  upload.array('images', 5),
  handleMulterError,
  (req, res, next) => {
    console.log('=== AFTER MULTER ===');
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    console.log('Files:', req.files ? req.files.map(f => ({ fieldname: f.fieldname, originalname: f.originalname })) : 'No files');
    next();
  },
  createPostValidation,
  createPost
);

// @route   GET /api/posts/feed
// @desc    Get neighborhood feed
router.get(
  '/feed',
  protect,
  requireAddressVerification,
  getFeed
);

// @route   GET /api/posts/trending
// @desc    Get trending posts
router.get(
  '/trending',
  protect,
  requireAddressVerification,
  getTrending
);

// @route   GET /api/posts/:id
// @desc    Get single post
router.get(
  '/:id',
  protect,
  requireAddressVerification,
  getPost
);

// @route   PUT /api/posts/:id/like
// @desc    Like/unlike post
router.put(
  '/:id/like',
  protect,
  requireAddressVerification,
  toggleLike
);

// @route   POST /api/posts/:id/comment
// @desc    Add comment to post
router.post(
  '/:id/comment',
  protect,
  requireAddressVerification,
  commentValidation,
  addComment
);

// @route   POST /api/posts/:postId/comments/:commentId/reply
// @desc    Add reply to comment
router.post(
  '/:postId/comments/:commentId/reply',
  protect,
  requireAddressVerification,
  replyValidation,
  addReply
);

// @route   DELETE /api/posts/:id
// @desc    Delete post
router.delete(
  '/:id',
  protect,
  requireAddressVerification,
  deletePost
);

// @route   POST /api/posts/:id/report
// @desc    Report post
router.post(
  '/:id/report',
  protect,
  requireAddressVerification,
  reportValidation,
  reportPost
);

// @route   GET /api/posts/test
// @desc    Test posts route
router.get('/test', (req, res) => {
  res.json({ 
    message: 'Posts routes are working!',
    hindi_message: 'पोस्ट मार्ग काम कर रहे हैं!',
    available_routes: [
      'POST /api/posts/create',
      'GET /api/posts/feed',
      'GET /api/posts/trending',
      'GET /api/posts/:id',
      'PUT /api/posts/:id/like',
      'POST /api/posts/:id/comment',
      'POST /api/posts/:postId/comments/:commentId/reply',
      'DELETE /api/posts/:id',
      'POST /api/posts/:id/report'
    ]
  });
});

module.exports = router;