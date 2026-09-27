import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import webpush from "web-push";
import PushSubscription from "./pushSubscription.model.js";

/*
 * Web Push delivery (VAPID). Keys come from VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY;
 * when those are unset a key pair is generated once and kept in backend/data/vapid.json
 * (gitignored) so existing browser subscriptions keep working across restarts.
 * Everything is loaded lazily on first use, after server.js has run dotenv.
 */

const DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../data");
const VAPID_FILE = path.join(DATA_DIR, "vapid.json");
const DEFAULT_SUBJECT = "mailto:admin@example.com";

const TTL_SECONDS = 24 * 60 * 60;
const HIGH_URGENCY_TYPES = new Set(["MESSAGE", "STREAM_START"]);
const MAX_BODY_LENGTH = 400;

let vapid; // undefined = not loaded yet, null = unusable, object = ready

function readSavedKeys() {
  try {
    const saved = JSON.parse(fs.readFileSync(VAPID_FILE, "utf8"));
    if (saved?.publicKey && saved?.privateKey) return saved;
  } catch {
    // missing or unreadable: fall through and generate
  }
  return null;
}

function generateAndSaveKeys() {
  const keys = webpush.generateVAPIDKeys();
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(
      VAPID_FILE,
      JSON.stringify({ ...keys, createdAt: new Date().toISOString() }, null, 2),
      { mode: 0o600 },
    );
    console.log(`[push] VAPID keys not set in env; generated a new pair and saved it to ${VAPID_FILE}`);
  } catch (err) {
    console.warn(
      `[push] VAPID keys not set in env; generated a new pair but could not save ${VAPID_FILE} (${err.message}). ` +
        "Push subscriptions will stop working after a restart; set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY.",
    );
  }
  return keys;
}

/**
 * Returns { publicKey, privateKey, subject } and configures web-push, or null when
 * push can't be used (malformed env keys). Safe to call repeatedly.
 */
export function getVapidKeys() {
  if (vapid !== undefined) return vapid;

  const envPublic = process.env.VAPID_PUBLIC_KEY?.trim();
  const envPrivate = process.env.VAPID_PRIVATE_KEY?.trim();
  let keys;
  if (envPublic && envPrivate) {
    keys = { publicKey: envPublic, privateKey: envPrivate };
  } else {
    keys = readSavedKeys();
    if (keys) console.log(`[push] VAPID keys not set in env; using the saved pair from ${VAPID_FILE}`);
    else keys = generateAndSaveKeys();
  }

  let subject = process.env.VAPID_SUBJECT?.trim() || DEFAULT_SUBJECT;
  try {
    webpush.setVapidDetails(subject, keys.publicKey, keys.privateKey);
  } catch (err) {
    // A bad subject is recoverable; bad keys are not.
    try {
      webpush.setVapidDetails(DEFAULT_SUBJECT, keys.publicKey, keys.privateKey);
      console.warn(`[push] Invalid VAPID_SUBJECT "${subject}" (${err.message}); using ${DEFAULT_SUBJECT}`);
      subject = DEFAULT_SUBJECT;
    } catch (keyErr) {
      console.error(`[push] Web Push disabled: invalid VAPID keys (${keyErr.message})`);
      vapid = null;
      return vapid;
    }
  }

  vapid = { publicKey: keys.publicKey, privateKey: keys.privateKey, subject };
  return vapid;
}

export function getVapidPublicKey() {
  return getVapidKeys()?.publicKey ?? null;
}

const PUSH_TITLES = {
  MESSAGE: "New message",
  LIKE: "New like",
  COMMENT: "New comment",
  FOLLOW: "New follower",
  STORE_FOLLOW: "New store follower",
  NEW_ORDER: "🛒 New order",
  REVIEW: "New review",
  STREAM_START: "🔴 Live now",
  STREAM_END: "Stream ended",
  STREAM_VIEWER: "New viewer",
  ORDER_UPDATE: "Order update",
  GENERAL: "Spawnpoint",
};

export function pushTitleFor(type) {
  return PUSH_TITLES[type] || "Spawnpoint";
}

const endpointHost = (endpoint) => {
  try {
    return new URL(endpoint).host;
  } catch {
    return "unknown-endpoint";
  }
};

/**
 * Sends `payload` to every push subscription of `userId`.
 * Never throws; resolves to { sent, failed, removed, total }.
 * Subscriptions the push service reports as gone (404/410) are deleted.
 */
export async function sendPushToUser(userId, payload = {}) {
  const result = { sent: 0, failed: 0, removed: 0, total: 0 };
  try {
    if (!userId || !getVapidKeys()) return result;

    const subscriptions = await PushSubscription.find({ user: userId }).lean();
    result.total = subscriptions.length;
    if (!subscriptions.length) return result;

    const data = { ...payload };
    if (typeof data.body === "string" && data.body.length > MAX_BODY_LENGTH) {
      data.body = `${data.body.slice(0, MAX_BODY_LENGTH - 1)}…`;
    }
    const body = JSON.stringify(data);
    const options = {
      TTL: TTL_SECONDS,
      urgency: HIGH_URGENCY_TYPES.has(payload.type) ? "high" : "normal",
      timeout: 10000,
    };

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, body, options);
          result.sent += 1;
        } catch (err) {
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            result.removed += 1;
            await PushSubscription.deleteOne({ _id: sub._id }).catch(() => {});
            return;
          }
          result.failed += 1;
          const detail = String(err?.body || err?.message || "error").trim().slice(0, 160);
          console.warn(
            `[push] send to ${endpointHost(sub.endpoint)} failed (${err?.statusCode || err?.code || "error"}): ${detail}`,
          );
        }
      }),
    );
  } catch (err) {
    console.warn(`[push] sendPushToUser(${userId}) failed: ${err?.message || err}`);
  }
  return result;
}
