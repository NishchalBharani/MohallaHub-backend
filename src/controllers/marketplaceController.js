const Marketplace = require('../models/Marketplace');
const { validationResult } = require('express-validator');

// @desc    Create new marketplace listing
// @route   POST /api/marketplace/create
// @access  Private
const createListing = async (req, res, next) => {
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

    // Parse price data
    const priceData = {
      amount: parseFloat(price.amount),
      currency: price.currency || 'INR',
      isNegotiable: price.isNegotiable !== false,
      originalPrice: price.originalPrice ? parseFloat(price.originalPrice) : undefined
    };

    const listing = await Marketplace.create({
      seller: req.user.id,
      title: title.trim(),
      description: description.trim(),
      category,
      condition,
      price: priceData,
      type: type || 'sell',
      images,
      neighborhood: req.user.neighborhood._id,
      location: {
        address: req.user.address?.fullAddress || '',
        coordinates: req.user.address?.coordinates || {}
      },
      upiId,
      tags: Array.isArray(tags) ? tags : (tags ? [tags] : [])
    });

    await listing.populate('seller', 'name avatar verificationLevel');

    res.status(201).json({
      success: true,
      message: 'Listing created successfully',
      hindi_message: 'लिस्टिंग सफलतापूर्वक बनाई गई',
      listing
    });

  } catch (error) {
    console.error('Create listing error:', error);
    next(error);
  }
};

// @desc    Get marketplace listings
// @route   GET /api/marketplace/listings
// @access  Private
const getListings = async (req, res, next) => {
  try {
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
    if (minPrice) filters.minPrice = parseFloat(minPrice);
    if (maxPrice) filters.maxPrice = parseFloat(maxPrice);
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
      page,
      limit,
      message: 'Listings retrieved successfully',
      hindi_message: 'लिस्टिंग सफलतापूर्वक प्राप्त की गई',
      listings
    });

  } catch (error) {
    console.error('Get listings error:', error);
    next(error);
  }
};

// @desc    Get single listing
// @route   GET /api/marketplace/:id
// @access  Private
const getListing = async (req, res, next) => {
  try {
    const listing = await Marketplace.findById(req.params.id)
      .populate('seller', 'name avatar verificationLevel phone')
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

  } catch (error) {
    console.error('Get listing error:', error);
    next(error);
  }
};

// @desc    Toggle like on listing
// @route   PUT /api/marketplace/:id/like
// @access  Private
const toggleLike = async (req, res, next) => {
  try {
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
        likeCount: listing.likes.length - 1
      });
    } else {
      await listing.addLike(req.user.id);
      res.json({
        success: true,
        message: 'Listing liked successfully',
        hindi_message: 'लिस्टिंग लाइक कर दी गई',
        liked: true,
        likeCount: listing.likes.length + 1
      });
    }

  } catch (error) {
    console.error('Toggle like error:', error);
    next(error);
  }
};

// @desc    Express interest in listing
// @route   POST /api/marketplace/:id/interest
// @access  Private
const expressInterest = async (req, res, next) => {
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
      hindi_message: 'रुचि सफलतापूर्वक व्यक्त की गई',
      interestCount: listing.interestedUsers.length
    });

  } catch (error) {
    console.error('Express interest error:', error);
    next(error);
  }
};

// @desc    Get user's listings
// @route   GET /api/marketplace/my-listings
// @access  Private
const getMyListings = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const { status, type } = req.query;

    let query = { seller: req.user.id };
    if (status) query.status = status;
    if (type) query.type = type;

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

  } catch (error) {
    console.error('Get my listings error:', error);
    next(error);
  }
};

// @desc    Update listing status
// @route   PUT /api/marketplace/:id/status
// @access  Private
const updateListingStatus = async (req, res, next) => {
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
    
    if (status === 'sold') {
      listing.status = 'active'; // Keep it active but mark as sold
    }
    
    await listing.save();

    res.json({
      success: true,
      message: 'Listing status updated successfully',
      hindi_message: 'लिस्टिंग स्थिति सफलतापूर्वक अपडेट की गई',
      listing
    });

  } catch (error) {
    console.error('Update listing status error:', error);
    next(error);
  }
};

// @desc    Delete listing
// @route   DELETE /api/marketplace/:id
// @access  Private
const deleteListing = async (req, res, next) => {
  try {
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
        message: 'You can only delete your own listings',
        hindi_message: 'आप केवल अपनी खुद की लिस्टिंग हटा सकते हैं'
      });
    }

    // Soft delete
    listing.status = 'deleted';
    listing.isAvailable = false;
    await listing.save();

    res.json({
      success: true,
      message: 'Listing deleted successfully',
      hindi_message: 'लिस्टिंग सफलतापूर्वक हटा दी गई'
    });

  } catch (error) {
    console.error('Delete listing error:', error);
    next(error);
  }
};

// @desc    Get trending listings
// @route   GET /api/marketplace/trending
// @access  Private
const getTrendingListings = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    if (!req.user.neighborhood) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your address to view trending listings',
        hindi_message: 'ट्रेंडिंग लिस्टिंग देखने के लिए कृपया अपना पता सत्यापित करें'
      });
    }

    const listings = await Marketplace.findTrending(req.user.neighborhood._id, limit);

    res.json({
      success: true,
      count: listings.length,
      message: 'Trending listings retrieved successfully',
      hindi_message: 'ट्रेंडिंग लिस्टिंग सफलतापूर्वक प्राप्त की गई',
      listings
    });

  } catch (error) {
    console.error('Get trending listings error:', error);
    next(error);
  }
};

// @desc    Get listings by category
// @route   GET /api/marketplace/category/:category
// @access  Private
const getListingsByCategory = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const { type, condition, minPrice, maxPrice } = req.query;

    if (!req.user.neighborhood) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your address to view listings',
        hindi_message: 'लिस्टिंग देखने के लिए कृपया अपना पता सत्यापित करें'
      });
    }

    const filters = {};
    if (type) filters.type = type;
    if (condition) filters.condition = condition;
    if (minPrice) filters.minPrice = parseFloat(minPrice);
    if (maxPrice) filters.maxPrice = parseFloat(maxPrice);

    const listings = await Marketplace.findByCategory(
      req.params.category,
      filters,
      page,
      limit
    );

    res.json({
      success: true,
      count: listings.length,
      page,
      limit,
      category: req.params.category,
      message: 'Category listings retrieved successfully',
      hindi_message: 'श्रेणी लिस्टिंग सफलतापूर्वक प्राप्त की गई',
      listings
    });

  } catch (error) {
    console.error('Get listings by category error:', error);
    next(error);
  }
};

module.exports = {
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
};