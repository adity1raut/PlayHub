import { useEffect, useRef, useState } from "react";

/**
 * Turn WebRTC stats (RTCStatsReport from an SFU transport) into numbers people understand.
 * Bitrates come from the byte counters' change between two samples.
 */

const codecName = (report, codecId) => report.get?.(codecId)?.mimeType?.split("/")[1] ?? null;

function snapshot(report) {
  const snap = { at: performance.now(), videoIn: [], audioIn: null, videoOut: [], rtt: null, remoteLoss: null };
  report.forEach((s) => {
    // mediasoup's bandwidth-probing stream (mid "probator") carries only padding — not a track
    if (s.type === "inbound-rtp" && s.mid === "probator") return;
    if (s.type === "inbound-rtp" && s.kind === "video") {
      snap.videoIn.push({
        id: s.id,
        width: s.frameWidth,
        height: s.frameHeight,
        fps: s.framesPerSecond,
        bytes: s.bytesReceived || 0,
        lost: s.packetsLost || 0,
        received: s.packetsReceived || 0,
        jitter: s.jitter,
        codec: codecName(report, s.codecId),
      });
    } else if (s.type === "inbound-rtp" && s.kind === "audio") {
      snap.audioIn = { bytes: s.bytesReceived || 0, lost: s.packetsLost || 0, received: s.packetsReceived || 0 };
    } else if (s.type === "outbound-rtp" && s.kind === "video") {
      snap.videoOut.push({
        id: s.id,
        rid: s.rid,
        width: s.frameWidth,
        height: s.frameHeight,
        fps: s.framesPerSecond,
        bytes: s.bytesSent || 0,
        limitation: s.qualityLimitationReason,
        codec: codecName(report, s.codecId),
      });
    } else if (s.type === "outbound-rtp" && s.kind === "audio") {
      snap.audioOut = { bytes: s.bytesSent || 0 };
    } else if (s.type === "remote-inbound-rtp" && typeof s.fractionLost === "number") {
      snap.remoteLoss = Math.max(snap.remoteLoss ?? 0, s.fractionLost);
    } else if (s.type === "candidate-pair" && (s.nominated || s.selected) && s.state === "succeeded") {
      if (typeof s.currentRoundTripTime === "number") snap.rtt = s.currentRoundTripTime;
    }
  });
  return snap;
}

const kbps = (bytes, prevBytes, ms) => (ms > 0 && bytes >= prevBytes ? Math.round(((bytes - prevBytes) * 8) / ms) : 0);

/** Good / fair / poor from loss and round-trip time. */
function rate({ lossPct = 0, rttMs = 0, limited = false }) {
  if (lossPct >= 8 || rttMs >= 600) return "poor";
  if (lossPct >= 2 || rttMs >= 250 || limited) return "fair";
  return "good";
}

function describe(snap, prev) {
  const ms = prev ? snap.at - prev.at : 0;
  const before = (list, id) => prev?.[list]?.find((x) => x.id === id);

  // Viewer side
  const videoIn = snap.videoIn.map((v) => {
    const p = before("videoIn", v.id);
    return { ...v, kbps: kbps(v.bytes, p?.bytes ?? v.bytes, ms) };
  });
  const lost = videoIn.reduce((n, v) => n + v.lost, 0) + (snap.audioIn?.lost || 0);
  const received = videoIn.reduce((n, v) => n + v.received, 0) + (snap.audioIn?.received || 0);
  const prevLost = (prev?.videoIn || []).reduce((n, v) => n + v.lost, 0) + (prev?.audioIn?.lost || 0);
  const prevReceived = (prev?.videoIn || []).reduce((n, v) => n + v.received, 0) + (prev?.audioIn?.received || 0);
  const dLost = Math.max(0, lost - prevLost);
  const dTotal = Math.max(0, received - prevReceived) + dLost;
  const lossPct = prev && dTotal > 0 ? (dLost / dTotal) * 100 : 0;
  const audioInKbps = snap.audioIn ? kbps(snap.audioIn.bytes, prev?.audioIn?.bytes ?? snap.audioIn.bytes, ms) : 0;

  // Host side (one row per simulcast layer)
  const videoOut = snap.videoOut
    .map((v) => {
      const p = before("videoOut", v.id);
      return { ...v, kbps: kbps(v.bytes, p?.bytes ?? v.bytes, ms) };
    })
    .sort((a, b) => (a.height || 0) - (b.height || 0));
  const audioOutKbps = snap.audioOut ? kbps(snap.audioOut.bytes, prev?.audioOut?.bytes ?? snap.audioOut.bytes, ms) : 0;
  const limitation = videoOut.map((v) => v.limitation).find((l) => l && l !== "none") || "none";

  const rttMs = snap.rtt != null ? Math.round(snap.rtt * 1000) : null;
  const upLossPct = snap.remoteLoss != null ? snap.remoteLoss * 100 : 0;
  const jitterMs = videoIn[0]?.jitter != null ? Math.round(videoIn[0].jitter * 1000) : null;

  return {
    ready: Boolean(prev),
    rttMs,
    // viewer
    videoIn,
    downKbps: videoIn.reduce((n, v) => n + v.kbps, 0) + audioInKbps,
    lossPct,
    jitterMs,
    // host
    videoOut,
    upKbps: videoOut.reduce((n, v) => n + v.kbps, 0) + audioOutKbps,
    upLossPct,
    limitation,
    quality: rate({
      lossPct: Math.max(lossPct, upLossPct),
      rttMs: rttMs ?? 0,
      limited: limitation === "bandwidth",
    }),
  };
}

/**
 * Sample `getReport()` (→ Promise<RTCStatsReport|null>) every `interval` ms while `enabled`.
 * Returns the latest described stats, or null until two samples exist.
 */
export function useRtcStats(getReport, { enabled = true, interval = 1000 } = {}) {
  const [stats, setStats] = useState(null);
  const prevRef = useRef(null);
  const getRef = useRef(getReport);
  getRef.current = getReport;

  useEffect(() => {
    if (!enabled) {
      prevRef.current = null;
      setStats(null);
      return undefined;
    }
    let stopped = false;
    const sample = async () => {
      try {
        const report = await getRef.current?.();
        if (stopped || !report) return;
        const snap = snapshot(report);
        const described = describe(snap, prevRef.current);
        prevRef.current = snap;
        if (described.ready) setStats(described);
      } catch {
        /* transport closed between samples */
      }
    };
    sample();
    const timer = setInterval(sample, interval);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [enabled, interval]);

  return stats;
}

/** Why the browser is sending less than it could (RTCOutboundRtpStreamStats.qualityLimitationReason). */
export const LIMITATION_LABELS = {
  none: "None",
  bandwidth: "Upload bandwidth",
  cpu: "CPU",
  other: "Other",
};

export const formatKbps = (value) =>
  value >= 1000 ? `${(value / 1000).toFixed(1)} Mbps` : `${Math.round(value || 0)} kbps`;
