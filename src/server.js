require("dotenv").config();
const app = require("./app");
const mongoose = require("mongoose");
const logger = require("./utils/logger");
const config = require("./config/config");

const PORT = process.env.PORT || 5000;
// Connect to MongoDB
mongoose
  .connect(config.mongodb.uri)
  .then(() => {
    console.log("Connected to MongoDB");

    // Start server
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB", err);
    process.exit(1);
  });

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

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  logger.error("Uncaught Exception:", err);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  logger.error("Unhandled Rejection:", err);
  process.exit(1);
});
