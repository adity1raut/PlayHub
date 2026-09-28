import mongoose from "mongoose";

const MessageSchema = mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Text, or the optional caption of an attachment message
    content: {
      type: String,
      required: function () {
        return !this.attachments?.length;
      },
      trim: true,
      maxLength: 1000,
      default: "",
    },
    type: {
      type: String,
      enum: ["text", "image", "file", "audio", "video"],
      default: "text",
    },
    readBy: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        readAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    edited: {
      type: Boolean,
      default: false,
    },
    editedAt: {
      type: Date,
    },
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    attachments: [
      {
        filename: String, // storage id: Cloudinary public_id, or the file name under uploads/chat
        originalName: String,
        mimetype: String,
        size: Number,
        url: String,
      },
    ],
    reactions: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        emoji: {
          type: String,
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    deleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

MessageSchema.index({ conversationId: 1, createdAt: -1 });
MessageSchema.index({ sender: 1, createdAt: -1 });
MessageSchema.index({ conversationId: 1, deleted: 1, createdAt: -1 });

MessageSchema.virtual("isReadBy").get(function () {
  return (userId) => {
    return this.readBy.some(
      (read) => read.user.toString() === userId.toString(),
    );
  };
});

MessageSchema.pre("save", function (next) {
  if (this.isModified("content") && !this.isNew) {
    this.edited = true;
    this.editedAt = new Date();
  }
  next();
});

MessageSchema.statics.markAsRead = async function (messageId, userId) {
  const message = await this.findById(messageId);
  if (!message) return null;

  const alreadyRead = message.readBy.some(
    (read) => read.user.toString() === userId.toString(),
  );
  if (!alreadyRead) {
    message.readBy.push({ user: userId, readAt: new Date() });
    await message.save();
  }
  return message;
};

MessageSchema.statics.getUnreadCount = async function (conversationId, userId) {
  return await this.countDocuments({
    conversationId,
    sender: { $ne: userId },
    "readBy.user": { $ne: userId },
    deleted: false,
  });
};

MessageSchema.methods.addReaction = function (userId, emoji) {
  const existingReaction = this.reactions.find(
    (r) => r.user.toString() === userId.toString() && r.emoji === emoji,
  );

  if (existingReaction) {
    this.reactions = this.reactions.filter(
      (r) => !(r.user.toString() === userId.toString() && r.emoji === emoji),
    );
  } else {
    this.reactions = this.reactions.filter(
      (r) => r.user.toString() !== userId.toString(),
    );
    this.reactions.push({ user: userId, emoji });
  }

  return this.save();
};

MessageSchema.methods.softDelete = function (userId) {
  this.deleted = true;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  return this.save();
};

const Message = mongoose.model("Message", MessageSchema);

export default Message;
