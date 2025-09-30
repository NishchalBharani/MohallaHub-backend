const ErrorResponse = require('../utils/errorResponse');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log to console for dev
  console.error('Error Stack:', err.stack);
  console.error('Error Details:', {
    message: err.message,
    name: err.name,
    code: err.code,
    statusCode: err.statusCode
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    const hindi_message = 'संसाधन नहीं मिला';
    error = new ErrorResponse(message, 404, hindi_message);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `Duplicate field value entered for ${field}`;
    const hindi_message = `${field} के लिए डुप्लिकेट फील्ड मान दर्ज किया गया`;
    error = new ErrorResponse(message, 400, hindi_message);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    const hindi_message = 'डेटा सत्यापन त्रुटि';
    error = new ErrorResponse(message, 400, hindi_message);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    const hindi_message = 'अमान्य टोकन';
    error = new ErrorResponse(message, 401, hindi_message);
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    const hindi_message = 'टोकन समाप्त हो गया';
    error = new ErrorResponse(message, 401, hindi_message);
  }

  // MongoDB connection errors
  if (err.name === 'MongoNetworkError') {
    const message = 'Database connection error';
    const hindi_message = 'डेटाबेस कनेक्शन त्रुटि';
    error = new ErrorResponse(message, 500, hindi_message);
  }

  if (err.name === 'MongoServerError' && err.code === 121) {
    const message = 'Document validation failed';
    const hindi_message = 'दस्तावेज़ सत्यापन विफल रहा';
    error = new ErrorResponse(message, 400, hindi_message);
  }

  // Multer errors (file upload)
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const message = 'File too large';
      const hindi_message = 'फ़ाइल बहुत बड़ी है';
      error = new ErrorResponse(message, 400, hindi_message);
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      const message = 'Too many files';
      const hindi_message = 'बहुत अधिक फ़ाइलें';
      error = new ErrorResponse(message, 400, hindi_message);
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      const message = 'Unexpected file field';
      const hindi_message = 'अप्रत्याशित फ़ाइल फ़ील्ड';
      error = new ErrorResponse(message, 400, hindi_message);
    } else {
      const message = 'File upload error';
      const hindi_message = 'फ़ाइल अपलोड त्रुटि';
      error = new ErrorResponse(message, 400, hindi_message);
    }
  }

  // Default to 500 server error
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Server Error';
  const hindi_message = error.hindi_message || 'सर्वर त्रुटि';

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      hindi_message,
      statusCode,
      timestamp: new Date().toISOString(),
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
};

module.exports = errorHandler;