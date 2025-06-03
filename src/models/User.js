// User schema (artists, buyers, admin)
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const config = require("../config/config");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please use a valid email address"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 8,
      select: false,
    },
    role: {
      type: String,
      enum: ["artist", "buyer", "admin"],
      default: "buyer",
    },
    credits: {
      type: Number,
      default: 0,
    },
    profile: {
      bio: String,
      website: String,
      socialLinks: {
        facebook: String,
        twitter: String,
        instagram: String,
      },
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationOTP: {
      type: String,
      select: false,
    },
    verificationOTPExpires: {
      type: Date,
      select: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    lastActive: {
      type: Date,
      default: Date.now,
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
    stripeCustomerId: {
      type: String,
      select: false, // Don't return in normal queries for security
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual property to get all artworks by this user (if artist)
userSchema.virtual("artworks", {
  ref: "Artwork",
  foreignField: "artist",
  localField: "_id",
});

// Password hashing middleware
userSchema.pre("save", async function (next) {
  // Only run this function if password was modified
  if (!this.isModified("password")) return next();

  // Hash the password with bcrypt
  this.password = await bcrypt.hash(
    this.password,
    config.security.bcryptRounds
  );
  next();
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model("User", userSchema);

module.exports = User;
