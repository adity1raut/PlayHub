/**
 * Live-stream interaction over Socket.IO (media itself goes through the SFU, see src/sfu):
 *
 *   join-stream / leave-stream  streamId                     room `stream_<id>` (chat, reactions, stats)
 *   send-stream-message         {streamId, message}          → ack {message} | {error, code}
 *   stream-chat:delete          {streamId, messageId}        host, or the message's author
 *   stream-chat:mute            {streamId, userId, minutes}  host; minutes 0 = unmute
 *   stream:set-slow-mode        {streamId, seconds}          host
 *   stream:react                {streamId, emoji}            rate-limited per socket
 *
 * Server → room: new-stream-message, stream-chat:deleted, stream-chat:muted, stream:chat-settings,
 * stream:reaction, stream:stats (also sent to the host's own tabs, for the analytics view).
 * Handlers answer through the ack callback; clients without one get the old `error` event.
 */
import mongoose from "mongoose";
import Stream from "./stream.model.js";
import LiveMessage from "./streamChat.model.js";
import { toRoom } from "../../socket/realtime.js";
import { liveViewerCount } from "../../sfu/index.js";

export const REACTIONS = ["❤️", "🔥", "😂", "👏", "😮", "💯"];
export const MAX_STREAM_CHAT_LENGTH = 500;
const SLOW_MODE_SECONDS = [0, 5, 15, 30, 60];
const MUTE_MINUTES = [0, 1, 5, 10, 60];

const roomOf = (streamId) => `stream_${streamId}`;

function fail(message, status = 400, extra = {}) {
  const error = new Error(message);
  error.status = status;
  Object.assign(error, extra);
  return error;
}

async function loadStream(streamId) {
  if (!mongoose.isValidObjectId(streamId)) throw fail("Stream not found", 404);
  const stream = await Stream.findById(streamId).select("host isLive chatSlowMode chatMutes").lean();
  if (!stream) throw fail("Stream not found", 404);
  return stream;
}

const activeMute = (stream, userId) =>
  (stream.chatMutes || []).find((m) => String(m.user) === String(userId) && new Date(m.until) > new Date());

const statsTimers = new Map(); // streamId → pending timer

/**
 * Send { viewers (now), uniqueViewers, peakViewers, messages, reactions } to everyone in the stream
 * room and to the host's tabs. Bursts (a chat flurry, a wave of reactions) collapse into one update/second.
 */
export function queueStreamStats(streamId) {
  const id = String(streamId);
  if (statsTimers.has(id)) return;
  statsTimers.set(
    id,
    setTimeout(async () => {
      statsTimers.delete(id);
      try {
        const [s] = await Stream.aggregate([
          { $match: { _id: new mongoose.Types.ObjectId(id) } },
          {
            $project: {
              host: 1,
              isLive: 1,
              peakViewers: 1,
              reactionsCount: 1,
              uniqueViewers: { $size: { $ifNull: ["$viewers", []] } },
              messages: { $size: { $ifNull: ["$liveChat", []] } },
            },
          },
        ]);
        if (!s) return;
        toRoom([roomOf(id), `user_${s.host}`], "stream:stats", {
          streamId: id,
          isLive: s.isLive,
          viewers: liveViewerCount(id),
          uniqueViewers: s.uniqueViewers,
          peakViewers: s.peakViewers || 0,
          messages: s.messages,
          reactions: s.reactionsCount || 0,
        });
      } catch (error) {
        console.error("Stream stats failed:", error.message);
      }
    }, 1000),
  );
}

/** Called by the SFU whenever its room's viewers change: remember who watched and the peak. */
export async function recordViewers(streamId, { count, userIds }) {
  try {
    await Promise.all([
      userIds.length && Stream.updateOne({ _id: streamId }, { $addToSet: { viewers: { $each: userIds } } }),
      Stream.updateOne({ _id: streamId, peakViewers: { $lt: count } }, { $set: { peakViewers: count } }),
    ]);
    queueStreamStats(streamId);
  } catch (error) {
    console.error("recordViewers failed:", error.message);
  }
}

const lastChatAt = new Map(); // `${streamId}:${userId}` → ms, for slow mode

/** Forget per-stream chat state once a stream ends. */
export function forgetStreamChat(streamId) {
  const prefix = `${streamId}:`;
  for (const key of lastChatAt.keys()) if (key.startsWith(prefix)) lastChatAt.delete(key);
}

/**
 * Save and broadcast a stream chat message (socket and REST share this).
 * Enforces length, live-only, host mutes (code CHAT_MUTED) and slow mode (code CHAT_SLOW).
 */
export async function postStreamChat(userId, streamId, rawMessage) {
  const text = String(rawMessage ?? "").trim();
  if (!text) throw fail("Message can't be empty");
  if (text.length > MAX_STREAM_CHAT_LENGTH) {
    throw fail(`Messages can be at most ${MAX_STREAM_CHAT_LENGTH} characters`);
  }

  const stream = await loadStream(streamId);
  if (!stream.isLive) throw fail("Stream has ended");

  if (String(stream.host) !== String(userId)) {
    const mute = activeMute(stream, userId);
    if (mute) {
      const minutes = Math.max(1, Math.ceil((new Date(mute.until) - Date.now()) / 60000));
      throw fail(`The host muted you in this chat for ${minutes} more minute${minutes === 1 ? "" : "s"}`, 403, {
        code: "CHAT_MUTED",
        until: mute.until,
      });
    }
    if (stream.chatSlowMode > 0) {
      const key = `${streamId}:${userId}`;
      const wait = (lastChatAt.get(key) || 0) + stream.chatSlowMode * 1000 - Date.now();
      if (wait > 0) {
        throw fail(`Slow mode is on — wait ${Math.ceil(wait / 1000)}s`, 429, { code: "CHAT_SLOW", retryIn: wait });
      }
      lastChatAt.set(key, Date.now());
    }
  }

  const saved = await LiveMessage.create({ streamId, sender: userId, message: text });
  await Stream.updateOne({ _id: streamId }, { $push: { liveChat: saved._id } });
  await saved.populate("sender", "username profile.profileImage profile.name");

  toRoom(roomOf(streamId), "new-stream-message", { streamId: String(streamId), message: saved, timestamp: new Date() });
  queueStreamStats(streamId);
  return saved;
}

export function registerStreamHandlers(socket) {
  const me = String(socket.userId);

  const on = (event, handler) =>
    socket.on(event, async (payload, ack) => {
      try {
        const result = await handler(payload ?? {});
        if (typeof ack === "function") ack(result ?? {});
      } catch (error) {
        if (!error.status) console.error(`${event} failed:`, error);
        const message = error.status ? error.message : "Something went wrong";
        if (typeof ack === "function") ack({ error: message, code: error.code, until: error.until, retryIn: error.retryIn });
        else socket.emit("error", { message, code: error.code });
      }
    });

  const requireHost = (stream) => {
    if (String(stream.host) !== me) throw fail("Only the host can do that", 403);
  };

  // Streams are public: anyone signed in may listen to a stream's room
  socket.on("join-stream", (streamId) => {
    if (mongoose.isValidObjectId(streamId)) socket.join(roomOf(streamId));
  });
  socket.on("leave-stream", (streamId) => socket.leave(roomOf(streamId)));

  on("send-stream-message", async ({ streamId, message }) => ({
    message: await postStreamChat(me, streamId, message),
  }));

  on("stream-chat:delete", async ({ streamId, messageId }) => {
    const stream = await loadStream(streamId);
    if (!mongoose.isValidObjectId(messageId)) throw fail("Message not found", 404);
    const message = await LiveMessage.findOne({ _id: messageId, streamId }).select("sender").lean();
    if (!message) throw fail("Message not found", 404);
    if (String(stream.host) !== me && String(message.sender) !== me) {
      throw fail("Only the host can remove other people's messages", 403);
    }
    await Promise.all([
      LiveMessage.deleteOne({ _id: messageId }),
      Stream.updateOne({ _id: streamId }, { $pull: { liveChat: message._id } }),
    ]);
    toRoom(roomOf(streamId), "stream-chat:deleted", { streamId: String(streamId), messageId: String(messageId) });
    queueStreamStats(streamId);
    return { ok: true };
  });

  on("stream-chat:mute", async ({ streamId, userId, minutes }) => {
    const stream = await loadStream(streamId);
    requireHost(stream);
    const mins = Number(minutes);
    if (!MUTE_MINUTES.includes(mins)) throw fail("Mute for 1, 5, 10 or 60 minutes (0 unmutes)");
    if (!mongoose.isValidObjectId(userId) || String(userId) === me) throw fail("You can't mute that player");

    const until = mins > 0 ? new Date(Date.now() + mins * 60000) : null;
    // Drop this player's old entry and any expired ones, then add the new mute
    await Stream.updateOne(
      { _id: streamId },
      { $pull: { chatMutes: { $or: [{ user: userId }, { until: { $lte: new Date() } }] } } },
    );
    if (until) await Stream.updateOne({ _id: streamId }, { $push: { chatMutes: { user: userId, until } } });

    toRoom(roomOf(streamId), "stream-chat:muted", { streamId: String(streamId), userId: String(userId), until });
    return { until };
  });

  on("stream:set-slow-mode", async ({ streamId, seconds }) => {
    const stream = await loadStream(streamId);
    requireHost(stream);
    const s = Number(seconds);
    if (!SLOW_MODE_SECONDS.includes(s)) throw fail("Slow mode can be off, 5, 15, 30 or 60 seconds");
    await Stream.updateOne({ _id: streamId }, { $set: { chatSlowMode: s } });
    toRoom(roomOf(streamId), "stream:chat-settings", { streamId: String(streamId), chatSlowMode: s });
    return { chatSlowMode: s };
  });

  // Token bucket: bursts of 6, then ~3 reactions per second per tab
  let bucket = { tokens: 6, at: Date.now() };
  const allowReaction = () => {
    const now = Date.now();
    bucket = { tokens: Math.min(6, bucket.tokens + ((now - bucket.at) / 1000) * 3), at: now };
    if (bucket.tokens < 1) return false;
    bucket.tokens -= 1;
    return true;
  };

  on("stream:react", async ({ streamId, emoji }) => {
    if (!REACTIONS.includes(emoji)) throw fail("Unknown reaction");
    if (!mongoose.isValidObjectId(streamId)) throw fail("Stream not found", 404);
    if (!allowReaction()) return { throttled: true };
    const stream = await Stream.findOneAndUpdate(
      { _id: streamId, isLive: true },
      { $inc: { reactionsCount: 1 } },
      { projection: { _id: 1 } },
    ).lean();
    if (!stream) throw fail("Stream has ended");
    toRoom(roomOf(streamId), "stream:reaction", { streamId: String(streamId), emoji, userId: me });
    queueStreamStats(streamId);
    return { ok: true };
  });
}
