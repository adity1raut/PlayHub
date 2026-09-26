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
 *   sfu:leave           {streamId}
 *
 * Server → room `stream_<id>`: sfu:new-producer, sfu:producer-paused/resumed/closed,
 * sfu:viewers {streamId, count}, sfu:room-closed.
 */
import * as mediasoup from "mediasoup";
import Stream from "../modules/stream/stream.model.js";
import { sfuConfig } from "./config.js";
import { broadcast } from "../socket/realtime.js";

let worker = null;
let webRtcServer = null;
let io = null;
let onFirstBroadcast = null; // (streamId) => void — used to send "live now" alerts

const rooms = new Map(); // streamId → Room

const SOURCES = new Set(["camera", "mic", "screen", "screen-audio"]);
const roomName = (streamId) => `stream_${streamId}`;

export const isSfuReady = () => Boolean(worker && webRtcServer);

export async function initSfu(socketServer, { onBroadcastStart } = {}) {
  io = socketServer;
  onFirstBroadcast = onBroadcastStart || null;

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
  room = {
    streamId,
    hostId: String(stream.host),
    router,
    peers: new Map(), // socketId → peer
    producers: new Map(), // producerId → { producer, source, socketId }
    announced: Boolean(stream.announcedAt),
  };
  rooms.set(streamId, room);
  return room;
}

function getPeer(room, socket) {
  let peer = room.peers.get(socket.id);
  if (!peer) {
    peer = { socket, userId: String(socket.userId), transports: new Map(), consumers: new Map() };
    room.peers.set(socket.id, peer);
  }
  return peer;
}

function broadcastViewerCount(room) {
  const viewers = [...room.peers.values()].filter((p) => p.userId !== room.hostId).length;
  io?.to(roomName(room.streamId)).emit("sfu:viewers", { streamId: room.streamId, count: viewers });
  // Live viewer counts on stream cards everywhere
  if (viewers !== room.lastBroadcastViewers) {
    room.lastBroadcastViewers = viewers;
    broadcast("stream:viewers", { streamId: room.streamId, count: viewers });
  }
}

function producerInfo({ producer, source }) {
  return { producerId: producer.id, kind: producer.kind, source, paused: producer.paused };
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
  for (const transport of peer.transports.values()) transport.close();
  room.peers.delete(socketId);
  broadcastViewerCount(room);
}

/** Tear down a stream's media room (called when the host ends the stream). */
export function closeRoom(streamId, reason = "Stream has ended") {
  const id = String(streamId);
  const room = rooms.get(id);
  if (!room) return;
  rooms.delete(id);
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
  const requireHost = (room) => {
    if (String(socket.userId) !== room.hostId) throw new Error("Only the host can broadcast");
  };

  on("sfu:join", async ({ streamId }) => {
    if (!streamId) throw new Error("streamId required");
    const room = await getRoom(String(streamId), { create: true });
    getPeer(room, socket);
    socket.join(roomName(room.streamId));
    broadcastViewerCount(room);
    return {
      rtpCapabilities: room.router.rtpCapabilities,
      isHost: String(socket.userId) === room.hostId,
      producers: [...room.producers.values()].map(producerInfo),
    };
  });

  on("sfu:create-transport", async ({ streamId, direction }) => {
    const room = requireRoom(streamId);
    const peer = room.peers.get(socket.id);
    if (direction === "send") requireHost(room);
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
    requireHost(room);
    const source = SOURCES.has(appData.source) ? appData.source : kind === "audio" ? "mic" : "camera";
    const transport = room.peers.get(socket.id).transports.get(transportId);
    if (!transport) throw new Error("Transport not found");

    // One producer per source: replace the old one (e.g. after a device switch)
    for (const [id, entry] of room.producers) {
      if (entry.source === source) {
        entry.producer.close();
        room.producers.delete(id);
        io.to(roomName(room.streamId)).emit("sfu:producer-closed", { streamId: room.streamId, producerId: id });
      }
    }

    const producer = await transport.produce({ kind, rtpParameters, appData: { source } });
    const entry = { producer, source, socketId: socket.id };
    room.producers.set(producer.id, entry);
    producer.on("transportclose", () => room.producers.delete(producer.id));

    socket.to(roomName(room.streamId)).emit("sfu:new-producer", { streamId: room.streamId, ...producerInfo(entry) });

    if (!room.announced) {
      room.announced = true;
      onFirstBroadcast?.(room.streamId);
    }
    return { id: producer.id };
  });

  const hostProducerAction = (event, action) =>
    on(event, async ({ streamId, producerId }) => {
      const room = requireRoom(streamId);
      requireHost(room);
      const entry = room.producers.get(producerId);
      if (!entry) throw new Error("Producer not found");
      await action(room, entry);
    });

  hostProducerAction("sfu:pause-producer", async (room, { producer }) => {
    await producer.pause();
    io.to(roomName(room.streamId)).emit("sfu:producer-paused", { streamId: room.streamId, producerId: producer.id });
  });
  hostProducerAction("sfu:resume-producer", async (room, { producer }) => {
    await producer.resume();
    io.to(roomName(room.streamId)).emit("sfu:producer-resumed", { streamId: room.streamId, producerId: producer.id });
  });
  hostProducerAction("sfu:close-producer", async (room, { producer }) => {
    producer.close();
    room.producers.delete(producer.id);
    io.to(roomName(room.streamId)).emit("sfu:producer-closed", { streamId: room.streamId, producerId: producer.id });
  });

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

    return {
      id: consumer.id,
      producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
      source: entry.source,
      producerPaused: consumer.producerPaused,
    };
  });

  on("sfu:resume-consumer", async ({ streamId, consumerId }) => {
    const room = requireRoom(streamId);
    const consumer = room.peers.get(socket.id).consumers.get(consumerId);
    if (!consumer) throw new Error("Consumer not found");
    await consumer.resume();
  });

  on("sfu:leave", async ({ streamId }) => {
    const room = rooms.get(String(streamId));
    if (room) removePeer(room, socket.id);
  });

  socket.on("disconnect", () => {
    for (const room of rooms.values()) removePeer(room, socket.id);
  });
}
