import mongoose from "mongoose";

const StreamSchema = new mongoose.Schema(
  {
    host: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    description: { type: String },

    streamKey: { type: String, required: true, unique: true },
    streamUrl: { type: String },

    isLive: { type: Boolean, default: true },

    // Everyone who watched (unique, filled from the SFU room), and the most at once
    viewers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    peakViewers: { type: Number, default: 0 },
    reactionsCount: { type: Number, default: 0 },
    liveChat: [{ type: mongoose.Schema.Types.ObjectId, ref: "LiveMessage" }],

    // Chat moderation (host): seconds between messages per viewer, and timed-out viewers
    chatSlowMode: { type: Number, default: 0 },
    chatMutes: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        until: { type: Date },
      },
    ],

    recordedUrl: { type: String },

    startedAt: { type: Date, default: Date.now },
    announcedAt: { type: Date }, // when followers got the "live now" alert
    endedAt: { type: Date },
  },
  { timestamps: true },
);

const Stream = mongoose.model("Stream", StreamSchema);

export default Stream;
