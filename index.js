const app = require("./src/app");
const mongoose = require("mongoose");
const logger = require("./src/utils/logger");
const config = require("./src/config/config");
const connectDB = require("./src/config/database");

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  logger.error("UNCAUGHT EXCEPTION! 💥 Shutting down...");
  logger.error(err.name, err.message, err.stack);
  process.exit(1);
});

// Connect to MongoDB
connectDB();

// Start server
const server = app.listen(config.port, () => {
  logger.info(
    `Server running in ${config.nodeEnv} mode on port ${config.port}`
  );
});

// Socket.io setup
const io = require("socket.io")(server, {
  cors: {
    origin: config.frontendUrl,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Configure socket events
require("./src/sockets")(io);

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  logger.error("UNHANDLED REJECTION! 💥 Shutting down...");
  logger.error(err.name, err.message, err.stack);
  server.close(() => {
    process.exit(1);
  });
});

// Handle SIGTERM signal
process.on("SIGTERM", () => {
  logger.info("👋 SIGTERM RECEIVED. Shutting down gracefully");
  server.close(() => {
    logger.info("💥 Process terminated!");
  });
});
