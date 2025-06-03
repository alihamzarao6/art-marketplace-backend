const Queue = require("bull");
const config = require("../config/config");
const Transaction = require("../models/Transaction");
const User = require("../models/User");
const emailService = require("../services/emailService");
const logger = require("../utils/logger");

// create payment queue
const paymentQueue = new Queue("payment processing", {
  redis: {
    port: config.redis.port || 6379,
    host: config.redis.host || "localhost",
  },
});

// Process payment confirmation emails
paymentQueue.process("send-payment-confirmation", async (job) => {
  const { transactionId, type } = job.data;

  try {
    logger.info(
      `Processing payment confirmation email for transaction: ${transactionId}`
    );

    const transaction = await Transaction.findById(transactionId)
      .populate("artwork", "title images")
      .populate("buyer", "email username")
      .populate("seller", "email username");

    if (!transaction) {
      throw new Error("Transaction not found");
    }

    if (type === "listing_fee") {
      // Send listing fee confirmation to artist
      await emailService.sendListingFeeConfirmation(
        transaction.seller.email,
        transaction.seller.username,
        transaction.artwork.title,
        transaction.amount / 100 // Convert cents to euros
      );
    } else if (type === "sale") {
      // Send purchase confirmation to buyer
      await emailService.sendPurchaseConfirmation(
        transaction.buyer.email,
        transaction.buyer.username,
        transaction.artwork.title,
        transaction.amount / 100
      );

      // Send sale notification to seller
      await emailService.sendSaleNotification(
        transaction.seller.email,
        transaction.seller.username,
        transaction.artwork.title,
        transaction.amount / 100
      );
    }

    logger.info(
      `Payment confirmation emails sent for transaction: ${transactionId}`
    );

    return { success: true, transactionId, type };
  } catch (error) {
    logger.error(
      `Payment confirmation email failed for transaction ${transactionId}:`,
      error
    );
    throw error;
  }
});

// Process failed payment handling
paymentQueue.process("handle-failed-payment", async (job) => {
  const { paymentIntentId, reason } = job.data;

  try {
    logger.info(`Processing failed payment: ${paymentIntentId}`);

    const transaction = await Transaction.findOne({
      paymentIntent: paymentIntentId,
    })
      .populate("artwork", "title")
      .populate("seller", "email username")
      .populate("buyer", "email username");

    if (!transaction) {
      throw new Error("Transaction not found");
    }

    // Update transaction status
    transaction.status = "failed";
    transaction.metadata = {
      ...transaction.metadata,
      failureReason: reason,
      failedAt: new Date(),
    };
    await transaction.save();

    // Send failure notification
    const userEmail = transaction.buyer?.email || transaction.seller.email;
    const username = transaction.buyer?.username || transaction.seller.username;

    await emailService.sendPaymentFailedNotification(
      userEmail,
      username,
      transaction.artwork.title,
      transaction.transactionType
    );

    logger.info(`Failed payment handled: ${paymentIntentId}`);

    return { success: true, paymentIntentId };
  } catch (error) {
    logger.error(
      `Failed payment handling error for ${paymentIntentId}:`,
      error
    );
    throw error;
  }
});

// Add job functions
const addPaymentConfirmationJob = (transactionId, type) => {
  return paymentQueue.add(
    "send-payment-confirmation",
    { transactionId, type },
    {
      attempts: 3,
      delay: 2000,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
    }
  );
};

const addFailedPaymentJob = (paymentIntentId, reason) => {
  return paymentQueue.add(
    "handle-failed-payment",
    { paymentIntentId, reason },
    {
      attempts: 2,
      delay: 5000,
    }
  );
};

// Error handling
paymentQueue.on("failed", (job, err) => {
  logger.error(`Payment job ${job.id} failed:`, err);
});

paymentQueue.on("completed", (job, result) => {
  logger.info(`Payment job ${job.id} completed:`, result);
});

module.exports = {
  paymentQueue,
  addPaymentConfirmationJob,
  addFailedPaymentJob,
};
