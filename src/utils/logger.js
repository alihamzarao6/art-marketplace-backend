// // Winston logger setup
// const winston = require("winston");
// const config = require("../config/config");

// // Define log format
// const logFormat = winston.format.printf(
//   ({ level, message, timestamp, stack }) => {
//     return `${timestamp} [${level}]: ${message} ${stack ? stack : ""}`;
//   }
// );

// // Create logger instance
// const logger = winston.createLogger({
//   level: config.nodeEnv === "development" ? "debug" : "info",
//   format: winston.format.combine(
//     winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
//     winston.format.errors({ stack: true }),
//     logFormat
//   ),
//   transports: [
//     // Write all logs error (and below) to error.log
//     new winston.transports.File({
//       filename: "logs/error/error.log",
//       level: "error",
//       maxsize: 5242880, // 5MB
//       maxFiles: 5,
//     }),
    
//     // Write to all logs to combined.log
//     new winston.transports.File({
//       filename: "logs/combined/combined.log",
//       maxsize: 5242880, // 5MB
//       maxFiles: 5,
//     }),
//   ],
// });

// // Add console transport in development
// if (config.nodeEnv === "development") {
//   logger.add(
//     new winston.transports.Console({
//       format: winston.format.combine(
//         winston.format.colorize(),
//         winston.format.simple()
//       ),
//     })
//   );
// }

// module.exports = logger;





// Winston logger setup for serverless environment
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
    // Only use console transport in serverless environment
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  ],
});

// In development, you can add file transports if needed
// But in production/serverless, only console logging works
if (config.nodeEnv === "development" && typeof window === 'undefined') {
  // Only add file transports in local development
  try {
    logger.add(new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }));
    
    logger.add(new winston.transports.File({
      filename: "logs/combined.log",
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }));
  } catch (error) {
    // If file logging fails, just continue with console logging
    console.warn('File logging not available, using console only');
  }
}

module.exports = logger;