import mongoose from "mongoose";

// One row per browser/device push endpoint. An endpoint belongs to whoever is
// signed in on that device, so subscribing again re-assigns it (upsert by endpoint).
const PushSubscriptionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  endpoint: { type: String, required: true, unique: true },
  keys: {
    p256dh: { type: String, required: true },
    auth: { type: String, required: true },
  },
  userAgent: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
});

const PushSubscription =
  mongoose.models.PushSubscription || mongoose.model("PushSubscription", PushSubscriptionSchema);

export default PushSubscription;
