const Artwork = require("../models/Artwork");
const logger = require("../utils/logger");

class AnalyticsService {
  // Get top selling artists with detailed metrics
  async getTopSellingArtists(query = {}) {
    try {
      const { limit = 10, period = "all" } = query;

      // Build date filter based on period
      let dateFilter = {};
      if (period !== "all") {
        const now = new Date();
        let startDate;

        switch (period) {
          case "week":
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case "month":
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          case "year":
            startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
            break;
          default:
            startDate = null;
        }

        if (startDate) {
          dateFilter.soldAt = { $gte: startDate };
        }
      }

      const topArtists = await Artwork.aggregate([
        {
          $match: {
            soldAt: { $type: "date" },
            status: "approved",
            ...dateFilter,
          },
        },
        {
          $group: {
            _id: "$artist",
            totalSales: { $sum: 1 },
            totalRevenue: { $sum: "$price" },
            averagePrice: { $avg: "$price" },
            minPrice: { $min: "$price" },
            maxPrice: { $max: "$price" },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "artistInfo",
            pipeline: [
              {
                $project: {
                  username: 1,
                  email: 1,
                  profile: 1,
                  createdAt: 1,
                },
              },
            ],
          },
        },
        { $unwind: "$artistInfo" },
        {
          $project: {
            artistId: "$_id",
            artist: "$artistInfo",
            totalSales: 1,
            totalRevenue: 1,
            averagePrice: { $round: ["$averagePrice", 2] },
            minPrice: 1,
            maxPrice: 1,
          },
        },
        { $sort: { totalRevenue: -1 } },
        { $limit: parseInt(limit) },
      ]);

      return {
        topArtists,
        period,
        totalFound: topArtists.length,
      };
    } catch (error) {
      logger.error("Error getting top selling artists:", error);
      throw error;
    }
  }

  // Get top selling artworks with detailed metrics
  async getTopSellingArtworks(query = {}) {
    try {
      const { limit = 10, period = "all", category } = query;

      // Build date filter
      let dateFilter = {};

      if (period !== "all") {
        const now = new Date();
        let startDate;

        switch (period) {
          case "week":
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case "month":
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          case "year":
            startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
            break;
          default:
            startDate = null;
        }

        if (startDate) {
          dateFilter.soldAt = { $gte: startDate };
        }
      }

      // Build category filter
      let categoryFilter = {};

      if (category) {
        categoryFilter.medium = { $regex: category, $options: "i" };
      }

      const topArtworks = await Artwork.find({
        soldAt: { $type: "date" },
        status: "approved",
        ...dateFilter,
        ...categoryFilter,
      })
        .populate("artist", "username email profile")
        .populate("currentOwner", "username email")
        .sort({ price: -1 })
        .limit(parseInt(limit))
        .lean();

      return {
        topArtworks,
        period,
        category: category || "all",
        totalFound: topArtworks.length,
      };
    } catch (error) {
      logger.error("Error getting top selling artworks:", error);
      throw error;
    }
  }

  // Get top selling categories
  async getTopSellingCategories(query = {}) {
    try {
      const { limit = 10, period = "all" } = query;

      // Build date filter
      let dateFilter = {};
      if (period !== "all") {
        const now = new Date();
        let startDate;

        switch (period) {
          case "week":
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case "month":
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          case "year":
            startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
            break;
          default:
            startDate = null;
        }

        if (startDate) {
          dateFilter.soldAt = { $gte: startDate };
        }
      }

      const topCategories = await Artwork.aggregate([
        {
          $match: {
            soldAt: { $type: "date" },
            status: "approved",
            medium: {
              $exists: true,
              $ne: null,
              $ne: "",
              $type: "string",
            },
            ...dateFilter,
          },
        },
        {
          $group: {
            _id: "$medium",
            totalSales: { $sum: 1 },
            totalRevenue: { $sum: "$price" },
            averagePrice: { $avg: "$price" },
            uniqueArtists: { $addToSet: "$artist" },
          },
        },
        {
          $project: {
            category: "$_id",
            totalSales: 1,
            totalRevenue: 1,
            averagePrice: { $round: ["$averagePrice", 2] },
            uniqueArtists: { $size: "$uniqueArtists" },
          },
        },
        { $sort: { totalSales: -1 } },
        { $limit: parseInt(limit) },
      ]);

      return {
        topCategories,
        period,
        totalFound: topCategories.length,
      };
    } catch (error) {
      logger.error("Error getting top selling categories:", error);
      throw error;
    }
  }

  // Generate comprehensive analytics report
  async generateAnalyticsReport(query = {}) {
    try {
      const { period = "month" } = query;

      const [topArtists, topArtworks, topCategories] = await Promise.all([
        this.getTopSellingArtists({ limit: 5, period }),
        this.getTopSellingArtworks({ limit: 5, period }),
        this.getTopSellingCategories({ limit: 5, period }),
      ]);

      return {
        reportGenerated: new Date(),
        period,
        topArtists,
        topArtworks,
        topCategories,
      };
    } catch (error) {
      logger.error("Error generating analytics report:", error);
      throw error;
    }
  }
}

module.exports = new AnalyticsService();
