import { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";
import { API_URL } from "../lib/config";

const SocketContext = createContext({ socket: null, isConnected: false });

/**
 * One Socket.IO connection for the whole app, opened once the user is signed in.
 * The server authenticates it from the httpOnly `token` cookie sent with the
 * handshake, so the client never needs to read the token itself.
 */
export function SocketProvider({ children }) {
  const { user } = useAuth();
  const userId = user?._id;
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!userId) return undefined;

    const s = io(API_URL || undefined, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnectionDelayMax: 5000,
    });

    s.on("connect", () => setIsConnected(true));
    s.on("disconnect", () => setIsConnected(false));
    s.on("connect_error", (err) => {
      setIsConnected(false);
      console.warn("Socket connection error:", err.message);
    });

    setSocket(s);
    return () => {
      s.removeAllListeners();
      s.close();
      setSocket(null);
      setIsConnected(false);
    };
  }, [userId]);

  return <SocketContext.Provider value={{ socket, isConnected }}>{children}</SocketContext.Provider>;
}

export const useSocket = () => useContext(SocketContext);
