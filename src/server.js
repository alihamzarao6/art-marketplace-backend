const serverless = require("serverless-http");
const app = require("./app");
const mongoose = require("mongoose");
const logger = require("./utils/logger");
const config = require("./config/config");
const connectDB = require("./config/database");

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  logger.error("UNCAUGHT EXCEPTION! 💥 Shutting down...");
  logger.error(err.name, err.message, err.stack);
  process.exit(1);
});

// Connect to MongoDB
connectDB();

// For serverless deployment, we don't need to create a server
// The serverless function will handle the requests

// Socket.io setup
// const io = require("socket.io")(server, {
//   cors: {
//     origin: config.frontendUrl,
//     methods: ["GET", "POST"],
//     credentials: true,
//   },
// });

// Configure socket events
// require("./src/sockets")(io);

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  logger.error("UNHANDLED REJECTION! 💥 Shutting down...");
  logger.error(err.name, err.message, err.stack);
  process.exit(1);
});

// Handle SIGTERM signal
process.on("SIGTERM", () => {
  logger.info("👋 SIGTERM RECEIVED. Shutting down gracefully");
  logger.info("💥 Process terminated!");
  process.exit(0);
});

// Export the serverless handler
module.exports = serverless(app);
