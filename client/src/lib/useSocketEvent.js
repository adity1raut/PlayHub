import { useEffect, useRef } from "react";
import { useSocket } from "../context/SocketContext";

/**
 * Subscribe to a server → client Socket.IO event for the lifetime of a component.
 * The latest `handler` is always used, so it doesn't need to be memoised, and the
 * listener follows the shared socket across reconnects / sign-ins.
 *
 *   useSocketEvent("post:likes", ({ postId, likesCount }) => …);
 *
 * Pass `onReconnect` to refetch data that may have changed while offline.
 */
export function useSocketEvent(event, handler, { onReconnect } = {}) {
  const { socket } = useSocket();
  const handlerRef = useRef(handler);
  const reconnectRef = useRef(onReconnect);
  handlerRef.current = handler;
  reconnectRef.current = onReconnect;

  useEffect(() => {
    if (!socket || !event) return undefined;
    const listener = (payload) => handlerRef.current?.(payload);
    const onConnect = () => reconnectRef.current?.();
    socket.on(event, listener);
    socket.io.on("reconnect", onConnect);
    return () => {
      socket.off(event, listener);
      socket.io.off("reconnect", onConnect);
    };
  }, [socket, event]);
}

export default useSocketEvent;
