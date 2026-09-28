import { useEffect, useRef } from "react";
import { useSocket } from "../context/SocketContext";

/**
 * Subscribe to a server → client Socket.IO event for the lifetime of a component.
 * The latest `handler` is always used, so it doesn't need to be memoised, and the
 * listener follows the shared socket across reconnects / sign-ins.
 *
 *   useSocketEvent("post:likes", ({ postId, likesCount }) => …);
 *
 * Pass `onReconnect` to refetch data that may have changed while offline. It runs after
 * every reconnect (not the first connect) — socket.io's own retries and SocketContext's
 * retry after a refused handshake alike — once the socket is connected again, so nothing
 * pushed after the refetch is missed.
 */
export function useSocketEvent(event, handler, { onReconnect } = {}) {
  const { socket, reconnects } = useSocket();
  const handlerRef = useRef(handler);
  const reconnectRef = useRef(onReconnect);
  handlerRef.current = handler;
  reconnectRef.current = onReconnect;

  useEffect(() => {
    if (!socket || !event) return undefined;
    const listener = (payload) => handlerRef.current?.(payload);
    socket.on(event, listener);
    return () => socket.off(event, listener);
  }, [socket, event]);

  // `reconnects` only ever counts up; a change after mount means we were offline
  const seenReconnects = useRef(reconnects);
  useEffect(() => {
    if (reconnects === seenReconnects.current) return;
    seenReconnects.current = reconnects;
    reconnectRef.current?.();
  }, [reconnects]);
}

export default useSocketEvent;
