const mongoose = require("mongoose");

const artworkSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price must be at least 0"],
    },
    images: {
      type: [String],
      required: [true, "At least one image is required"],
    },
    artist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Artist is required"],
    },
    listingFeeStatus: {
      type: String,
      enum: ["unpaid", "pending", "paid", "failed"],
      default: "unpaid",
    },
    listingFeePaymentIntent: {
      type: String, // Store Stripe payment intent ID
      default: null,
    },
    listingFeePaidAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    approvedAt: Date,
    rejectedAt: Date,
    rejectionReason: {
      type: String,
      trim: true,
    },
    soldAt: Date,
    currentOwner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: function () {
        return this.artist;
      },
    },
    tags: [String],
    medium: String,
    dimensions: {
      width: Number,
      height: Number,
      unit: {
        type: String,
        enum: ["cm", "in"],
        default: "cm",
      },
    },
    year: Number,
    isOriginal: {
      type: Boolean,
      default: true,
    },
    edition: {
      number: Number,
      total: Number,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Index for faster searches
artworkSchema.index({ title: "text", description: "text", tags: "text" });
artworkSchema.index({ status: 1, createdAt: -1 });
artworkSchema.index({ artist: 1, status: 1 });

// Virtual for artwork traceability history
artworkSchema.virtual("traceabilityHistory", {
  ref: "TraceabilityRecord",
  foreignField: "artworkId",
  localField: "_id",
});

const Artwork = mongoose.model("Artwork", artworkSchema);

module.exports = Artwork;
