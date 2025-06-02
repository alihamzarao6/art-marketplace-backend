const app = require("./src/app");
const mongoose = require("mongoose");
const logger = require("./src/utils/logger");
const config = require("./src/config/config");

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  logger.error("UNCAUGHT EXCEPTION! 💥 Shutting down...");
  logger.error("Error name:", err.name);
  logger.error("Error message:", err.message);
  logger.error("Stack trace:", err.stack);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  logger.error("UNHANDLED REJECTION! 💥 Shutting down...");
  logger.error("Error name:", err.name);
  logger.error("Error message:", err.message);
  logger.error("Stack trace:", err.stack);
  server.close(() => {
    process.exit(1);
  });
});

const PORT = process.env.PORT || config.port || 5000;
let server;

mongoose
  .connect(config.mongodb.uri)
  .then(() => {
    console.log("Connected to MongoDB");

    // Start server ONLY ONCE after MongoDB connection
    server = app.listen(PORT, () => {
      logger.info(`Server running in ${config.nodeEnv} mode on port ${PORT}`);
    });

    // Socket.io setup AFTER server is created
    const io = require("socket.io")(server, {
      cors: {
        origin: config.frontendUrl || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true,
      },
    });

    // Configure socket events
    try {
      require("./src/sockets")(io);
    } catch (error) {
      logger.error("Socket configuration error:", error);
      // Don't crash if sockets fail to initialize
    }
  })
  .catch((err) => {
    logger.error("Failed to connect to MongoDB:", err);
    process.exit(1);
  });

// Handle SIGTERM signal
process.on("SIGTERM", () => {
  logger.info("👋 SIGTERM RECEIVED. Shutting down gracefully");
  if (server) {
    server.close(() => {
      logger.info("💥 Process terminated!");
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});
