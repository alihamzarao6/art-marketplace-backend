const serverless = require("serverless-http");
const app = require("../src/app");
const connectDB = require("../src/config/database");

// Connect to MongoDB
connectDB();

module.exports = serverless(app);
