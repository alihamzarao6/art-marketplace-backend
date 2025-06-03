const mongoose = require("mongoose");
const Artwork = require("../models/Artwork");
const User = require("../models/User");
const ListingPayment = require("../models/ListingPayment");
const TraceabilityRecord = require("../models/TraceabilityRecord");
const artworkCacheService = require("./artworkCacheService");
const { deleteCloudinaryImage } = require("../middleware/upload");
const { addArtworkCleanupJob } = require("../jobs/cleanupJobs");
const AppError = require("../utils/appError");
const logger = require("../utils/logger");

class ArtworkService {
  async createArtwork(artistId, artworkData) {
    // Start a database session for transaction
    const session = await mongoose.startSession();

    try {
      // Start transaction
      session.startTransaction();

      // Create artwork with pending status
      const artwork = await Artwork.create(
        [
          {
            ...artworkData,
            artist: artistId,
            status: "pending",
            currentOwner: artistId,
          },
        ],
        { session }
      );

      // Create initial traceability record
      const transactionHash = TraceabilityRecord.generateTransactionHash();
      await TraceabilityRecord.create(
        [
          {
            artworkId: artwork[0]._id,
            fromUserId: artistId,
            toUserId: artistId,
            transactionType: "created",
            transactionHash,
            additionalData: {
              price: artworkData.price,
              condition: "new",
            },
          },
        ],
        { session }
      );

      // If we get here, both operations succeeded. Commit the transaction
      await session.commitTransaction();

      // Populate artist details
      await artwork[0].populate("artist", "username email profile");

      logger.info(`Artwork created: ${artwork._id} by artist ${artistId}`);

      return artwork[0];
    } catch (error) {
      // If anything fails, rollback the entire transaction
      await session.abortTransaction();
      logger.error("Error creating artwork:", error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  async checkListingFeePaid(artworkId) {
    try {
      const payment = await ListingPayment.findOne({
        artwork: artworkId,
        status: "completed",
      });

      return !!payment;
    } catch (error) {
      logger.error("Error checking listing fee payment:", error);
      return false;
    }
  }

  // Get all artworks with pagination and filtering
  async getArtworks(query) {
    try {
      // generate cache key
      const cacheKey = artworkCacheService.generateListCacheKey(query);

      // try to get cached artworks first
      const cachedResults = await artworkCacheService.getCachedArtworkList(
        cacheKey
      );
      if (cachedResults) {
        return cachedResults;
      }

      const {
        page = 1,
        limit = 10,
        sort = "-createdAt",
        status = "approved",
        minPrice,
        maxPrice,
        tags,
        search,
        artist,
      } = query;

      // Build filter object
      const filter = { status };

      // Price Filter
      if (minPrice || maxPrice) {
        filter.price = {};
        if (minPrice) filter.price.$gte = minPrice;
        if (maxPrice) filter.price.$lte = maxPrice;
      }

      // Artist filtering
      if (artist) {
        filter.artist = artist;
      }

      // Tags Filter
      if (tags) {
        const tagArray = Array.isArray(tags) ? tags : [tags];
        filter.tags = { $in: tagArray };
      }

      // Text search
      if (search) {
        filter.$text = {
          $search: search,
          $caseSensitive: false,
        };
      }

      // Calculate pagination
      const skip = (page - 1) * limit;

      // Execute query
      const artworks = await Artwork.find(filter)
        .populate("artist", "username profile")
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      // Get total count for pagination
      const total = await Artwork.countDocuments(filter);

      const result = {
        artworks,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit),
          hasNextPage: skip + limit < total,
          hasPrevPage: page > 1,
        },
      };

      await artworkCacheService.cacheArtworkList(cacheKey, result);

      return result;
    } catch (error) {
      logger.error("Error getting artworks", error);
      throw error;
    }
  }

  // get single artwork by id
  async getArtworkById(artworkId, includePrivate = false) {
    try {
      // try to get result from cache
      const cachedArtwork = await artworkCacheService.getCachedArtwork(
        artworkId
      );
      if (cachedArtwork && !includePrivate) {
        return cachedArtwork;
      }

      // build filter object to filter our arwork
      const filter = { _id: artworkId };

      // if not including private, only show approved artworks
      if (!includePrivate) {
        filter.status = "approved";
      }

      const artwork = await Artwork.findOne(filter)
        .populate("artist", "username profile email")
        .populate("currentOwner", "username profile")
        .lean();

      if (!artwork) {
        throw new AppError("Artwork not found", 404);
      }

      // Cache the result if it's public
      if (!includePrivate) {
        await artworkCacheService.cacheArtwork(artworkId, artwork);
      }

      return artwork;
    } catch (error) {
      logger.error(`Error getting artwork by ID: ${error}`);
      throw error;
    }
  }

  // Update Artwork
  async updateArtwork(artworkId, updateData, userId) {
    try {
      const artwork = await Artwork.findById(artworkId);

      if (!artwork) {
        throw new AppError("Artwork not found", 404);
      }

      // Check ownership
      if (artwork.artist.toString() !== userId) {
        throw new AppError(
          "You do not have permission to update this artwork",
          403
        );
      }

      // Check if artwork is sold
      if (artwork.soldAt) {
        throw new AppError("Cannot update sold artwork", 400);
      }

      const updatedArtwork = await Artwork.findByIdAndUpdate(
        artworkId,
        updateData,
        { new: true, runValidators: true }
      ).populate("artist", "username profile");

      // Invalidate cache
      await artworkCacheService.invalidateArtworkCache(artworkId);

      logger.info(`Artwork updated: ${artworkId} by user: ${userId}`);

      return updatedArtwork;
    } catch (error) {
      logger.error(`Error while updating artwork: ${error}`);
      throw error;
    }
  }

  // delete artwork
  async deleteArtwork(artworkId, userId) {
    try {
      const artwork = await Artwork.findById(artworkId);

      if (!artwork) {
        throw new AppError("Artwork not found", 404);
      }

      // Check ownership
      if (artwork.artist.toString() !== userId) {
        throw new AppError(
          "You do not have permission to delete this artwork",
          403
        );
      }

      // Check if artwork is sold
      if (artwork.soldAt) {
        throw new AppError("Cannot delete sold artwork", 400);
      }

      // Delete images from cloudinary
      //   await Promise.all(
      //     artwork.images.map((imageUrl) => deleteCloudinaryImage(imageUrl))
      //   );

      // Delete related records
      //   Promise.all([
      //     TraceabilityRecord.deleteMany({ artworkId }),
      //     ListingPayment.deleteMany({ artwork: artworkId }),
      //   ]);

      await Artwork.findByIdAndDelete(artworkId);

      // Invalidate cache
      //   await artworkCacheService.invalidateArtworkCache(artworkId);

      // use this cleanup job to perform 3 actions(delete image from cloudinary,related records and to clear/invalidate cache)
      await addArtworkCleanupJob(artworkId, artwork.images, userId);

      logger.info(`Artwork delete: ${artworkId} by user: ${userId}`);

      return { message: "Artwork deleted successfully" };
    } catch (error) {
      logger.error("Error deleting artwork:", error);
      throw error;
    }
  }

  // Get artworks by artist
  async getArtworksByArtist(artistId, query = {}) {
    console.log("getArtworksByArtist service artistId", artistId);

    try {
      const {
        page = 1,
        limit = 10,
        sort = "-createdAt",
        status,
        includePrivate = false,
      } = query;

      const filter = { artist: artistId };

      if (status) {
        filter.status = status;
      } else if (!includePrivate) {
        filter.status = "approved";
      }

      const skip = (page - 1) * limit;

      const artworks = await Artwork.find(filter)
        .populate("artist", "username profile")
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      const total = await Artwork.countDocuments(filter);

      return {
        artworks,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit),
          hasNextPage: skip + limit < total,
          hasPrevPage: page > 1,
        },
      };
    } catch (error) {
      logger.error("Error getting artworks by artist:", error);
      throw error;
    }
  }

  // Search artworks
  async searchArtworks(searchTerm, query = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        sort = "-createdAt",
        minPrice,
        maxPrice,
        tags,
      } = query;

      // build filter object
      const filter = {
        status: "approved",
        $text: { $search: searchTerm },
      };

      // Price filtering
      if (minPrice || maxPrice) {
        filter.price = {};
        if (minPrice) filter.price.$gte = parseFloat(minPrice);
        if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
      }

      // Tags filtering
      if (tags) {
        const tagArray = Array.isArray(tags) ? tags : [tags];
        filter.tags = { $in: tagArray };
      }

      const skip = (page - 1) * limit;

      const artworks = await Artwork.find(filter, {
        score: { $meta: "textScore" },
      })
        .populate("artist", "username profile")
        .sort({ score: { $meta: "textScore" }, ...this.parseSortString(sort) })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      const total = await Artwork.countDocuments(filter);

      return {
        artworks,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit),
          hasNextPage: skip + limit < total,
          hasPrevPage: page > 1,
        },
      };
    } catch (error) {
      logger.error("Error searching artworks:", error);
      throw error;
    }
  }

  // Helper method to parse sort string
  parseSortString(sortString) {
    const sortObj = {};
    if (sortString.startsWith("-")) {
      sortObj[sortString.substring(1)] = -1;
    } else {
      sortObj[sortString] = 1;
    }
    return sortObj;
  }

  // Get artwork statistics (artwork_stats_breakdown.md)
  async getArtworkStats(artistId = null) {
    try {
      const matchStage = artistId
        ? { artist: new mongoose.Types.ObjectId(artistId) }
        : {};

      const stats = await Artwork.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalArtworks: { $sum: 1 },
            approvedArtworks: {
              $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] },
            },
            pendingArtworks: {
              $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
            },
            rejectedArtworks: {
              $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] },
            },
            soldArtworks: {
              $sum: { $cond: [{ $ne: ["$soldAt", null] }, 1, 0] },
            },
            averagePrice: { $avg: "$price" },
            totalValue: { $sum: "$price" },
          },
        },
      ]);

      return (
        stats[0] || {
          totalArtworks: 0,
          approvedArtworks: 0,
          pendingArtworks: 0,
          rejectedArtworks: 0,
          soldArtworks: 0,
          averagePrice: 0,
          totalValue: 0,
        }
      );
    } catch (error) {
      logger.error("Error getting artwork stats:", error);
      throw error;
    }
  }
}

module.exports = new ArtworkService();

/**
 Second Parameter: { score: { $meta: 'textScore' } }
    This is called a projection - it controls which fields are returned.
    What $meta: 'textScore' does:
        When you use $text search, MongoDB calculates a relevance score for each document
        $meta: 'textScore' adds this score as a field called score in the results
        Higher scores = more relevant matches

3. .sort({ score: { $meta: 'textScore' }, ...this.parseSortString(sort) })
    Complex sorting with multiple criteria:
        First priority: score: { $meta: 'textScore' }
            - Sorts by text relevance score (highest first)
            - Most relevant search results appear at the top

        Second priority: ...this.parseSortString(sort)
            - This method converts strings like "-createdAt" into sort object
 */
