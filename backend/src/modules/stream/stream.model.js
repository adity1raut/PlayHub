import mongoose from "mongoose";

const StreamSchema = new mongoose.Schema(
  {
    host: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    description: { type: String },

    streamKey: { type: String, required: true, unique: true },
    streamUrl: { type: String },

    isLive: { type: Boolean, default: true },

    viewers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    liveChat: [{ type: mongoose.Schema.Types.ObjectId, ref: "LiveMessage" }],

    recordedUrl: { type: String },

    startedAt: { type: Date, default: Date.now },
    announcedAt: { type: Date }, // when followers got the "live now" alert
    endedAt: { type: Date },
  },
  { timestamps: true },
);

const Stream = mongoose.model("Stream", StreamSchema);

export default Stream;
