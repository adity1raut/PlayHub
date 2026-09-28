/**
 * Live-stream SFU (Selective Forwarding Unit) built on mediasoup.
 *
 * The host sends ONE copy of each track (camera, mic, screen) to the server; the
 * server forwards it to every viewer. Signaling runs over the app's existing,
 * cookie-authenticated Socket.IO connection:
 *
 *   sfu:join            {streamId}                           → {rtpCapabilities, isHost, producers}
 *   sfu:create-transport{streamId, direction: send|recv}     → transport params
 *   sfu:connect-transport{streamId, transportId, dtlsParameters}
 *   sfu:produce         {streamId, transportId, kind, rtpParameters, appData:{source}} → {id}   (host only)
 *   sfu:pause-producer / sfu:resume-producer / sfu:close-producer {streamId, producerId}      (host only)
 *   sfu:consume         {streamId, transportId, producerId, rtpCapabilities} → consumer params
 *   sfu:resume-consumer {streamId, consumerId}
 *   sfu:set-quality     {streamId, consumerId, quality: auto|medium|low}   (simulcast camera only)
 *   sfu:restart-ice     {streamId, transportId}                  → {iceParameters}
 *   sfu:leave           {streamId}
 *
 * Stage — viewers the host lets in can share their mic and screen with everyone:
 *   stage:state {streamId} → state        stage:request / stage:cancel {streamId}      (viewer)
 *   stage:respond {streamId, userId, approve}   stage:remove {streamId, userId}         (host)
 *   stage:leave {streamId}                                                             (guest)
 * Server → room: stage:guests {streamId, guests, maxGuests}; → host tabs: stage:requests
 * {streamId, requests}; → one user's tabs: stage:status {streamId, status: none|pending|approved, reason?}.
 *
 * Server → room `stream_<id>`: sfu:new-producer, sfu:producer-paused/resumed/closed,
 * sfu:viewers {streamId, count, viewers[]}, sfu:audio-level {streamId, level 0-1, userId (loudest speaker)},
 * sfu:room-closed. Producers carry {userId, role: host|guest, user} so clients can label them.
 * Server → one viewer: sfu:layers {streamId, producerId, spatialLayer} when the SFU switches
 * the simulcast layer it forwards to them.
 */
import * as mediasoup from "mediasoup";
import Stream from "../modules/stream/stream.model.js";
import User from "../modules/auth/user.model.js";
import { sfuConfig } from "./config.js";
import { broadcast } from "../socket/realtime.js";

let worker = null;
let webRtcServer = null;
let io = null;
let onFirstBroadcast = null; // (streamId) => void — used to send "live now" alerts
let onViewersChanged = null; // (streamId, { count, userIds }) => void — analytics + live stats

const rooms = new Map(); // streamId → Room

const SOURCES = new Set(["camera", "mic", "screen", "screen-audio"]);
const GUEST_SOURCES = new Set(["mic", "screen", "screen-audio"]); // guests share their screen and mic
const MAX_STAGE_GUESTS = 3;
const MAX_STAGE_REQUESTS = 50;
const STAGE_REJOIN_GRACE_MS = 20000; // a guest whose connection drops keeps their spot this long
const STAGE_DENY_COOLDOWN_MS = 30000; // after a "no", wait before asking again
const roomName = (streamId) => `stream_${streamId}`;
const MAX_LISTED_VIEWERS = 50;

// Viewer quality choice → highest simulcast layer the SFU may forward (see CAMERA_ENCODINGS
// in client/src/lib/sfu.js: 0 = ¼ resolution, 1 = ½, 2 = full). "auto" lets bandwidth decide.
const QUALITY_LAYERS = { auto: 2, medium: 1, low: 0 };

export const isSfuReady = () => Boolean(worker && webRtcServer);

export async function initSfu(socketServer, { onBroadcastStart, onViewersChange } = {}) {
  io = socketServer;
  onFirstBroadcast = onBroadcastStart || null;
  onViewersChanged = onViewersChange || null;

  worker = await mediasoup.createWorker({ logLevel: "warn" });
  worker.on("died", (error) => {
    console.error("SFU worker died — live video unavailable until restart:", error?.message);
    worker = null;
    webRtcServer = null;
    for (const streamId of rooms.keys()) closeRoom(streamId, "Streaming server restarted");
  });

  webRtcServer = await worker.createWebRtcServer({
    listenInfos: [
      { protocol: "udp", ip: sfuConfig.listenIp, announcedAddress: sfuConfig.announcedIp, port: sfuConfig.port },
      { protocol: "tcp", ip: sfuConfig.listenIp, announcedAddress: sfuConfig.announcedIp, port: sfuConfig.port },
    ],
  });

  console.log(`SFU ready — media on ${sfuConfig.announcedIp}:${sfuConfig.port} (udp/tcp)`);
}

/* ------------------------------------------------------------------ rooms --- */

async function getRoom(streamId, { create = false } = {}) {
  let room = rooms.get(streamId);
  if (room || !create) return room;

  const stream = await Stream.findById(streamId).select("host isLive announcedAt").lean();
  if (!stream) throw new Error("Stream not found");
  if (!stream.isLive) throw new Error("This stream has ended");

  // Another request may have created it while we awaited the DB
  room = rooms.get(streamId);
  if (room) return room;

  const router = await worker.createRouter({ mediaCodecs: sfuConfig.mediaCodecs });
  // "Is the host speaking?" — drives the speaking indicator, even with the camera off
  // −80 dBov over each 400 ms (averaged across packets, pauses included) catches normal speech
  const observer = await router.createAudioLevelObserver({ maxEntries: 1, threshold: -80, interval: 400 });

  // Another request may have finished first while the router was being created
  if (rooms.has(streamId)) {
    router.close();
    return rooms.get(streamId);
  }

  room = {
    streamId,
    hostId: String(stream.host),
    router,
    audioObserver: observer,
    peers: new Map(), // socketId → peer
    producers: new Map(), // producerId → { producer, source, socketId }
    announced: Boolean(stream.announcedAt),
    audioLevel: 0,
    speakerId: null,
    guests: new Map(), // userId → public user, allowed to publish GUEST_SOURCES
    requests: new Map(), // userId → { user, at }
    deniedAt: new Map(), // userId → ms
    guestTimers: new Map(), // userId → grace timer after their last tab left
  };
  rooms.set(streamId, room);

  const emitLevel = (level, userId) => {
    if (level === room.audioLevel && userId === room.speakerId) return;
    room.audioLevel = level;
    room.speakerId = userId;
    io?.to(roomName(streamId)).emit("sfu:audio-level", { streamId, level, userId });
  };
  // Loudest mic (host or guest). dBov −80 (threshold) … −10 → 0.1 … 1, in steps of 0.1 so tiny
  // changes don't flood the room
  observer.on("volumes", ([{ producer, volume }]) =>
    emitLevel(
      Math.max(0.1, Math.round(Math.min(1, (volume + 80) / 70) * 10) / 10),
      room.producers.get(producer.id)?.userId ?? null,
    ),
  );
  observer.on("silence", () => emitLevel(0, null));

  return room;
}

async function getPeer(room, socket) {
  let peer = room.peers.get(socket.id);
  if (!peer) {
    const user = await User.findById(socket.userId).select("username profile.name profile.profileImage").lean();
    peer = room.peers.get(socket.id); // joined twice at once
    if (peer) return peer;
    peer = {
      socket,
      userId: String(socket.userId),
      user: user && {
        _id: String(user._id),
        username: user.username,
        name: user.profile?.name || null,
        profileImage: user.profile?.profileImage || "",
      },
      transports: new Map(),
      consumers: new Map(),
    };
    room.peers.set(socket.id, peer);
    clearTimeout(room.guestTimers.get(peer.userId)); // a guest came back in time
    room.guestTimers.delete(peer.userId);
  }
  return peer;
}

/** Unique signed-in viewers (a player with several tabs counts once; the host doesn't count). */
function viewersOf(room) {
  const byUser = new Map();
  for (const peer of room.peers.values()) {
    if (peer.userId !== room.hostId && !byUser.has(peer.userId)) byUser.set(peer.userId, peer.user);
  }
  return byUser;
}

/** Live viewer count for a stream's SFU room (0 when nobody is connected). */
export const liveViewerCount = (streamId) => {
  const room = rooms.get(String(streamId));
  return room ? viewersOf(room).size : 0;
};

function broadcastViewerCount(room) {
  const viewers = viewersOf(room);
  const count = viewers.size;
  io?.to(roomName(room.streamId)).emit("sfu:viewers", {
    streamId: room.streamId,
    count,
    viewers: [...viewers.values()].filter(Boolean).slice(0, MAX_LISTED_VIEWERS),
  });
  // Live viewer counts on stream cards everywhere
  if (count !== room.lastBroadcastViewers) {
    room.lastBroadcastViewers = count;
    broadcast("stream:viewers", { streamId: room.streamId, count });
  }
  onViewersChanged?.(room.streamId, { count, userIds: [...viewers.keys()] });
}

function producerInfo({ producer, source, userId, role, user }) {
  return { producerId: producer.id, kind: producer.kind, source, paused: producer.paused, userId, role, user };
}

/* ------------------------------------------------------------------ stage --- */

const peersOfUser = (room, userId) => [...room.peers.values()].filter((p) => p.userId === String(userId));
const emitToUser = (room, userId, event, payload) =>
  peersOfUser(room, userId).forEach((p) => p.socket.emit(event, payload));
const canPublish = (room, userId) => String(userId) === room.hostId || room.guests.has(String(userId));

function stageState(room, userId) {
  const uid = String(userId);
  const state = {
    streamId: room.streamId,
    maxGuests: MAX_STAGE_GUESTS,
    guests: [...room.guests.values()],
    status: room.guests.has(uid) ? "approved" : room.requests.has(uid) ? "pending" : "none",
  };
  if (uid === room.hostId) {
    state.requests = [...room.requests.values()].map(({ user, at }) => ({ ...user, requestedAt: at }));
  }
  return state;
}

/** Everyone: who's on stage. The host's tabs: who's waiting. */
function publishStage(room) {
  io?.to(roomName(room.streamId)).emit("stage:guests", {
    streamId: room.streamId,
    guests: [...room.guests.values()],
    maxGuests: MAX_STAGE_GUESTS,
  });
  emitToUser(room, room.hostId, "stage:requests", {
    streamId: room.streamId,
    requests: stageState(room, room.hostId).requests,
  });
}

const setStageStatus = (room, userId, status, reason) =>
  emitToUser(room, userId, "stage:status", { streamId: room.streamId, status, reason });

function closeProducersOf(room, userId) {
  for (const [producerId, entry] of room.producers) {
    if (entry.userId !== String(userId)) continue;
    entry.producer.close();
    room.producers.delete(producerId);
    io?.to(roomName(room.streamId)).emit("sfu:producer-closed", { streamId: room.streamId, producerId });
  }
}

/** Take a guest off the stage: their mic/screen stop for everyone. */
function removeGuest(room, userId, reason) {
  const uid = String(userId);
  clearTimeout(room.guestTimers.get(uid));
  room.guestTimers.delete(uid);
  if (!room.guests.delete(uid)) return false;
  closeProducersOf(room, uid);
  setStageStatus(room, uid, "none", reason);
  publishStage(room);
  return true;
}

function removePeer(room, socketId) {
  const peer = room.peers.get(socketId);
  if (!peer) return;

  // Announce this peer's tracks as gone first — closing a transport synchronously
  // fires "transportclose" on its producers, which removes them from the map.
  for (const [producerId, entry] of room.producers) {
    if (entry.socketId === socketId) {
      room.producers.delete(producerId);
      io?.to(roomName(room.streamId)).emit("sfu:producer-closed", { streamId: room.streamId, producerId });
    }
  }
  for (const transport of [...peer.transports.values()]) transport.close();
  room.peers.delete(socketId);
  broadcastViewerCount(room);

  // Their last tab left: a pending request is withdrawn; a guest keeps the spot for a short grace
  if (!peersOfUser(room, peer.userId).length) {
    if (room.requests.delete(peer.userId)) publishStage(room);
    if (room.guests.has(peer.userId) && !room.guestTimers.has(peer.userId)) {
      room.guestTimers.set(
        peer.userId,
        setTimeout(() => {
          room.guestTimers.delete(peer.userId);
          if (rooms.get(room.streamId) === room && !peersOfUser(room, peer.userId).length) {
            removeGuest(room, peer.userId, "disconnected");
          }
        }, STAGE_REJOIN_GRACE_MS),
      );
    }
  }
}

/** Tear down a stream's media room (called when the host ends the stream). */
export function closeRoom(streamId, reason = "Stream has ended") {
  const id = String(streamId);
  const room = rooms.get(id);
  if (!room) return;
  rooms.delete(id);
  room.guestTimers.forEach(clearTimeout);
  try {
    room.router.close();
  } catch {
    /* worker may already be gone */
  }
  io?.to(roomName(id)).emit("sfu:room-closed", { streamId: id, reason });
}

/* -------------------------------------------------------------- signaling --- */

export function registerSfuHandlers(socket) {
  // Every handler answers through the ack callback: { ...data } or { error }
  const on = (event, handler) =>
    socket.on(event, async (payload = {}, ack) => {
      const reply = typeof ack === "function" ? ack : () => {};
      try {
        if (!isSfuReady()) throw new Error("Live video server is not running");
        reply((await handler(payload)) ?? {});
      } catch (error) {
        reply({ error: error.message || "SFU error" });
      }
    });

  const requireRoom = (streamId) => {
    const room = rooms.get(String(streamId));
    if (!room || !room.peers.has(socket.id)) throw new Error("Join the stream first");
    return room;
  };
  const requireHost = (room, action = "broadcast") => {
    if (String(socket.userId) !== room.hostId) throw new Error(`Only the host can ${action}`);
  };
  const requirePublisher = (room) => {
    if (!canPublish(room, socket.userId)) throw new Error("Only the host and guests on stage can share");
  };

  on("sfu:join", async ({ streamId }) => {
    if (!streamId) throw new Error("streamId required");
    const room = await getRoom(String(streamId), { create: true });
    await getPeer(room, socket);
    socket.join(roomName(room.streamId));
    broadcastViewerCount(room);
    return {
      rtpCapabilities: room.router.rtpCapabilities,
      userId: String(socket.userId),
      isHost: String(socket.userId) === room.hostId,
      producers: [...room.producers.values()].map(producerInfo),
      stage: stageState(room, socket.userId),
    };
  });

  on("sfu:create-transport", async ({ streamId, direction }) => {
    const room = requireRoom(streamId);
    const peer = room.peers.get(socket.id);
    if (direction === "send") requirePublisher(room);
    if (peer.transports.size >= 4) throw new Error("Too many transports");

    const transport = await room.router.createWebRtcTransport({
      webRtcServer,
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      initialAvailableOutgoingBitrate: sfuConfig.initialOutgoingBitrate,
      appData: { direction },
    });
    if (direction === "send") {
      await transport.setMaxIncomingBitrate(sfuConfig.maxIncomingBitrate).catch(() => {});
    }
    transport.on("dtlsstatechange", (state) => state === "closed" && transport.close());
    transport.observer.on("close", () => peer.transports.delete(transport.id)); // frees the slot
    peer.transports.set(transport.id, transport);

    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    };
  });

  on("sfu:connect-transport", async ({ streamId, transportId, dtlsParameters }) => {
    const room = requireRoom(streamId);
    const transport = room.peers.get(socket.id).transports.get(transportId);
    if (!transport) throw new Error("Transport not found");
    await transport.connect({ dtlsParameters });
  });

  on("sfu:produce", async ({ streamId, transportId, kind, rtpParameters, appData = {} }) => {
    const room = requireRoom(streamId);
    requirePublisher(room);
    const uid = String(socket.userId);
    const isHost = uid === room.hostId;
    const source = SOURCES.has(appData.source) ? appData.source : kind === "audio" ? "mic" : "camera";
    if (!isHost && !GUEST_SOURCES.has(source)) throw new Error("Guests can share their mic and screen");
    const peer = room.peers.get(socket.id);
    const transport = peer.transports.get(transportId);
    if (!transport) throw new Error("Transport not found");

    // One producer per person and source: replace the old one (e.g. after a device switch)
    for (const [id, entry] of room.producers) {
      if (entry.source === source && entry.userId === uid) {
        entry.producer.close();
        room.producers.delete(id);
        io.to(roomName(room.streamId)).emit("sfu:producer-closed", { streamId: room.streamId, producerId: id });
      }
    }

    const producer = await transport.produce({ kind, rtpParameters, appData: { source } });
    const entry = { producer, source, socketId: socket.id, userId: uid, role: isHost ? "host" : "guest", user: peer.user };
    room.producers.set(producer.id, entry);
    producer.on("transportclose", () => room.producers.delete(producer.id));
    if (source === "mic") {
      room.audioObserver?.addProducer({ producerId: producer.id }).catch(() => {});
    }

    socket.to(roomName(room.streamId)).emit("sfu:new-producer", { streamId: room.streamId, ...producerInfo(entry) });

    if (isHost && !room.announced) {
      room.announced = true;
      onFirstBroadcast?.(room.streamId);
    }
    return { id: producer.id };
  });

  // Pause / resume: only the track's owner. Close: its owner, or the host (moderation).
  const producerAction = (event, action, { hostMay = false } = {}) =>
    on(event, async ({ streamId, producerId }) => {
      const room = requireRoom(streamId);
      const entry = room.producers.get(producerId);
      if (!entry) throw new Error("Producer not found");
      const uid = String(socket.userId);
      if (entry.userId !== uid && !(hostMay && uid === room.hostId)) throw new Error("That isn't your track");
      await action(room, entry);
    });

  producerAction("sfu:pause-producer", async (room, { producer }) => {
    await producer.pause();
    io.to(roomName(room.streamId)).emit("sfu:producer-paused", { streamId: room.streamId, producerId: producer.id });
  });
  producerAction("sfu:resume-producer", async (room, { producer }) => {
    await producer.resume();
    io.to(roomName(room.streamId)).emit("sfu:producer-resumed", { streamId: room.streamId, producerId: producer.id });
  });
  producerAction(
    "sfu:close-producer",
    async (room, { producer }) => {
      producer.close();
      room.producers.delete(producer.id);
      io.to(roomName(room.streamId)).emit("sfu:producer-closed", { streamId: room.streamId, producerId: producer.id });
    },
    { hostMay: true },
  );

  on("sfu:consume", async ({ streamId, transportId, producerId, rtpCapabilities }) => {
    const room = requireRoom(streamId);
    const peer = room.peers.get(socket.id);
    const transport = peer.transports.get(transportId);
    const entry = room.producers.get(producerId);
    if (!transport) throw new Error("Transport not found");
    if (!entry) throw new Error("That track is no longer live");
    if (!room.router.canConsume({ producerId, rtpCapabilities })) {
      throw new Error("Your browser can't play this stream's format");
    }

    // Start paused; the client resumes once its track is wired up
    const consumer = await transport.consume({ producerId, rtpCapabilities, paused: true });
    peer.consumers.set(consumer.id, consumer);
    const forget = () => peer.consumers.delete(consumer.id);
    consumer.on("transportclose", forget);
    consumer.on("producerclose", () => {
      forget();
      socket.emit("sfu:producer-closed", { streamId: room.streamId, producerId });
    });
    // Tell this viewer which simulcast layer they're actually getting (bandwidth decides)
    consumer.on("layerschange", (layers) => {
      socket.emit("sfu:layers", {
        streamId: room.streamId,
        producerId,
        spatialLayer: layers?.spatialLayer ?? null,
      });
    });
    // When bandwidth is short, keep screen-share detail ahead of the camera
    if (entry.source === "screen") await consumer.setPriority(2).catch(() => {});

    return {
      id: consumer.id,
      producerId,
      kind: consumer.kind,
      type: consumer.type, // "simulcast" for the camera → quality can be chosen
      rtpParameters: consumer.rtpParameters,
      source: entry.source,
      userId: entry.userId,
      role: entry.role,
      user: entry.user,
      producerPaused: consumer.producerPaused,
    };
  });

  on("sfu:resume-consumer", async ({ streamId, consumerId }) => {
    const room = requireRoom(streamId);
    const consumer = room.peers.get(socket.id).consumers.get(consumerId);
    if (!consumer) throw new Error("Consumer not found");
    await consumer.resume();
  });

  // Viewer quality menu: cap the simulcast layer the SFU forwards to this viewer
  on("sfu:set-quality", async ({ streamId, consumerId, quality }) => {
    const room = requireRoom(streamId);
    const consumer = room.peers.get(socket.id).consumers.get(consumerId);
    if (!consumer) throw new Error("Consumer not found");
    if (!Object.hasOwn(QUALITY_LAYERS, quality)) throw new Error("Unknown quality");
    if (consumer.type !== "simulcast") return { quality: "auto" };
    await consumer.setPreferredLayers({ spatialLayer: QUALITY_LAYERS[quality] });
    return { quality };
  });

  // The browser's media path broke (network change, Wi-Fi → 4G): new ICE credentials, same transport
  on("sfu:restart-ice", async ({ streamId, transportId }) => {
    const room = requireRoom(streamId);
    const transport = room.peers.get(socket.id).transports.get(transportId);
    if (!transport) throw new Error("Transport not found");
    return { iceParameters: await transport.restartIce() };
  });

  /* ---------------------------------------------------------------- stage --- */

  on("stage:state", async ({ streamId }) => stageState(requireRoom(streamId), socket.userId));

  on("stage:request", async ({ streamId }) => {
    const room = requireRoom(streamId);
    const uid = String(socket.userId);
    if (uid === room.hostId) throw new Error("You're the host — you're already on stage");
    if (room.guests.has(uid) || room.requests.has(uid)) return stageState(room, uid);
    const wait = (room.deniedAt.get(uid) || 0) + STAGE_DENY_COOLDOWN_MS - Date.now();
    if (wait > 0) throw new Error(`The host said not now — you can ask again in ${Math.ceil(wait / 1000)}s`);
    if (room.guests.size >= MAX_STAGE_GUESTS) throw new Error("The stage is full right now");
    if (room.requests.size >= MAX_STAGE_REQUESTS) throw new Error("Lots of people are waiting — try again later");

    room.requests.set(uid, { user: room.peers.get(socket.id).user, at: Date.now() });
    setStageStatus(room, uid, "pending");
    publishStage(room);
    return stageState(room, uid);
  });

  on("stage:cancel", async ({ streamId }) => {
    const room = requireRoom(streamId);
    const uid = String(socket.userId);
    if (room.requests.delete(uid)) {
      setStageStatus(room, uid, "none", "cancelled");
      publishStage(room);
    }
    return stageState(room, uid);
  });

  on("stage:respond", async ({ streamId, userId, approve }) => {
    const room = requireRoom(streamId);
    requireHost(room, "let people on stage");
    const uid = String(userId);
    const request = room.requests.get(uid);
    if (!request) throw new Error("That request is no longer waiting");
    if (approve && room.guests.size >= MAX_STAGE_GUESTS) {
      throw new Error(`The stage is full (${MAX_STAGE_GUESTS} guests) — remove someone first`);
    }
    room.requests.delete(uid);
    if (approve) {
      room.guests.set(uid, request.user);
      setStageStatus(room, uid, "approved");
    } else {
      room.deniedAt.set(uid, Date.now());
      setStageStatus(room, uid, "none", "denied");
    }
    publishStage(room);
    return stageState(room, socket.userId);
  });

  on("stage:remove", async ({ streamId, userId }) => {
    const room = requireRoom(streamId);
    requireHost(room, "remove guests");
    if (!removeGuest(room, userId, "removed")) throw new Error("They're not on stage");
    return stageState(room, socket.userId);
  });

  on("stage:leave", async ({ streamId }) => {
    const room = requireRoom(streamId);
    removeGuest(room, socket.userId, "left");
    return stageState(room, socket.userId);
  });

  on("sfu:leave", async ({ streamId }) => {
    const room = rooms.get(String(streamId));
    if (room) removePeer(room, socket.id);
  });

  socket.on("disconnect", () => {
    for (const room of rooms.values()) removePeer(room, socket.id);
  });
}
