//  MongoDB connection setup
const mongoose = require("mongoose");
const logger = require("../utils/logger");
const config = require("./config");

// Remove deprecation warnings
mongoose.set("strictQuery", false);

const connectDB = async () => {
  console.log(config.mongodb.uri);
  try {
    const conn = await mongoose.connect(config.mongodb.uri);
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    logger.error(`Error connecting to MongoDB: ${error}`);
    process.exit(1);
  }
};

module.exports = connectDB;
