import PushSubscription from "./pushSubscription.model.js";
import { getVapidPublicKey, sendPushToUser } from "./push.service.js";

const MAX_SUBSCRIPTIONS_PER_USER = 20;
const KEY_PATTERN = /^[A-Za-z0-9_-]+={0,2}$/;

const currentUserId = (req) => req.user?._id || req.user?.id;

function isHttpsUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

const isKey = (value) => typeof value === "string" && value.length > 0 && value.length <= 256 && KEY_PATTERN.test(value);

// GET /api/notifications/push/public-key (public)
export function getPushPublicKey(req, res) {
  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return res.status(503).json({ success: false, message: "Push notifications are not configured on the server" });
  }
  res.json({ success: true, publicKey });
}

// POST /api/notifications/push/subscribe { subscription: PushSubscriptionJSON }
export async function subscribePush(req, res) {
  try {
    const userId = currentUserId(req);
    const subscription = req.body?.subscription;
    const endpoint = subscription?.endpoint;
    const p256dh = subscription?.keys?.p256dh;
    const auth = subscription?.keys?.auth;

    if (!isHttpsUrl(endpoint)) {
      return res.status(400).json({ success: false, message: "Invalid subscription: endpoint must be an https URL" });
    }
    if (!isKey(p256dh) || !isKey(auth)) {
      return res.status(400).json({ success: false, message: "Invalid subscription: missing keys.p256dh / keys.auth" });
    }

    const update = {
      $set: {
        user: userId,
        keys: { p256dh, auth },
        userAgent: String(req.get("user-agent") || "").slice(0, 300),
      },
      $setOnInsert: { endpoint, createdAt: new Date() },
    };
    try {
      await PushSubscription.updateOne({ endpoint }, update, { upsert: true });
    } catch (err) {
      // Two concurrent upserts for the same endpoint: the second one hits the unique index.
      if (err?.code !== 11000) throw err;
      await PushSubscription.updateOne({ endpoint }, { $set: update.$set });
    }

    // Keep the list bounded: drop the oldest devices beyond the cap.
    const extra = await PushSubscription.find({ user: userId })
      .sort({ createdAt: -1 })
      .skip(MAX_SUBSCRIPTIONS_PER_USER)
      .select("_id")
      .lean();
    if (extra.length) await PushSubscription.deleteMany({ _id: { $in: extra.map((s) => s._id) } });

    res.json({ success: true, message: "Push subscription saved" });
  } catch (error) {
    console.error("Error saving push subscription:", error);
    res.status(500).json({ success: false, message: "Failed to save push subscription" });
  }
}

// POST /api/notifications/push/unsubscribe { endpoint }
export async function unsubscribePush(req, res) {
  try {
    const endpoint = req.body?.endpoint;
    if (typeof endpoint !== "string" || !endpoint) {
      return res.status(400).json({ success: false, message: "endpoint is required" });
    }
    const result = await PushSubscription.deleteOne({ endpoint, user: currentUserId(req) });
    res.json({ success: true, removed: result.deletedCount || 0 });
  } catch (error) {
    console.error("Error removing push subscription:", error);
    res.status(500).json({ success: false, message: "Failed to remove push subscription" });
  }
}

// POST /api/notifications/push/test
export async function sendTestPush(req, res) {
  try {
    const result = await sendPushToUser(currentUserId(req), {
      title: "PlayHub test alert",
      body: "Push notifications are working on this device.",
      url: "/notification",
      tag: `test-${Date.now()}`,
      type: "GENERAL",
      test: true,
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
    });
    res.json({
      success: true,
      sent: result.sent,
      total: result.total,
      removed: result.removed,
      failed: result.failed,
      message: result.total
        ? `Sent to ${result.sent} of ${result.total} device${result.total === 1 ? "" : "s"}`
        : "No devices are subscribed yet",
    });
  } catch (error) {
    console.error("Error sending test push:", error);
    res.status(500).json({ success: false, message: "Failed to send test push" });
  }
}
