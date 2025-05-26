// Winston logger setup
const winston = require("winston");
const config = require("../config/config");

// Define log format
const logFormat = winston.format.printf(
  ({ level, message, timestamp, stack }) => {
    return `${timestamp} [${level}]: ${message} ${stack ? stack : ""}`;
  }
);

// Create logger instance
const logger = winston.createLogger({
  level: config.nodeEnv === "development" ? "debug" : "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    logFormat
  ),
  transports: [
    // Write all logs error (and below) to error.log
    new winston.transports.File({
      filename: "logs/error/error.log",
      level: "error",
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    
    // Write to all logs to combined.log
    new winston.transports.File({
      filename: "logs/combined/combined.log",
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// Add console transport in development
if (config.nodeEnv === "development") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  );
}

module.exports = logger;