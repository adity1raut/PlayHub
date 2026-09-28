import { useCallback, useRef, useState } from "react";
import { useSocket } from "../../context/SocketContext";
import { useSocketEvent } from "../../lib/useSocketEvent";
import { toast } from "../../lib/toast";

// Mirrors REACTIONS in backend/src/modules/stream/stream.socket.js
export const REACTIONS = ["❤️", "🔥", "😂", "👏", "😮", "💯"];

const LIFETIME_MS = 2600; // matches --animate-float-up
const MAX_FLOATING = 40;

/**
 * Live reactions for a stream: `stream:react` out, `stream:reaction` in (from the stream room,
 * which StreamViewer joins). Returns the reactions currently floating over the player.
 */
export function useStreamReactions(streamId, { enabled = true } = {}) {
  const { socket, isConnected } = useSocket();
  const [floating, setFloating] = useState([]); // { id, emoji, x (%), drift (px) }
  const nextId = useRef(0);

  useSocketEvent("stream:reaction", ({ streamId: sid, emoji } = {}) => {
    if (!enabled || String(sid) !== String(streamId) || !REACTIONS.includes(emoji)) return;
    const id = ++nextId.current;
    const item = { id, emoji, x: 8 + Math.random() * 84, drift: Math.round((Math.random() - 0.5) * 60) };
    setFloating((prev) => [...prev.slice(-(MAX_FLOATING - 1)), item]);
    setTimeout(() => setFloating((prev) => prev.filter((r) => r.id !== id)), LIFETIME_MS);
  });

  const send = useCallback(
    async (emoji) => {
      if (!socket || !isConnected) return;
      try {
        const res = await socket.timeout(5000).emitWithAck("stream:react", { streamId, emoji });
        if (res?.error) toast.error(res.error);
      } catch {
        /* timed out — reactions are fire-and-forget */
      }
    },
    [socket, isConnected, streamId],
  );

  return { floating, send, canSend: Boolean(enabled && socket && isConnected) };
}
