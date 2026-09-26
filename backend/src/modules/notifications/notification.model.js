import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  fromUser: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  type: {
    type: String,
    enum: [
      "FOLLOW",
      "STORE_FOLLOW",
      "NEW_ORDER",
      "REVIEW",
      "LIKE",
      "COMMENT",
      "MESSAGE",
      "ORDER_UPDATE",
      "STREAM_START",
      "STREAM_END",
      "STREAM_VIEWER",
      "GENERAL",
    ],
    required: true,
  },
  message: { type: String, required: true },
  link: { type: String },
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

const Notification = mongoose.model("Notification", NotificationSchema);

export default Notification;
