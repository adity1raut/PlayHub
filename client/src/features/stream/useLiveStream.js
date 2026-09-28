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

/** onTrack / onTrackEnded / onProducerState handlers that keep a producerId → track map in state. */
const trackHandlers = (setTracks, onFirstTrack) => ({
  onTrack: (t) => {
    setTracks((prev) => ({ ...prev, [t.producerId]: t }));
    onFirstTrack?.();
  },
  onTrackEnded: (producerId) =>
    setTracks((prev) => {
      if (!prev[producerId]) return prev;
      const next = { ...prev };
      delete next[producerId];
      return next;
    }),
  onProducerState: (producerId, paused) =>
    setTracks((prev) => (prev[producerId] ? { ...prev, [producerId]: { ...prev[producerId], paused } } : prev)),
});

/** Guests' tracks grouped per person: userId → { user, mic, screen, "screen-audio" } */
export function groupGuests(tracks) {
  const guests = {};
  for (const t of Object.values(tracks)) {
    if (t.role !== "guest" || !t.userId) continue;
    const g = (guests[t.userId] ||= { userId: t.userId, user: t.user });
    g[t.source] = t;
  }
  return guests;
}

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
  const [viewerList, setViewerList] = useState([]);
  const [audioLevel, setAudioLevel] = useState(0);
  const [speakerId, setSpeakerId] = useState(null); // loudest mic right now (host or a guest)
  const [selfId, setSelfId] = useState(null);
  const [remoteTracks, setRemoteTracks] = useState({}); // guests on stage: producerId → track
  const [stage, setStage] = useState(null); // stage state from the last join (useStage keeps it live)
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
    setRemoteTracks({});
    const session = new SfuSession(socket, streamId, {
      ...trackHandlers(setRemoteTracks),
      onViewers: (count, list) => {
        setViewers(count);
        setViewerList(list);
      },
      onAudioLevel: (level, userId) => {
        setAudioLevel(level);
        setSpeakerId(userId);
      },
      onClosed: () => setStatus("idle"),
    });
    sessionRef.current = session;
    readyRef.current = session.join().then(
      ({ producers, stage: joinedStage, userId }) => {
        setSelfId(userId);
        setStage(joinedStage);
        setLinkUp(true);
        session.consumeAll(producers); // guests already sharing
      },
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

  // Upload stats for the host's stats overlay (see lib/rtcStats.js)
  const getStats = useCallback(() => sessionRef.current?.getStats("send") ?? Promise.resolve(null), []);

  return {
    status,
    error,
    clearError: () => setError(null),
    linkUp,
    camOn,
    micOn,
    screenOn,
    viewers,
    viewerList,
    audioLevel,
    speakerId,
    selfId,
    remoteTracks,
    stage,
    getStats,
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
  const [viewerList, setViewerList] = useState([]);
  const [audioLevel, setAudioLevel] = useState(0);
  const [layers, setLayers] = useState({}); // producerId → simulcast layer being received
  const [mediaState, setMediaState] = useState("new"); // receive transport: connected | disconnected | failed…
  const [speakerId, setSpeakerId] = useState(null);
  const [selfId, setSelfId] = useState(null);
  const [stage, setStage] = useState(null); // stage state from the last join (useStage keeps it live)
  const [sessionGen, setSessionGen] = useState(0); // +1 per joined session (guests re-publish on change)
  const sessionRef = useRef(null);

  useEffect(() => {
    if (!enabled || !streamId) return undefined;
    if (!socket || !isConnected) {
      setStatus("connecting");
      return undefined;
    }

    setTracks({});
    setLayers({});
    setStatus("connecting");
    setError(null);
    const session = new SfuSession(socket, streamId, {
      ...trackHandlers(setTracks, () => setStatus("live")),
      onViewers: (count, list) => {
        setViewers(count);
        setViewerList(list);
      },
      onAudioLevel: (level, userId) => {
        setAudioLevel(level);
        setSpeakerId(userId);
      },
      onLayers: (producerId, layer) => setLayers((prev) => ({ ...prev, [producerId]: layer })),
      onConnectionState: (direction, state) => direction === "recv" && setMediaState(state),
      onClosed: () => {
        setTracks({});
        setStatus("ended");
      },
    });
    sessionRef.current = session;

    session
      .join()
      .then(({ producers, stage: joinedStage, userId }) => {
        setSelfId(userId);
        setStage(joinedStage);
        setSessionGen((n) => n + 1);
        if (!producers.length) setStatus("waiting");
        return session.consumeAll(producers);
      })
      .catch((e) => {
        setError(e.message);
        setStatus(/ended/i.test(e.message) ? "ended" : "error");
      });

    return () => {
      session.close();
      if (sessionRef.current === session) sessionRef.current = null;
    };
  }, [enabled, socket, isConnected, streamId, retryKey]);

  const setQuality = useCallback(
    (producerId, quality) => sessionRef.current?.setQuality(producerId, quality) ?? Promise.resolve(),
    [],
  );
  const getStats = useCallback(() => sessionRef.current?.getStats("recv") ?? Promise.resolve(null), []);

  // Guests on stage publish through this same session
  const publish = useCallback(async (track, source) => {
    const session = sessionRef.current;
    if (!session) throw new Error("Not connected to the stream yet");
    return session.publish(track, source);
  }, []);
  const unpublish = useCallback((source) => sessionRef.current?.unpublish(source) ?? Promise.resolve(), []);

  // Back to "waiting" when the host has no tracks on air
  useEffect(() => {
    if (status === "live" && Object.keys(tracks).length === 0) setStatus("waiting");
  }, [tracks, status]);

  // The host's tracks by source; guests' tracks grouped per person
  const bySource = useMemo(() => {
    const out = {};
    for (const t of Object.values(tracks)) if (t.role !== "guest") out[t.source] = t;
    return out;
  }, [tracks]);
  const guests = useMemo(() => groupGuests(tracks), [tracks]);

  return {
    status,
    error,
    viewers,
    viewerList,
    audioLevel,
    speakerId,
    selfId,
    stage,
    sessionGen,
    layers,
    mediaState,
    bySource,
    guests,
    setQuality,
    getStats,
    publish,
    unpublish,
  };
}

/* ============================================================== guest ==== */

/**
 * A guest's own mic and screen while they're on stage. Each is turned on by a click, so the browser
 * asks for permission at that moment. Off stage → everything is released. After a reconnect (new
 * `sessionGen`) the tracks still live are published again.
 */
export function useGuestMedia({ publish, unpublish, sessionGen }, { onStage }) {
  const tracksRef = useRef({}); // source → MediaStreamTrack
  const [micOn, setMicOn] = useState(false);
  const [screenOn, setScreenOn] = useState(false);
  const [screenPreview, setScreenPreview] = useState(null); // MediaStream of our own screen
  const [busy, setBusy] = useState(null); // "mic" | "screen"
  const [error, setError] = useState(null);

  const release = useCallback(
    async (source) => {
      const track = tracksRef.current[source];
      if (!track) return;
      track.stop();
      delete tracksRef.current[source];
      await unpublish(source).catch(() => {});
    },
    [unpublish],
  );

  const stopMic = useCallback(async () => {
    setMicOn(false);
    await release("mic");
  }, [release]);

  const stopScreen = useCallback(async () => {
    setScreenOn(false);
    setScreenPreview(null);
    await release("screen");
    await release("screen-audio");
  }, [release]);

  const toggleMic = useCallback(async () => {
    if (tracksRef.current.mic) return stopMic();
    setBusy("mic");
    setError(null);
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: MIC_CONSTRAINTS });
      const track = media.getAudioTracks()[0];
      tracksRef.current.mic = track;
      setMicOn(true);
      await publish(track, "mic");
    } catch (e) {
      await stopMic();
      setError(e.name ? describeMediaError(e) : e.message);
    } finally {
      setBusy(null);
    }
  }, [publish, stopMic]);

  const toggleScreen = useCallback(async () => {
    if (tracksRef.current.screen) return stopScreen();
    setBusy("screen");
    setError(null);
    try {
      const media = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true });
      const video = media.getVideoTracks()[0];
      const audio = media.getAudioTracks()[0];
      video.contentHint = "detail";
      video.addEventListener("ended", () => stopScreen()); // browser "Stop sharing" button
      tracksRef.current.screen = video;
      if (audio) tracksRef.current["screen-audio"] = audio;
      setScreenOn(true);
      setScreenPreview(new MediaStream([video]));
      await publish(video, "screen");
      if (audio) await publish(audio, "screen-audio");
    } catch (e) {
      await stopScreen();
      // Closing the browser's picker is a choice, not an error
      if (e?.name !== "NotAllowedError" && e?.name !== "AbortError") setError(e.message || "Screen sharing failed");
    } finally {
      setBusy(null);
    }
  }, [publish, stopScreen]);

  // Off stage (left, removed, stream ended): release the mic and screen
  useEffect(() => {
    if (!onStage) {
      stopMic();
      stopScreen();
      setError(null);
    }
  }, [onStage, stopMic, stopScreen]);

  // New media session after a reconnect: put what's still live back on air
  useEffect(() => {
    if (!onStage || !sessionGen) return;
    for (const [source, track] of Object.entries(tracksRef.current)) {
      if (track.readyState === "live") publish(track, source).catch((e) => setError(e.message));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionGen]);

  // Leaving the page releases the mic and screen
  useEffect(() => () => Object.values(tracksRef.current).forEach((t) => t?.stop()), []);

  return { micOn, screenOn, screenPreview, busy, error, clearError: () => setError(null), toggleMic, toggleScreen };
}
