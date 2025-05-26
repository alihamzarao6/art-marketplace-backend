const express = require("express");
const router = express.Router();

// Import all route modules
const authRoutes = require("./auth");
// const artRoutes = require("./artwork");
// const artistRoutes = require("./artists");
// const userRoutes = require("./users");
// const adminRoutes = require("./admin");
// const messageRoutes = require("./messages");
// const paymentRoutes = require("./payments");
// const traceabilityRoutes = require("./traceability");
// const uploadRoutes = require("./upload");
// const healthRoutes = require("./health");

// Mount routes
router.use("/auth", authRoutes);
// router.use("/art", artRoutes);
// router.use("/artists", artistRoutes);
// router.use("/users", userRoutes);
// router.use("/admin", adminRoutes);
// router.use("/messages", messageRoutes);
// router.use("/payments", paymentRoutes);
// router.use("/traceability", traceabilityRoutes);
// router.use("/upload", uploadRoutes);
// router.use("/system", healthRoutes);

module.exports = router;
