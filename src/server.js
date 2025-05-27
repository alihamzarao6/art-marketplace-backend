require("dotenv").config();
const serverless = require("serverless-http");
const app = require("./app");
const mongoose = require("mongoose");
const config = require("./config/config");

// Connect to MongoDB if not already connected
let isConnected = false;

const connectDB = async () => {
  if (isConnected) {
    console.log("MongoDB already connected");
    return;
  }

  try {
    await mongoose.connect(config.mongodb.uri);
    isConnected = true;
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    throw error;
  }
};

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err);
});

// Create the serverless handler
const handler = serverless(app);

// Export a function that connects to DB and then handles the request
module.exports = async (req, res) => {
  try {
    await connectDB();
    return handler(req, res);
  } catch (error) {
    console.error("Error in serverless function:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message: error.message,
    });
  }
};
