const User = require("../models/User");
const Artwork = require("../models/Artwork");
const Transaction = require("../models/Transaction");
const adminService = require("../services/adminService");
const AppError = require("../utils/appError");
const logger = require("../utils/logger");

// Approve Artwork
const approveArtwork = async (req, res, next) => {
  try {
    const { id: artworkId } = req.params;
    const adminId = req.user.id;

    const result = await adminService.approveArtwork(artworkId, adminId);

    res.status(200).json({
      status: "success",
      message: result.message,
      data: {
        artwork: result.artwork,
      },
    });
  } catch (error) {
    next(error);
    logger.error(`Error in approveArtwork controller: ${error.message}`);
  }
};

// Reject Artwork
const rejectArtwork = async (req, res, next) => {
  try {
    const { id: artworkId } = req.params;
    const { rejectionReason } = req.body;
    const adminId = req.user.id;

    if (!rejectionReason || rejectionReason.trim().length === 0) {
      return next(new AppError("Rejection reason is required", 400));
    }

    const result = await adminService.rejectArtwork(
      artworkId,
      adminId,
      rejectionReason
    );

    res.status(200).json({
      status: "success",
      message: result.message,
      data: {
        artwork: result.artwork,
      },
    });
  } catch (error) {
    next(error);
    logger.error(`Error in rejectArtwork controller: ${error.message}`);
  }
};

// Get pending artworks
const getPendingArtworks = async (req, res, next) => {
  try {
    const result = await adminService.getPendingArtworks(req.query);

    res.status(200).json({
      status: "success",
      results: result.artworks.length,
      data: {
        artworks: result.artworks,
        pagination: result.pagination,
      },
    });
  } catch (error) {
    next(error);
    logger.error(`Error in getPendingArtworks controller: ${error.message}`);
  }
};

// Get artwork statistics
const getArtworkStats = async (req, res, next) => {
  try {
    const stats = await adminService.getArtworkStats();

    res.status(200).json({
      status: "success",
      data: {
        stats,
      },
    });
  } catch (error) {
    next(error);
    logger.error(`Error in getArtworkStats controller: ${error.message}`);
  }
};

// Get user statistics
const getUserStats = async (req, res, next) => {
  try {
    const stats = await adminService.getUserStats();

    res.status(200).json({
      status: "success",
      data: {
        stats,
      },
    });
  } catch (error) {
    next(error);
    logger.error(`Error in getUserStats controller: ${error.message}`);
  }
};

// Get platform overview
const getPlatformOverview = async (req, res, next) => {
  try {
    const overview = await adminService.getPlatformOverview();

    res.status(200).json({
      status: "success",
      data: overview,
    });
  } catch (error) {
    next(error);
    logger.error(`Error in getPlatformOverview controller: ${error.message}`);
  }
};

// Get all users (for admin management)
const getAllUsers = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      role,
      isVerified,
      search,
      sort = "-createdAt",
    } = req.query;

    // Build filter
    const filter = {};

    if (role && ["artist", "buyer", "admin"].includes(role)) {
      filter.role = role;
    }

    if (isVerified !== undefined) {
      filter.isVerified = isVerified === "true";
    }

    if (search) {
      filter.$or = [
        { username: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    // parse sort
    const sortObj = {};
    if (sort.startsWith("-")) {
      sortObj[sort.substring(1)] = -1;
    } else {
      sortObj[sort] = 1;
    }

    const users = await User.find(filter)
      .select("-password -verificationOTP -passwordResetToken")
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await User.countDocuments(filter);

    res.status(200).json({
      status: "success",
      results: users.length,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit),
          hasNextPage: skip + limit < total,
          hasPrevPage: page > 1,
        },
      },
    });
  } catch (error) {
    next(error);
    logger.error(`Error in getAllUsers controller: ${error.message}`);
  }
};

// Get all artworks for admin (including all statuses)
const getAllArtworks = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      search,
      artist,
      sort = "-createdAt",
    } = req.query;

    // Build filter
    const filter = {};

    if (status && ["pending", "approved", "rejected"].includes(status)) {
      filter.status = status;
    }

    if (artist) {
      filter.artist = artist;
    }

    if (search) {
      filter.$text = {
        $search: search,
        $caseSensitive: false,
      };
    }

    const skip = (page - 1) * limit;

    // Parse sort
    const sortObj = {};
    if (sort.startsWith("-")) {
      sortObj[sort.substring(1)] = -1;
    } else {
      sortObj[sort] = 1;
    }

    const artworks = await Artwork.find(filter)
      .populate("artist", "username email profile")
      .populate("currentOwner", "username email")
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Artwork.countDocuments(filter);

    res.status(200).json({
      status: "success",
      results: artworks.length,
      data: {
        artworks,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit),
          hasNextPage: skip + limit < total,
          hasPrevPage: page > 1,
        },
      },
    });
  } catch (error) {
    next(error);
    logger.error(`Error in getAllArtworks controller: ${error.message}`);
  }
};

// Get all transactions for admin
const getAllTransactions = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      type,
      status,
      sort = "-timestamp",
    } = req.query;

    // Build filter
    const filter = {};

    if (type && ["listing_fee", "sale"].includes(type)) {
      filter.transactionType = type;
    }

    if (
      status &&
      ["pending", "completed", "failed", "refunded"].includes(status)
    ) {
      filter.status = status;
    }

    const skip = (page - 1) * limit;

    // Parse sort
    const sortObj = {};
    if (sort.startsWith("-")) {
      sortObj[sort.substring(1)] = -1;
    } else {
      sortObj[sort] = 1;
    }

    const transactions = await Transaction.find(filter)
      .populate("artwork", "title images price")
      .populate("buyer", "username email")
      .populate("seller", "username email")
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    const total = await Transaction.countDocuments(filter);

    res.status(200).json({
      status: "success",
      results: transactions.length,
      data: {
        transactions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit),
          hasNextPage: skip + limit < total,
          hasPrevPage: page > 1,
        },
      },
    });
  } catch (error) {
    next(error);
    logger.error(`Error in getAllTransactions controller: ${error.message}`);
  }
};

module.exports = {
  approveArtwork,
  rejectArtwork,
  getPendingArtworks,
  getArtworkStats,
  getUserStats,
  getPlatformOverview,
  getAllUsers,
  getAllArtworks,
  getAllTransactions,
};
