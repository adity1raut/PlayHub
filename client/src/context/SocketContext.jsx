import { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";
import { API_URL } from "../lib/config";

// Retry after the server refused the handshake: 2s, 4s, 8s … capped at 30s
const RETRY_MIN_MS = 2000;
const RETRY_MAX_MS = 30000;

const SocketContext = createContext({ socket: null, isConnected: false, reconnects: 0 });

/**
 * One Socket.IO connection for the whole app, opened once the user is signed in.
 * The server authenticates it from the httpOnly `token` cookie sent with the
 * handshake, so the client never needs to read the token itself.
 *
 * `reconnects` counts every connect after the first one; useSocketEvent's `onReconnect`
 * refetches on it.
 */
export function SocketProvider({ children }) {
  const { user, refreshUser } = useAuth();
  const userId = user?._id;
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [reconnects, setReconnects] = useState(0);

  useEffect(() => {
    if (!userId) return undefined;

    const s = io(API_URL || undefined, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnectionDelayMax: 5000,
    });
    let closed = false;
    let connectedBefore = false;
    let retryTimer = null;
    let retryDelay = RETRY_MIN_MS;

    s.on("connect", () => {
      setIsConnected(true);
      retryDelay = RETRY_MIN_MS;
      if (connectedBefore) setReconnects((n) => n + 1);
      connectedBefore = true;
    });
    s.on("disconnect", () => setIsConnected(false));
    s.on("connect_error", async (err) => {
      setIsConnected(false);
      console.warn("Socket connection error:", err.message);
      // Network / server down: socket.io keeps retrying by itself (`active` stays true). But a
      // handshake refused by the server's auth middleware is final for socket.io-client, so
      // re-check the session: signed out → AuthContext drops the user and this effect closes
      // the socket (no loop); still signed in → try again after a capped backoff.
      if (s.active || closed) return;
      const session = await refreshUser();
      if (closed || session === null) return;
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => {
        if (!closed && !s.connected) s.connect();
      }, retryDelay);
      retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS);
    });

    setSocket(s);
    return () => {
      closed = true;
      clearTimeout(retryTimer);
      s.removeAllListeners();
      s.close();
      setSocket(null);
      setIsConnected(false);
    };
  }, [userId, refreshUser]);

  return (
    <SocketContext.Provider value={{ socket, isConnected, reconnects }}>{children}</SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
