import { Device } from "mediasoup-client";

/**
 * Browser side of the live-stream SFU (see backend/src/sfu/index.js).
 * Signaling uses the app's shared Socket.IO connection with acknowledgements.
 */

const REQUEST_TIMEOUT = 12000;

// Camera is sent as 3 simulcast layers so each viewer gets the quality their
// connection can handle; the SFU picks the layer per viewer.
const CAMERA_ENCODINGS = [
  { rid: "r0", maxBitrate: 150_000, scaleResolutionDownBy: 4 },
  { rid: "r1", maxBitrate: 500_000, scaleResolutionDownBy: 2 },
  { rid: "r2", maxBitrate: 1_500_000 },
];
const SCREEN_ENCODINGS = [{ maxBitrate: 2_500_000 }];

async function request(socket, event, data) {
  const res = await socket.timeout(REQUEST_TIMEOUT).emitWithAck(event, data);
  if (res?.error) throw new Error(res.error);
  return res;
}

export class SfuSession {
  constructor(socket, streamId, { onTrack, onTrackEnded, onProducerState, onViewers, onClosed } = {}) {
    this.socket = socket;
    this.streamId = String(streamId);
    this.handlers = { onTrack, onTrackEnded, onProducerState, onViewers, onClosed };
    this.device = null;
    this.sendTransport = null;
    this.recvTransport = null;
    this.producers = new Map(); // source → Producer
    this.consumers = new Map(); // producerId → Consumer
    this.closed = false;
    this.listeners = [];
  }

  /** Join the stream's media room. Returns { isHost, producers }. */
  async join() {
    const { rtpCapabilities, isHost, producers } = await request(this.socket, "sfu:join", {
      streamId: this.streamId,
    });
    this.device = await Device.factory();
    await this.device.load({ routerRtpCapabilities: rtpCapabilities });
    this.isHost = isHost;
    this.listen();
    return { isHost, producers };
  }

  listen() {
    const add = (event, fn) => {
      const handler = (payload) => {
        if (String(payload?.streamId) === this.streamId) fn(payload);
      };
      this.socket.on(event, handler);
      this.listeners.push([event, handler]);
    };
    add("sfu:new-producer", (p) => !this.isHost && this.consume(p).catch(() => {}));
    add("sfu:producer-closed", ({ producerId }) => this.dropConsumer(producerId));
    add("sfu:producer-paused", ({ producerId }) => this.handlers.onProducerState?.(producerId, true));
    add("sfu:producer-resumed", ({ producerId }) => this.handlers.onProducerState?.(producerId, false));
    add("sfu:viewers", ({ count }) => this.handlers.onViewers?.(count));
    add("sfu:room-closed", ({ reason }) => this.handlers.onClosed?.(reason));
  }

  wireTransport(transport) {
    transport.on("connect", ({ dtlsParameters }, callback, errback) => {
      request(this.socket, "sfu:connect-transport", {
        streamId: this.streamId,
        transportId: transport.id,
        dtlsParameters,
      })
        .then(() => callback())
        .catch(errback);
    });
    return transport;
  }

  async createTransport(direction) {
    const params = await request(this.socket, "sfu:create-transport", { streamId: this.streamId, direction });
    const transport =
      direction === "send" ? this.device.createSendTransport(params) : this.device.createRecvTransport(params);
    return this.wireTransport(transport);
  }

  /* ------------------------------------------------------------ viewer --- */

  async consume({ producerId, source }) {
    if (this.closed || this.consumers.has(producerId)) return;
    if (!this.recvTransport) this.recvTransport = await this.createTransport("recv");

    const data = await request(this.socket, "sfu:consume", {
      streamId: this.streamId,
      transportId: this.recvTransport.id,
      producerId,
      rtpCapabilities: this.device.recvRtpCapabilities,
    });
    const consumer = await this.recvTransport.consume({
      id: data.id,
      producerId: data.producerId,
      kind: data.kind,
      rtpParameters: data.rtpParameters,
    });
    this.consumers.set(producerId, consumer);
    this.handlers.onTrack?.({
      producerId,
      kind: consumer.kind,
      source: data.source || source,
      track: consumer.track,
      paused: data.producerPaused,
    });
    await request(this.socket, "sfu:resume-consumer", { streamId: this.streamId, consumerId: consumer.id });
  }

  async consumeAll(producers) {
    for (const p of producers) await this.consume(p).catch((e) => console.warn("consume failed:", e.message));
  }

  dropConsumer(producerId) {
    const consumer = this.consumers.get(producerId);
    if (!consumer) return;
    consumer.close();
    this.consumers.delete(producerId);
    this.handlers.onTrackEnded?.(producerId);
  }

  /* -------------------------------------------------------------- host --- */

  async publish(track, source) {
    if (!this.sendTransport) {
      this.sendTransport = await this.createTransport("send");
      this.sendTransport.on("produce", ({ kind, rtpParameters, appData }, callback, errback) => {
        request(this.socket, "sfu:produce", {
          streamId: this.streamId,
          transportId: this.sendTransport.id,
          kind,
          rtpParameters,
          appData,
        })
          .then(({ id }) => callback({ id }))
          .catch(errback);
      });
    }

    const existing = this.producers.get(source);
    if (existing && !existing.closed) {
      await existing.replaceTrack({ track });
      return existing;
    }

    const options = { track, appData: { source } };
    if (track.kind === "video") options.encodings = source === "screen" ? SCREEN_ENCODINGS : CAMERA_ENCODINGS;
    if (track.kind === "audio") options.codecOptions = { opusStereo: false, opusDtx: true, opusFec: true };

    const producer = await this.sendTransport.produce(options);
    this.producers.set(source, producer);
    return producer;
  }

  async setPaused(source, paused) {
    const producer = this.producers.get(source);
    if (!producer || producer.closed) return;
    if (paused) producer.pause();
    else producer.resume();
    await request(this.socket, paused ? "sfu:pause-producer" : "sfu:resume-producer", {
      streamId: this.streamId,
      producerId: producer.id,
    });
  }

  async unpublish(source) {
    const producer = this.producers.get(source);
    if (!producer) return;
    this.producers.delete(source);
    producer.close();
    await request(this.socket, "sfu:close-producer", { streamId: this.streamId, producerId: producer.id }).catch(
      () => {},
    );
  }

  /* ------------------------------------------------------------ common --- */

  close() {
    if (this.closed) return;
    this.closed = true;
    for (const [event, handler] of this.listeners) this.socket.off(event, handler);
    this.listeners = [];
    this.consumers.forEach((c) => c.close());
    this.producers.forEach((p) => p.close());
    this.sendTransport?.close();
    this.recvTransport?.close();
    if (this.socket.connected) this.socket.emit("sfu:leave", { streamId: this.streamId }, () => {});
  }
}

export const mediaDevicesSupported = () =>
  typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && window.isSecureContext;

export const screenShareSupported = () =>
  typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getDisplayMedia);
