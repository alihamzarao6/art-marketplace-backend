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

// Initialize express app
const app = express();

// Set security HTTP headers
app.use(helmet());

// Development logging
if (config.nodeEnv === "development") {
  app.use(morgan("dev"));
}

// Enable CORS
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: config.security.rateLimitWindow * 60 * 1000, // in minutes
  max: config.security.rateLimitMax, // max requests per windowMs
  message: "Too many requests from this IP, please try again later!",
});
app.use("/api", limiter);

// Body parser
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Compression
app.use(compression());

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Server is running",
    timestamp: new Date(),
  });
});

// API routes
app.use("/api", routes);

// Handle unrecognized routes
app.all("*", (req, res, next) => {
  const err = new Error(`Can't find ${req.originalUrl} on this server!`);
  err.status = 404;
  next(err);
});

// Global error handler
app.use(errorHandler);

module.exports = app;
