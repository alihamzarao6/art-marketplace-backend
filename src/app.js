const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const config = require("./config/config");
const { errorHandler } = require("./middleware/errorHandler");
const routes = require("./routes");

// Create Express app
const app = express();

// Apply middlewares
app.use(helmet()); // Security headers
app.use(compression()); // Compress responses
app.use(morgan("dev")); // HTTP request logging
app.use(cors()); // Enable CORS
app.use(express.json()); // Parse JSON request body
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded request body

// Health check route
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Server is running",
    timestamp: new Date(),
  });
});

// API routes
app.use("/api", routes);

// 404 handler
app.use((req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
});

// Global error handler
app.use(errorHandler);

module.exports = app;
