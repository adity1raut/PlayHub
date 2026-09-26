import mongoose from "mongoose";

const LiveMessageSchema = new mongoose.Schema(
  {
    streamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Stream",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    message: { type: String, required: true },
  },
  { timestamps: true },
);

const LiveMessage = mongoose.model("LiveMessage", LiveMessageSchema);

export default LiveMessage;
