const {
  stripe,
  paymentConfig,
  getSessionOptions,
} = require("../config/stripe");
const Artwork = require("../models/Artwork");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const ListingPayment = require("../models/ListingPayment");
const TraceabilityRecord = require("../models/TraceabilityRecord");
const AppError = require("../utils/appError");
const logger = require("../utils/logger");
const {
  addPaymentConfirmationJob,
  addFailedPaymentJob,
} = require("../jobs/paymentJobs");
const { default: mongoose } = require("mongoose");

class PaymentService {
  // create stripe customer if doesn't exist
  async ensureStripeCustomer(user) {
    try {
      if (user.stripeCustomerId) {
        // verify customer still exitsts in Stripe
        try {
          await stripe.customers.retrieve(user.stripeCustomerId);
          return user.stripeCustomerId;
        } catch (error) {
          logger.warn(
            `Strip customer ${user.stripeCustomerId} not found, creating new one`
          );
        }
      }

      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.username,
        metadata: {
          userId: user._id.toString(),
          role: user.role,
        },
      });

      // Update user with Stripe customer ID
      await User.findByIdAndUpdate(user._id, { stripeCustomerId: customer.id });

      return customer.id;
    } catch (error) {
      logger.error("Error ensuring Stripe customer:", error);
      throw new AppError("Failed to create payment customer", 500);
    }
  }

  // Create listing fee payment session
  async createListingPaymentSession(artworkId, userId) {
    try {
      // verify artworks exists and belongs to user
      const artwork = await Artwork.findById(artworkId);
      if (!artwork) {
        throw new AppError("Artwork not found", 404);
      }

      if (artwork.artist.toString() !== userId) {
        throw new AppError(
          "You can only pay listing fees for your own artwork",
          403
        );
      }

      // Check if already paid
      const existingPayment = await ListingPayment.findOne({
        artwork: artworkId,
        status: "completed",
      });

      if (existingPayment) {
        throw new AppError("Listing fee already paid for this artwork", 400);
      }

      // Get user and ensure Stripe customer
      const user = await User.findById(userId);
      const customerId = await this.ensureStripeCustomer(user);

      // create payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: paymentConfig.listingFee.amount,
        currency: paymentConfig.listingFee.currency,
        customer: customerId,
        description: `${paymentConfig.listingFee.description} - ${artwork.title}`,
        metadata: {
          type: "listing_fee",
          artworkId: artworkId.toString(),
          userId: userId,
          artworkTitle: artwork.title,
        },
      });

      // Create checkout session
      const session = await stripe.checkout.sessions.create({
        ...getSessionOptions(customerId, {
          type: "listing_fee",
          artworkId: artworkId.toString(),
          userId: userId,
        }),
        line_items: [
          {
            price_data: {
              currency: paymentConfig.listingFee.currency,
              product_data: {
                name: "Artwork Listing Fee",
                description: `List "${artwork.title}" on 3rd Hand Art Marketplace`,
                images: artwork.images.slice(0, 1), // First image only
              },
              unit_amount: paymentConfig.listingFee.amount,
            },
            quantity: 1,
          },
        ],
        payment_intent_data: {
          metadata: paymentIntent.metadata,
        },
      });

      // Record listing payment in database
      await ListingPayment.create({
        artist: userId,
        artwork: artworkId,
        paymentIntent: paymentIntent.id,
        sessionId: session.id,
        amount: paymentConfig.listingFee.amount,
        status: "pending",
      });

      // Record transaction
      await Transaction.create({
        seller: userId,
        artwork: artworkId,
        amount: paymentConfig.listingFee.amount,
        paymentIntent: paymentIntent.id,
        status: "pending",
        transactionType: "listing_fee",
        metadata: {
          stripe_session_id: session.id,
          artwork_title: artwork.title,
        },
      });

      logger.info(
        `Listing payment session created for artwork ${artworkId} by user ${userId}`
      );

      return {
        sessionId: session.id,
        sessionUrl: session.url,
        paymentIntentId: paymentIntent.id,
      };
    } catch (error) {
      logger.error("Error creating listing payment session:", error);
      throw error;
    }
  }

  // Create purchase payment session
  async createPurchasePaymentSession(artworkId, buyerId) {
    try {
      // Verify artwork exists and is available for purchase
      const artwork = await Artwork.findById(artworkId).populate("artist");
      if (!artwork) {
        throw new AppError("Artwork not found", 404);
      }

      if (artwork.status !== "approved") {
        throw new AppError("Artwork is not available for puschase", 400);
      }

      if (artwork.soldAt) {
        throw new AppError("Artwork is already sold", 400);
      }

      if (artwork.artist._id.toString() === buyerId) {
        throw new AppError("You cannot purchase your own artwork", 400);
      }

      // Get buyer and ensure Stripe Customer
      const buyer = User.findById(buyerId);
      const customerId = this.ensureStripeCustomer(buyer);

      // Calculate platform commission (5% for example)
      const platformCommission = Math.round(artwork.price * 0.05);
      const artistAmount = artwork.price - platformCommission;

      // Create payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: artwork.price * 100, // Convert to cents
        currency: "eur",
        customer: customerId,
        description: `Purchase: ${artwork.title} by ${artwork.artist.username}`,
        metadata: {
          type: "sale",
          artworkId: artworkId.toString(),
          buyerId: buyerId,
          sellerId: artwork.artist._id.toString(),
          platformCommission: platformCommission.toString(),
          artistAmount: artistAmount.toString(),
        },
      });

      // create checkout session
      const session = await stripe.checkout.sessions.create({
        ...getSessionOptions(customerId, {
          type: "sale",
          artworkId: artworkId.toString(),
          buyerId: buyerId,
          sellerId: artwork.artist._id.toString(),
        }),
        list_items: [
          {
            price_data: {
              currency: "eur",
              product_data: {
                name: artwork.title,
                description: `Original artwork by ${artwork.artist.username}`,
                images: artwork.images.slice(0, 1),
              },
              unit_amount: artwork.price * 100,
            },
            quantity: 1,
          },
        ],
        payment_intent_data: {
          metadata: paymentIntent.metadata,
        },
      });

      // Record transaction
      await Transaction.create({
        buyer: buyerId,
        seller: artwork.artist._id,
        artwork: artworkId,
        amount: artwork.price * 100,
        paymentIntent: paymentIntent.id,
        status: "pending",
        transactionType: "sale",
        metadata: {
          stripe_session_id: session.id,
          platform_commission: platformCommission,
          artist_amount: artistAmount,
        },
      });

      logger.info(
        `Purchase payment session created for artwork ${artworkId} by buyer ${buyerId}`
      );

      return {
        sessionId: session.id,
        sessionUrl: session.url,
        paymentIntentId: paymentIntent.id,
      };
    } catch (error) {
      logger.error("Error creating purchase payment session,", error);
      throw error;
    }
  }

  // Handle successful payment webhook
  async handlePaymentSuccess(paymentIntent) {
    try {
      const { type, artworkId, userId, buyerId, sellerId } =
        paymentIntent.metadata;

      if (type === "listing_fee") {
        await this.handleListingFeeSuccess(paymentIntent, artworkId, userId);
      } else if (type === "sale") {
        await this.handleSaleSuccess(
          paymentIntent,
          artworkId,
          buyerId,
          sellerId
        );
      }

      logger.info(`Payment success handled for ${type}: ${paymentIntent.id}`);
    } catch (error) {
      logger.error("Error handling payment success:", error);
      throw error;
    }
  }

  // Handle listing fee payment success
  async handleListingFeeSuccess(paymentIntent, artworkId, userId) {
    try {
      await ListingPayment.updateOne(
        { paymentIntent: paymentIntent.id },
        {
          status: "completed",
          paidAt: new Date(),
          metadata: {
            stripe_payment_method: paymentIntent.payment_method,
            stripe_receipt_url: paymentIntent.charges.data[0]?.receipt_url,
          },
        }
      );

      // Update transaction status
      await Transaction.updateOne(
        { paymentIntent: paymentIntent.id },
        {
          status: "completed",
          metadata: {
            ...paymentIntent.metadata,
            stripe_payment_method: paymentIntent.payment_method,
            stripe_receipt_url: paymentIntent.charges.data[0]?.receipt_url,
          },
        }
      );

      // payment confirmation job
      const transaction = await Transaction.findOne({
        paymentIntent: paymentIntent.id,
      });

      if (transaction) {
        await addPaymentConfirmationJob(transaction._id, "listing_fee");
      }

      // Artwork remains pending until admin approval
      logger.info(`Listing fee payment completed for artwork ${artworkId}`);
    } catch (error) {
      logger.error("Error handling listing fee success:", error);
      throw error;
    }
  }

  // Handle sale payment success
  async handleSaleSuccess(paymentIntent, artworkId, buyerId, sellerId) {
    try {
      // Update transaction status
      await Transaction.updateOne(
        { paymentIntent: paymentIntent.id },
        {
          status: "completed",
          metadata: {
            ...paymentIntent.metadata,
            stripe_payment_method: paymentIntent.payment_method,
            stripe_receipt_url: paymentIntent.charges.data[0]?.receipt_url,
          },
        }
      );

      // Update artwork as sold
      const artwork = await Artwork.findByIdAndUpdate(
        artworkId,
        {
          soldAt: new Date(),
          currentOwner: buyerId,
        },
        {
          new: true,
        }
      );

      // Create traceability record for ownership transfer
      const transactionHash = TraceabilityRecord.generateTransactionHash();
      await TraceabilityRecord.create({
        artworkId,
        fromUserId: sellerId,
        toUserId: buyerId,
        transactionType: "sold",
        transactionHash,
        additionalData: {
          price: artwork.price,
          paymentIntent: paymentIntent.id,
          saleDate: new Date(),
        },
      });

      // Add payment confirmation job
      const transaction = await Transaction.findOne({
        paymentIntent: paymentIntent.id,
      });
      if (transaction) {
        await addPaymentConfirmationJob(transaction._id, "sale");
      } else {
        await addFailedPaymentJob(
          transaction._id,
          "Payment failed due to some technical issue"
        );
      }

      logger.info(
        `Sale completed for artwork ${artworkId}, transferred from ${sellerId} to ${buyerId}`
      );
    } catch (error) {
      logger.error("Error handling purchase payment success:", error);
      throw error;
    }
  }

  // Get payment history for user
  async getPaymentHistory(userId, query = {}) {
    try {
      const { page = 1, limit = 10, type = "all", status = "all" } = query;

      // Build filter
      const filter = {
        $or: [{ buyer: userId }, { seller: userId }],
      };

      if (type !== "all") {
        filter.transactionType = type;
      }

      if (status !== "all") {
        filter.status = status;
      }

      const skip = (page - 1) * limit;

      const transactions = await Transaction.find(filter)
        .populate("artwork", "title images price")
        .populate("buyer", "username")
        .populate("seller", "username")
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      const total = await Transaction.countDocuments(filter);

      return {
        transactions,
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
      logger.error("Error getting payment history:", error);
      throw error;
    }
  }

  // Get transaction by ID
  async getTransactionById(transactionId, userId) {
    try {
      const transaction = await Transaction.findById(transactionId)
        .populate("artwork", "title images price")
        .populate("buyer", "username email")
        .populate("seller", "username email")
        .lean();

      if (!transaction) {
        throw new AppError("Transaction not found", 404);
      }

      // Check if user is involved in this transaction
      const isInvolved =
        transaction.buyer?._id.toString() === userId ||
        transaction.seller._id.toString() === userId;

      if (!isInvolved) {
        throw new AppError(
          "You do not have permission to view this transaction",
          403
        );
      }

      return transaction;
    } catch (error) {
      logger.error("Error getting transaction by ID:", error);
      throw error;
    }
  }

  // Get payment statistics for user
  async getPaymentStats(userId) {
    try {
      const stats = await Transaction.aggregate([
        {
          $match: {
            $or: [
              { buyer: new mongoose.Types.ObjectId(userId) },
              { seller: new mongoose.Types.ObjectId(userId) },
            ],
            status: "completed",
          },
        },
        {
          $group: {
            _id: null,
            totalTransactions: { $sum: 1 },
            totalSpent: {
              $sum: {
                $cond: [
                  { $eq: ["$buyer", new mongoose.Types.ObjectId(userId)] },
                  "$amount",
                  0,
                ],
              },
            },
            totalEarned: {
              $sum: {
                $cond: [
                  { $eq: ["$seller", new mongoose.Types.ObjectId(userId)] },
                  "$amount",
                  0,
                ],
              },
            },
            salesCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$seller", new mongoose.Types.ObjectId(userId)] },
                      { $eq: ["$transactionType", "sale"] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            purchasesCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$buyer", new mongoose.Types.ObjectId(userId)] },
                      { $eq: ["$transactionType", "sale"] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            listingFeesCount: {
              $sum: {
                $cond: [{ $eq: ["$transactionType", "listing_fee"] }, 1, 0],
              },
            },
          },
        },
      ]);

      return (
        stats[0] || {
          totalTransactions: 0,
          totalSpent: 0,
          totalEarned: 0,
          salesCount: 0,
          purchasesCount: 0,
          listingFeesCount: 0,
        }
      );
    } catch (error) {
      logger.error("Error getting payment stats:", error);
      throw error;
    }
  }
}

module.exports = new PaymentService();
