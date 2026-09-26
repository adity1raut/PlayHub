import { useState, useEffect, useRef, useCallback } from "react";
import { MessageSquare, Send } from "lucide-react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { Badge, CardBar, EmptyState, IconButton, StatusDot, inputClass } from "../../components/ui";
import { cn } from "../../lib/cn";
import { API_URL as backendUrl } from "../../lib/config";
import { toast } from "../../lib/toast";

const MAX_LEN = 500;

const idOf = (v) => (v && typeof v === "object" ? v._id : v);
const sameId = (a, b) => a != null && b != null && String(idOf(a)) === String(idOf(b));

const byTime = (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0);

// liveChat may hold bare ids when the stream wasn't populated — keep message objects only.
const clean = (arr) => (Array.isArray(arr) ? arr.filter((m) => m && typeof m === "object" && m._id) : []);

/** Merge incoming messages into the list, deduped by _id, oldest first. */
const mergeMessages = (prev, incoming) => {
  const map = new Map(prev.map((m) => [String(m._id), m]));
  incoming.forEach((m) => {
    if (m && m._id) map.set(String(m._id), m);
  });
  return [...map.values()].sort(byTime);
};

/**
 * Live chat panel for a stream.
 * The parent (StreamViewer) joins the socket room `stream_<id>`; this component
 * listens for "new-stream-message" and sends via "send-stream-message",
 * falling back to REST POST /api/stream/:id/chat when the socket is offline.
 */
const StreamChat = ({ streamId, messages = [], onSendMessage, isLive = true, hostId, className }) => {
  const [message, setMessage] = useState("");
  const [chatMessages, setChatMessages] = useState(() => clean(messages).sort(byTime));
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  // Optimistic socket sends awaiting their echo: tempId -> { text, timer }
  const pendingRef = useRef(new Map());
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();

  const clearPending = useCallback((tempId) => {
    const entry = pendingRef.current.get(tempId);
    if (entry) clearTimeout(entry.timer);
    pendingRef.current.delete(tempId);
  }, []);

  useEffect(
    () => () => {
      pendingRef.current.forEach((entry) => clearTimeout(entry.timer));
      pendingRef.current.clear();
    },
    [],
  );

  const scrollToBottom = () => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  // History comes from the stream doc (liveChat, newest 50, newest-first) — merge, don't replace,
  // so periodic refreshes don't drop live messages received over the socket.
  useEffect(() => {
    const incoming = clean(messages);
    if (!incoming.length) return;
    setChatMessages((prev) => mergeMessages(prev, incoming));
  }, [messages]);

  // Reset when switching streams
  useEffect(() => {
    setChatMessages(clean(messages).sort(byTime));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamId]);

  const confirmIncoming = useCallback(
    (msg) => {
      setChatMessages((prev) => {
        // Our own optimistic copy (same sender + text), if there is one.
        const tempIdx = prev.findIndex(
          (m) => m.isTemp && sameId(m.sender, msg.sender) && m.message === msg.message,
        );
        if (prev.some((m) => sameId(m._id, msg._id))) {
          return tempIdx === -1 ? prev : prev.filter((_, i) => i !== tempIdx);
        }
        if (tempIdx !== -1) {
          const next = [...prev];
          next[tempIdx] = msg;
          return next.sort(byTime);
        }
        return [...prev, msg].sort(byTime);
      });
    },
    [],
  );

  // Realtime: new messages + server errors
  useEffect(() => {
    if (!socket) return undefined;

    const onNewMessage = (payload) => {
      if (!payload || !sameId(payload.streamId, streamId) || !payload.message) return;
      const msg = payload.message;
      if (sameId(msg.sender, user?._id)) {
        for (const [tempId, entry] of pendingRef.current) {
          if (entry.text === msg.message) {
            clearPending(tempId);
            break;
          }
        }
        onSendMessage?.(msg);
      }
      confirmIncoming(msg);
    };

    const onError = (err) => {
      // Server emits a generic "error" event; drop pending optimistic socket messages.
      const pendingIds = [...pendingRef.current.keys()];
      pendingIds.forEach(clearPending);
      if (pendingIds.length) {
        setChatMessages((prev) => prev.filter((m) => !pendingIds.includes(m._id)));
      }
      toast.error(err?.message || "Chat error");
    };

    socket.on("new-stream-message", onNewMessage);
    socket.on("error", onError);
    return () => {
      socket.off("new-stream-message", onNewMessage);
      socket.off("error", onError);
    };
  }, [socket, streamId, user?._id, onSendMessage, confirmIncoming, clearPending]);

  const canChat = Boolean(user) && isLive;

  const handleSendMessage = async (e) => {
    e?.preventDefault?.();
    if (!message.trim() || !canChat) return;

    const currentMessage = message.trim().slice(0, MAX_LEN);
    const tempMessage = {
      _id: "temp-" + Date.now(),
      message: currentMessage,
      sender: user,
      createdAt: new Date().toISOString(),
      isTemp: true,
    };

    // Optimistically add message
    setChatMessages((prev) => [...prev, tempMessage]);
    setMessage("");

    // Prefer the shared socket; the server echoes the saved message back to the room.
    if (socket && isConnected) {
      const timer = setTimeout(() => {
        if (!pendingRef.current.has(tempMessage._id)) return;
        clearPending(tempMessage._id);
        setChatMessages((prev) => prev.filter((m) => m._id !== tempMessage._id));
        toast.error("Message not delivered. Please try again.");
      }, 10000);
      pendingRef.current.set(tempMessage._id, { text: currentMessage, timer });
      socket.emit("send-stream-message", { streamId, message: currentMessage });
      return;
    }

    // Fallback: REST
    setLoading(true);
    try {
      const response = await axios.post(`${backendUrl}/api/stream/${streamId}/chat`, {
        message: currentMessage,
      });

      if (response.status === 201) {
        const saved = response.data;
        setChatMessages((prev) => {
          if (prev.some((m) => sameId(m._id, saved._id))) {
            return prev.filter((m) => m._id !== tempMessage._id);
          }
          return prev.map((m) => (m._id === tempMessage._id ? saved : m));
        });
        onSendMessage?.(saved);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setChatMessages((prev) => prev.filter((m) => m._id !== tempMessage._id));
      setMessage(currentMessage); // Restore message
      toast.error(error.response?.data?.message || "Failed to send message. Please try again.");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const formatTime = (timestamp) =>
    new Date(timestamp || Date.now()).toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    });

  const getUsername = (sender) => sender?.username || sender?.profile?.name || "anonymous";

  const disabledHint = !user
    ? "Sign in to join the chat."
    : !isLive
      ? "Stream has ended. Chat is disabled."
      : null;

  return (
    <section
      aria-label="Stream chat"
      className={cn("flex min-h-0 flex-col border border-border bg-card", className)}
    >
      <CardBar
        title="Stream chat"
        right={
          <span className="flex items-center gap-3 text-[10px] font-bold tracking-[0.14em] text-faint uppercase">
            <span className="tabular-nums">{chatMessages.length} msg</span>
            <span className="flex items-center gap-1.5" role="status">
              <StatusDot tone={isConnected ? "success" : "warning"} pulse={!isConnected} />
              {isConnected ? "Live" : "Offline"}
            </span>
          </span>
        }
      />

      {/* Messages */}
      <div
        ref={listRef}
        role="log"
        aria-live="polite"
        className="min-h-0 flex-1 overflow-y-auto px-4 py-3 scrollbar-thin"
      >
        {chatMessages.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No messages yet"
            description={isLive ? "Be the first to say something." : "Nobody chatted during this stream."}
            className="h-full py-8"
          />
        ) : (
          <ul className="space-y-2">
            {chatMessages.map((msg, index) => {
              const isHost = hostId && sameId(msg.sender, hostId);
              const isMe = sameId(msg.sender, user?._id);
              return (
                <li
                  key={msg._id || index}
                  className={cn("text-xs leading-relaxed break-words", msg.isTemp && "opacity-60")}
                >
                  <span className="mr-2 text-[10px] text-faint tabular-nums">{formatTime(msg.createdAt)}</span>
                  {isHost && (
                    <Badge variant="default" className="mr-1.5 align-middle">
                      Host
                    </Badge>
                  )}
                  <span className={cn("font-bold", isMe ? "text-info" : "text-primary")}>
                    @{getUsername(msg.sender)}
                  </span>{" "}
                  <span className="text-muted-foreground">{msg.message}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-border p-3">
        {disabledHint ? (
          <p className="border border-dashed border-border-strong px-3 py-3 text-center text-[11px] text-faint">
            {disabledHint}
          </p>
        ) : (
          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <span aria-hidden="true" className="text-sm font-bold text-primary">
              &gt;
            </span>
            <input
              ref={inputRef}
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Say something…"
              aria-label="Chat message"
              className={cn(inputClass, "min-w-0 flex-1")}
              maxLength={MAX_LEN}
              disabled={loading}
            />
            <IconButton
              type="submit"
              icon={Send}
              label="Send message"
              variant="default"
              size="md"
              disabled={!message.trim() || loading}
            />
          </form>
        )}
        {message.length > 450 && (
          <p
            className={cn(
              "mt-1.5 text-right text-[10px] tabular-nums",
              message.length > 480 ? "text-destructive" : "text-warning",
            )}
          >
            {message.length}/{MAX_LEN}
          </p>
        )}
      </div>
    </section>
  );
};

export default StreamChat;
