require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Import routes
const authRoutes = require('./src/routes/auth');
const postRoutes = require('./src/routes/posts');
const neighborhoodRoutes = require('./src/routes/neighborhoods');
const userRoutes = require('./src/routes/users');
const marketplaceRoutes = require('./src/routes/marketplace');
const alertRoutes = require('./src/routes/alerts');

// Import middleware
const errorHandler = require('./src/middleware/errorHandler');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://192.168.0.111:19006',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    hindi_error: 'इस आईपी से बहुत अधिक अनुरोध, कृपया बाद में पुनः प्रयास करें।'
  }
});
app.use('/api/', limiter);

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/neighborhoods', neighborhoodRoutes);
app.use('/api/users', userRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/alerts', alertRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'MohallaHub API is running!',
    hindi_message: 'मोहल्ला हब एपीआई चल रही है!',
    kannada_message: 'ಮೊಹಲ್ಲಾಹಬ್ API ಚಾಲನೆಯಲ್ಲಿದೆ!',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'MohallaHub API',
    description: 'Hyperlocal Neighborhood App for India',
    version: '1.0.0',
    message: 'Welcome to MohallaHub!',
    hindi_message: 'मोहल्ला हब में आपका स्वागत है!',
    kannada_message: 'ಮೊಹಲ್ಲಾಹಬ್‌ಗೆ ಸ್ವಾಗತ!'
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// MongoDB connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('Database connection error:', error.message);
    process.exit(1);
  }
};

// Start server
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  
  app.listen(PORT, () => {
    console.log(`🚀 MohallaHub Server running on port ${PORT}`);
    console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔒 Security: ${process.env.NODE_ENV === 'production' ? 'Production mode' : 'Development mode'}`);
    console.log(`🌍 API URL: http://localhost:${PORT}/api`);
    console.log(`🏠 मोहल्ला हब सर्वर पोर्ट ${PORT} पर चल रहा है!`);
  });
};

startServer();

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
  // Close server & exit process
  process.exit(1);
});

module.exports = app;