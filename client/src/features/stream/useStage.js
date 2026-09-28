import { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "../../context/SocketContext";
import { useSocketEvent } from "../../lib/useSocketEvent";
import { notifyIfAway } from "../../lib/desktopNotify";
import { playAlertSound } from "../../lib/alertSound";
import { toast } from "../../lib/toast";

const EMPTY = { guests: [], requests: [], status: "none", maxGuests: 3 };
const nameOf = (user) => user?.name || user?.username || "Someone";

/**
 * The stream's stage (see "Stage" in backend/src/sfu/index.js): viewers ask to join, the host lets
 * them in, guests share their screen and mic. `initial` is the stage state the media session got
 * when it joined; socket events keep it current. Stage moments that need someone's attention
 * (a request for the host, being let in for a guest) also ring the desktop when the app is in the
 * background — hosts are often looking at the window they're screen-sharing.
 */
export function useStage(streamId, { initial, isHost = false, streamTitle = "the stream" } = {}) {
  const { socket, isConnected } = useSocket();
  const [stage, setStage] = useState(EMPTY);
  const [busy, setBusy] = useState(null);
  const knownRequests = useRef(new Set());

  useEffect(() => {
    setStage(EMPTY);
    knownRequests.current = new Set();
  }, [streamId]);

  useEffect(() => {
    if (!initial) return;
    setStage((s) => ({ ...s, ...initial, requests: initial.requests ?? [] }));
    knownRequests.current = new Set((initial.requests ?? []).map((r) => r._id));
  }, [initial]);

  const forThisStream = (payload) => payload && String(payload.streamId) === String(streamId);

  useSocketEvent("stage:guests", (payload) => {
    if (!forThisStream(payload)) return;
    setStage((s) => ({ ...s, guests: payload.guests || [], maxGuests: payload.maxGuests ?? s.maxGuests }));
  });

  useSocketEvent("stage:requests", (payload) => {
    if (!forThisStream(payload) || !isHost) return;
    const requests = payload.requests || [];
    setStage((s) => ({ ...s, requests }));
    const fresh = requests.filter((r) => !knownRequests.current.has(r._id));
    knownRequests.current = new Set(requests.map((r) => r._id));
    fresh.forEach((r) => {
      toast(`@${r.username} wants to join the stage`, { icon: "✋" });
      notifyIfAway({
        title: "Stage request",
        body: `${nameOf(r)} wants to share their screen and mic in “${streamTitle}”`,
        tag: `stage-request-${streamId}-${r._id}`,
        requireInteraction: true,
      });
    });
    if (fresh.length) playAlertSound();
  });

  useSocketEvent("stage:status", (payload) => {
    if (!forThisStream(payload)) return;
    setStage((s) => ({ ...s, status: payload.status }));
    if (payload.status === "approved") {
      toast.success("You're on stage — turn on your mic or share your screen");
      notifyIfAway({
        title: "You're on stage",
        body: `The host let you in to “${streamTitle}”. Come back to turn on your mic or share your screen.`,
        tag: `stage-${streamId}`,
        requireInteraction: true,
      });
      playAlertSound();
    } else if (payload.reason === "denied") {
      toast("The host didn't add you to the stage this time");
    } else if (payload.reason === "removed") {
      toast("The host took you off the stage");
      notifyIfAway({ title: "Off stage", body: `The host took you off the stage in “${streamTitle}”.`, tag: `stage-${streamId}` });
    } else if (payload.reason === "disconnected") {
      toast("You left the stage because your connection dropped");
    }
  });

  const call = useCallback(
    async (key, event, data = {}) => {
      if (!socket || !isConnected) {
        toast.error("Not connected — try again in a moment");
        return null;
      }
      setBusy(key);
      try {
        const res = await socket.timeout(8000).emitWithAck(event, { streamId, ...data });
        if (res?.error) {
          toast.error(res.error);
          return null;
        }
        if (res?.status) setStage((s) => ({ ...s, ...res, requests: res.requests ?? s.requests }));
        return res;
      } catch {
        toast.error("No answer from the server — try again");
        return null;
      } finally {
        setBusy(null);
      }
    },
    [socket, isConnected, streamId],
  );

  return {
    ...stage,
    busy,
    isFull: stage.guests.length >= stage.maxGuests,
    request: () => call("request", "stage:request"),
    cancel: () => call("cancel", "stage:cancel"),
    leave: () => call("leave", "stage:leave"),
    respond: (userId, approve) => call(`respond:${userId}`, "stage:respond", { userId, approve }),
    remove: (userId) => call(`remove:${userId}`, "stage:remove", { userId }),
  };
}
