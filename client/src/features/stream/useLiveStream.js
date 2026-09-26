import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSocket } from "../../context/SocketContext";
import { SfuSession } from "../../lib/sfu";

const CAMERA_CONSTRAINTS = { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } };
const MIC_CONSTRAINTS = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };

const describeMediaError = (error) => {
  switch (error?.name) {
    case "NotAllowedError":
      return "Camera/mic permission was denied. Allow access in the browser's site settings and try again.";
    case "NotFoundError":
      return "No camera or microphone was found on this device.";
    case "NotReadableError":
      return "Your camera or mic is being used by another app. Close it and try again.";
    case "OverconstrainedError":
      return "That camera can't provide the requested quality.";
    default:
      return error?.message || "Couldn't start your camera or mic.";
  }
};

/* =============================================================== host ==== */

/**
 * Broadcast camera, mic and screen to the stream's SFU room.
 * Tracks are kept locally and re-published automatically after a reconnect.
 */
export function useStreamBroadcast(streamId, { enabled = true } = {}) {
  const { socket, isConnected } = useSocket();
  const sessionRef = useRef(null);
  const readyRef = useRef(null);
  const tracksRef = useRef({}); // source → MediaStreamTrack
  const stateRef = useRef({ camOn: true, micOn: true });

  const [status, setStatus] = useState("idle"); // idle | starting | live | error
  const [error, setError] = useState(null);
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [screenOn, setScreenOn] = useState(false);
  const [viewers, setViewers] = useState(0);
  const [preview, setPreview] = useState({ camera: null, screen: null });
  const [devices, setDevices] = useState({ cameras: [], mics: [], cameraId: "", micId: "" });
  const [linkUp, setLinkUp] = useState(false);

  const refreshPreview = useCallback(() => {
    const t = tracksRef.current;
    setPreview({
      camera: t.camera && t.camera.readyState === "live" ? new MediaStream([t.camera]) : null,
      screen: t.screen && t.screen.readyState === "live" ? new MediaStream([t.screen]) : null,
    });
  }, []);

  const loadDevices = useCallback(async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      setDevices((d) => ({
        ...d,
        cameras: list.filter((x) => x.kind === "videoinput"),
        mics: list.filter((x) => x.kind === "audioinput"),
        cameraId: d.cameraId || tracksRef.current.camera?.getSettings().deviceId || "",
        micId: d.micId || tracksRef.current.mic?.getSettings().deviceId || "",
      }));
    } catch {
      /* enumerateDevices unavailable */
    }
  }, []);

  // Publish whatever local tracks exist (used on start and after reconnects)
  const publishAll = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return;
    await readyRef.current;
    const t = tracksRef.current;
    for (const source of ["camera", "mic", "screen", "screen-audio"]) {
      const track = t[source];
      if (!track || track.readyState !== "live") continue;
      await session.publish(track, source);
    }
    if (!stateRef.current.micOn) await session.setPaused("mic", true);
    if (!stateRef.current.camOn) await session.setPaused("camera", true);
  }, []);

  // Media room session follows the socket connection
  useEffect(() => {
    if (!enabled || !socket || !isConnected || !streamId) return undefined;
    const session = new SfuSession(socket, streamId, {
      onViewers: setViewers,
      onClosed: () => setStatus("idle"),
    });
    sessionRef.current = session;
    readyRef.current = session.join().then(
      () => setLinkUp(true),
      (e) => {
        setError(e.message);
        setStatus("error");
      },
    );
    // After a reconnect, put the live tracks back on air
    if (Object.keys(tracksRef.current).length) {
      publishAll().catch((e) => setError(e.message));
    }
    return () => {
      setLinkUp(false);
      session.close();
      if (sessionRef.current === session) sessionRef.current = null;
    };
  }, [enabled, socket, isConnected, streamId, publishAll]);

  const start = useCallback(async () => {
    setError(null);
    setStatus("starting");
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: CAMERA_CONSTRAINTS,
        audio: MIC_CONSTRAINTS,
      });
      tracksRef.current.camera = media.getVideoTracks()[0];
      tracksRef.current.mic = media.getAudioTracks()[0];
      stateRef.current = { camOn: true, micOn: true };
      setCamOn(true);
      setMicOn(true);
      refreshPreview();
      loadDevices();
      await publishAll();
      setStatus("live");
    } catch (e) {
      setStatus("error");
      setError(e.name ? describeMediaError(e) : e.message);
    }
  }, [publishAll, refreshPreview, loadDevices]);

  const toggleMic = useCallback(async () => {
    const next = !stateRef.current.micOn;
    stateRef.current.micOn = next;
    setMicOn(next);
    const track = tracksRef.current.mic;
    if (track) track.enabled = next;
    await sessionRef.current?.setPaused("mic", !next).catch((e) => setError(e.message));
  }, []);

  // Turning the camera off releases it (camera light goes off); on → fresh track
  const toggleCamera = useCallback(async () => {
    const next = !stateRef.current.camOn;
    try {
      if (!next) {
        stateRef.current.camOn = false;
        setCamOn(false);
        await sessionRef.current?.setPaused("camera", true);
        tracksRef.current.camera?.stop();
      } else {
        const media = await navigator.mediaDevices.getUserMedia({
          video: { ...CAMERA_CONSTRAINTS, ...(devices.cameraId ? { deviceId: { exact: devices.cameraId } } : {}) },
        });
        tracksRef.current.camera = media.getVideoTracks()[0];
        stateRef.current.camOn = true;
        setCamOn(true);
        await sessionRef.current?.publish(tracksRef.current.camera, "camera");
        await sessionRef.current?.setPaused("camera", false);
      }
      refreshPreview();
    } catch (e) {
      setError(e.name ? describeMediaError(e) : e.message);
    }
  }, [devices.cameraId, refreshPreview]);

  const stopScreen = useCallback(async () => {
    const t = tracksRef.current;
    t.screen?.stop();
    t["screen-audio"]?.stop();
    delete t.screen;
    delete t["screen-audio"];
    setScreenOn(false);
    refreshPreview();
    await sessionRef.current?.unpublish("screen");
    await sessionRef.current?.unpublish("screen-audio");
  }, [refreshPreview]);

  const toggleScreen = useCallback(async () => {
    if (tracksRef.current.screen) return stopScreen();
    try {
      const media = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true });
      const video = media.getVideoTracks()[0];
      const audio = media.getAudioTracks()[0];
      video.contentHint = "detail";
      video.addEventListener("ended", () => stopScreen()); // browser "Stop sharing" button
      tracksRef.current.screen = video;
      if (audio) tracksRef.current["screen-audio"] = audio;
      setScreenOn(true);
      refreshPreview();
      await sessionRef.current?.publish(video, "screen");
      if (audio) await sessionRef.current?.publish(audio, "screen-audio");
    } catch (e) {
      if (e?.name !== "NotAllowedError") setError(e.message || "Screen sharing failed");
    }
  }, [stopScreen, refreshPreview]);

  const switchDevice = useCallback(
    async (kind, deviceId) => {
      try {
        if (kind === "camera") {
          const media = await navigator.mediaDevices.getUserMedia({
            video: { ...CAMERA_CONSTRAINTS, deviceId: { exact: deviceId } },
          });
          tracksRef.current.camera?.stop();
          tracksRef.current.camera = media.getVideoTracks()[0];
          setDevices((d) => ({ ...d, cameraId: deviceId }));
          if (stateRef.current.camOn) await sessionRef.current?.publish(tracksRef.current.camera, "camera");
        } else {
          const media = await navigator.mediaDevices.getUserMedia({
            audio: { ...MIC_CONSTRAINTS, deviceId: { exact: deviceId } },
          });
          tracksRef.current.mic?.stop();
          tracksRef.current.mic = media.getAudioTracks()[0];
          tracksRef.current.mic.enabled = stateRef.current.micOn;
          setDevices((d) => ({ ...d, micId: deviceId }));
          await sessionRef.current?.publish(tracksRef.current.mic, "mic");
        }
        refreshPreview();
      } catch (e) {
        setError(e.name ? describeMediaError(e) : e.message);
      }
    },
    [refreshPreview],
  );

  const stopAll = useCallback(() => {
    Object.values(tracksRef.current).forEach((t) => t?.stop());
    tracksRef.current = {};
    setScreenOn(false);
    setPreview({ camera: null, screen: null });
    setStatus("idle");
  }, []);

  // Release camera/mic when leaving the page
  useEffect(() => () => Object.values(tracksRef.current).forEach((t) => t?.stop()), []);

  return {
    status,
    error,
    clearError: () => setError(null),
    linkUp,
    camOn,
    micOn,
    screenOn,
    viewers,
    preview,
    devices,
    start,
    toggleMic,
    toggleCamera,
    toggleScreen,
    switchDevice,
    stopAll,
  };
}

/* ============================================================= viewer ==== */

/** Receive the host's tracks from the SFU. */
export function useStreamWatch(streamId, { enabled = true, retryKey = 0 } = {}) {
  const { socket, isConnected } = useSocket();
  const [tracks, setTracks] = useState({}); // producerId → { source, kind, track, paused }
  const [status, setStatus] = useState("connecting"); // connecting | waiting | live | ended | error
  const [error, setError] = useState(null);
  const [viewers, setViewers] = useState(null);

  useEffect(() => {
    if (!enabled || !streamId) return undefined;
    if (!socket || !isConnected) {
      setStatus("connecting");
      return undefined;
    }

    setTracks({});
    setStatus("connecting");
    setError(null);
    const session = new SfuSession(socket, streamId, {
      onTrack: (t) => {
        setTracks((prev) => ({ ...prev, [t.producerId]: t }));
        setStatus("live");
      },
      onTrackEnded: (producerId) =>
        setTracks((prev) => {
          const next = { ...prev };
          delete next[producerId];
          return next;
        }),
      onProducerState: (producerId, paused) =>
        setTracks((prev) => (prev[producerId] ? { ...prev, [producerId]: { ...prev[producerId], paused } } : prev)),
      onViewers: setViewers,
      onClosed: () => {
        setTracks({});
        setStatus("ended");
      },
    });

    session
      .join()
      .then(({ producers }) => {
        if (!producers.length) setStatus("waiting");
        return session.consumeAll(producers);
      })
      .catch((e) => {
        setError(e.message);
        setStatus(/ended/i.test(e.message) ? "ended" : "error");
      });

    return () => session.close();
  }, [enabled, socket, isConnected, streamId, retryKey]);

  // Back to "waiting" when the host has no tracks on air
  useEffect(() => {
    if (status === "live" && Object.keys(tracks).length === 0) setStatus("waiting");
  }, [tracks, status]);

  const bySource = useMemo(() => {
    const out = {};
    for (const t of Object.values(tracks)) out[t.source] = t;
    return out;
  }, [tracks]);

  return { status, error, viewers, bySource };
}
