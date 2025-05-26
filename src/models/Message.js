const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    conversationId: {
      type: String,
      required: true,
      index: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    read: {
      type: Boolean,
      default: false,
    },
    attachments: [
      {
        type: String,
        url: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Create a compound index for faster message retrieval
messageSchema.index({ conversationId: 1, timestamp: 1 });

// Static method to create/get a conversation ID between two users
messageSchema.statics.createConversationId = function (userIdA, userIdB) {
  // Ensure consistent conversation ID regardless of who initiates
  return [userIdA.toString(), userIdB.toString()].sort().join("_");
};

const Message = mongoose.model("Message", messageSchema);

module.exports = Message;
