import { useState, useEffect, useRef, useCallback } from "react";
import { Ellipsis, MessageSquare, Send, Timer, Trash2, VolumeX } from "lucide-react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { useSocketEvent } from "../../lib/useSocketEvent";
import { Badge, CardBar, EmptyState, IconButton, StatusDot, inputClass } from "../../components/ui";
import { cn } from "../../lib/cn";
import { API_URL as backendUrl } from "../../lib/config";
import { toast } from "../../lib/toast";

const MAX_LEN = 500; // MAX_STREAM_CHAT_LENGTH on the server
const SLOW_MODE_OPTIONS = [0, 5, 15, 30, 60];
const MUTE_OPTIONS = [
  { minutes: 5, label: "Mute 5 min" },
  { minutes: 10, label: "Mute 10 min" },
  { minutes: 60, label: "Mute 1 hour" },
];

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

const clock = (date) =>
  new Date(date || Date.now()).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });

/** Active chat mutes → Map(userId → until ms) */
const mutesMap = (mutes) =>
  new Map(
    (mutes || [])
      .filter((m) => new Date(m.until) > new Date())
      .map((m) => [String(idOf(m.user)), new Date(m.until).getTime()]),
  );

/**
 * Live chat panel for a stream.
 * The parent (StreamViewer) joins the socket room `stream_<id>`. Messages go out over the socket
 * with an acknowledgement (REST POST /api/stream/:id/chat when the socket is down) and arrive as
 * `new-stream-message`. The host can delete messages, mute players and turn on slow mode.
 */
const StreamChat = ({ streamId, messages = [], isLive = true, hostId, slowMode: initialSlowMode = 0, mutes, className }) => {
  const [message, setMessage] = useState("");
  const [chatMessages, setChatMessages] = useState(() => clean(messages).sort(byTime));
  const [loading, setLoading] = useState(false);
  const [slowMode, setSlowMode] = useState(initialSlowMode);
  const [muted, setMuted] = useState(() => mutesMap(mutes)); // userId → until (ms)
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [menuFor, setMenuFor] = useState(null); // message id with its moderation menu open
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();

  const me = user?._id;
  const isHost = Boolean(me && hostId && sameId(me, hostId));
  const myMuteUntil = me ? muted.get(String(me)) || 0 : 0;
  const mutedNow = myMuteUntil > now;
  const coolingDown = cooldownUntil > now;

  // Tick once a second while a mute or slow-mode cooldown is counting down
  useEffect(() => {
    if (!mutedNow && !coolingDown) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [mutedNow, coolingDown]);

  // Close the message actions menu on outside click / Escape
  useEffect(() => {
    if (!menuFor) return undefined;
    const onDown = (e) => !e.target.closest?.("[data-chat-menu]") && setMenuFor(null);
    const onKey = (e) => e.key === "Escape" && setMenuFor(null);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuFor]);

  const scrollToBottom = () => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  // History comes from the stream doc (liveChat, newest 50) — merge, don't replace
  useEffect(() => {
    const incoming = clean(messages);
    if (!incoming.length) return;
    setChatMessages((prev) => mergeMessages(prev, incoming));
  }, [messages]);

  // Reset when switching streams
  useEffect(() => {
    setChatMessages(clean(messages).sort(byTime));
    setSlowMode(initialSlowMode);
    setMuted(mutesMap(mutes));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamId]);

  const addNotice = (text) =>
    setChatMessages((prev) => [
      ...prev,
      { _id: `notice-${Date.now()}-${Math.random()}`, notice: true, message: text, createdAt: new Date().toISOString() },
    ]);

  /** Swap our optimistic copy for the saved message (whichever of ack / broadcast arrives first). */
  const confirmIncoming = useCallback((msg, tempId) => {
    setChatMessages((prev) => {
      const tempIdx = tempId
        ? prev.findIndex((m) => m._id === tempId)
        : prev.findIndex((m) => m.isTemp && sameId(m.sender, msg.sender) && m.message === msg.message);
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
  }, []);

  const forThisStream = (payload) => payload && sameId(payload.streamId, streamId);

  useSocketEvent("new-stream-message", (payload) => {
    if (forThisStream(payload) && payload.message) confirmIncoming(payload.message);
  });

  useSocketEvent("stream-chat:deleted", (payload) => {
    if (!forThisStream(payload)) return;
    setChatMessages((prev) => prev.filter((m) => !sameId(m._id, payload.messageId)));
  });

  useSocketEvent("stream-chat:muted", (payload) => {
    if (!forThisStream(payload)) return;
    const until = payload.until ? new Date(payload.until).getTime() : 0;
    setMuted((prev) => {
      const next = new Map(prev);
      if (until) next.set(String(payload.userId), until);
      else next.delete(String(payload.userId));
      return next;
    });
    if (sameId(payload.userId, me)) {
      setNow(Date.now());
      if (until) toast.error(`The host muted you in chat until ${clock(until)}`);
      else toast.success("You can chat again");
    }
  });

  useSocketEvent("stream:chat-settings", (payload) => {
    if (!forThisStream(payload) || typeof payload.chatSlowMode !== "number") return;
    setSlowMode(payload.chatSlowMode);
    addNotice(payload.chatSlowMode ? `Slow mode on: one message every ${payload.chatSlowMode}s` : "Slow mode off");
  });

  const handleSendError = (error, text) => {
    if (error.code === "CHAT_MUTED" && error.until) {
      setMuted((prev) => new Map(prev).set(String(me), new Date(error.until).getTime()));
      setNow(Date.now());
    }
    if (error.code === "CHAT_SLOW" && error.retryIn) setCooldownUntil(Date.now() + error.retryIn);
    setMessage((cur) => cur || text); // put the text back unless something new was typed
    toast.error(error.message || "Message not sent");
  };

  const canChat = Boolean(user) && isLive;

  const handleSendMessage = async (e) => {
    e?.preventDefault?.();
    if (!message.trim() || !canChat || mutedNow || coolingDown) return;

    const text = message.trim().slice(0, MAX_LEN);
    const temp = {
      _id: `temp-${Date.now()}`,
      message: text,
      sender: user,
      createdAt: new Date().toISOString(),
      isTemp: true,
    };
    setChatMessages((prev) => [...prev, temp]);
    setMessage("");
    const dropTemp = () => setChatMessages((prev) => prev.filter((m) => m._id !== temp._id));

    try {
      let saved;
      if (socket && isConnected) {
        const res = await socket.timeout(10000).emitWithAck("send-stream-message", { streamId, message: text });
        if (res?.error) throw Object.assign(new Error(res.error), res);
        saved = res.message;
      } else {
        setLoading(true);
        try {
          saved = (await axios.post(`${backendUrl}/api/stream/${streamId}/chat`, { message: text })).data;
        } catch (err) {
          const data = err.response?.data || {};
          throw Object.assign(new Error(data.message || "Message not sent"), data);
        } finally {
          setLoading(false);
        }
      }
      if (saved?._id) confirmIncoming(saved, temp._id);
      else dropTemp();
      if (slowMode > 0 && !isHost) setCooldownUntil(Date.now() + slowMode * 1000);
      setNow(Date.now());
    } catch (error) {
      dropTemp();
      handleSendError(error.message === "operation has timed out" ? new Error("Message not delivered") : error, text);
    } finally {
      inputRef.current?.focus();
    }
  };

  const moderate = async (event, data, success) => {
    setMenuFor(null);
    try {
      const res = await socket.timeout(8000).emitWithAck(event, { streamId, ...data });
      if (res?.error) toast.error(res.error);
      else if (success) toast.success(success);
    } catch {
      toast.error("No answer from the server — try again");
    }
  };

  const moderationReady = Boolean(socket && isConnected);

  const disabledHint = !user
    ? "Sign in to join the chat."
    : !isLive
      ? "Stream has ended. Chat is disabled."
      : mutedNow
        ? `The host muted you until ${clock(myMuteUntil)}.`
        : null;

  return (
    <section aria-label="Stream chat" className={cn("flex min-h-0 flex-col border border-border bg-card", className)}>
      <CardBar
        title="Stream chat"
        right={
          <span className="flex items-center gap-3 text-[10px] font-bold tracking-[0.14em] text-faint uppercase">
            {isHost && isLive ? (
              <label className="flex items-center gap-1.5" title="Slow mode: time between each viewer's messages">
                <Timer className="size-3.5" aria-hidden="true" />
                <span className="sr-only">Slow mode</span>
                <select
                  value={slowMode}
                  disabled={!moderationReady}
                  onChange={(e) => moderate("stream:set-slow-mode", { seconds: Number(e.target.value) })}
                  className={cn(inputClass, "h-7 w-auto px-1.5 text-[10px] tracking-normal normal-case")}
                >
                  {SLOW_MODE_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s ? `${s}s` : "Off"}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              slowMode > 0 && (
                <span className="flex items-center gap-1" title="Slow mode is on">
                  <Timer className="size-3.5" aria-hidden="true" /> {slowMode}s
                </span>
              )
            )}
            <span className="flex items-center gap-1.5" role="status">
              <StatusDot tone={isConnected ? "success" : "warning"} pulse={!isConnected} />
              {isConnected ? "Live" : "Offline"}
            </span>
          </span>
        }
      />

      <div ref={listRef} role="log" aria-live="polite" className="min-h-0 flex-1 overflow-y-auto px-4 py-3 scrollbar-thin">
        {chatMessages.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No messages yet"
            description={isLive ? "Be the first to say something." : "Nobody chatted during this stream."}
            className="h-full py-8"
          />
        ) : (
          <ul className="space-y-2">
            {chatMessages.map((msg) => {
              if (msg.notice) {
                return (
                  <li key={msg._id} className="border-l border-dashed border-border-strong pl-2 text-[11px] text-faint italic">
                    {msg.message}
                  </li>
                );
              }
              const senderId = String(idOf(msg.sender) ?? "");
              const fromHost = hostId && sameId(msg.sender, hostId);
              const isMe = sameId(msg.sender, me);
              const senderMuted = (muted.get(senderId) || 0) > now;
              const canModerate = !msg.isTemp && moderationReady && isLive && (isHost || isMe);
              return (
                <li
                  key={msg._id}
                  className={cn("group relative pr-7 text-xs leading-relaxed break-words", msg.isTemp && "opacity-60")}
                >
                  <span className="mr-2 text-[10px] text-faint tabular-nums">{clock(msg.createdAt)}</span>
                  {fromHost && (
                    <Badge variant="default" className="mr-1.5 align-middle">
                      Host
                    </Badge>
                  )}
                  <span className={cn("font-bold", isMe ? "text-info" : "text-primary")}>
                    @{msg.sender?.username || msg.sender?.profile?.name || "anonymous"}
                  </span>
                  {isHost && senderMuted && !isMe && (
                    <VolumeX className="ml-1 inline size-3 align-[-2px] text-warning" aria-label="Muted" />
                  )}{" "}
                  <span className="text-muted-foreground">{msg.message}</span>

                  {canModerate && (
                    <div data-chat-menu className="absolute top-0 right-0">
                      <button
                        type="button"
                        aria-label="Message actions"
                        aria-haspopup="menu"
                        aria-expanded={menuFor === msg._id}
                        onClick={() => setMenuFor((cur) => (cur === msg._id ? null : msg._id))}
                        className="flex size-6 items-center justify-center text-faint opacity-0 group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100 aria-expanded:opacity-100 [@media(hover:none)]:opacity-100"
                      >
                        <Ellipsis className="size-3.5" aria-hidden="true" />
                      </button>
                      {menuFor === msg._id && (
                        <div
                          role="menu"
                          className="absolute top-full right-0 z-20 mt-1 w-40 border border-border-strong bg-popover p-1 text-xs shadow-float"
                        >
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => moderate("stream-chat:delete", { messageId: msg._id })}
                            className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="size-3.5" aria-hidden="true" /> Delete message
                          </button>
                          {isHost &&
                            !isMe &&
                            (senderMuted ? (
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() =>
                                  moderate("stream-chat:mute", { userId: senderId, minutes: 0 }, `Unmuted @${msg.sender?.username}`)
                                }
                                className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-accent"
                              >
                                <VolumeX className="size-3.5" aria-hidden="true" /> Unmute
                              </button>
                            ) : (
                              MUTE_OPTIONS.map(({ minutes, label }) => (
                                <button
                                  key={minutes}
                                  type="button"
                                  role="menuitem"
                                  onClick={() =>
                                    moderate(
                                      "stream-chat:mute",
                                      { userId: senderId, minutes },
                                      `Muted @${msg.sender?.username} for ${minutes >= 60 ? "1 hour" : `${minutes} min`}`,
                                    )
                                  }
                                  className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-accent"
                                >
                                  <VolumeX className="size-3.5 text-faint" aria-hidden="true" /> {label}
                                </button>
                              ))
                            ))}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

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
              placeholder={coolingDown ? `Slow mode — ${Math.ceil((cooldownUntil - now) / 1000)}s` : "Say something…"}
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
              disabled={!message.trim() || loading || coolingDown}
            />
          </form>
        )}
        {!disabledHint && (slowMode > 0 || message.length > 450) && (
          <p className="mt-1.5 flex justify-between gap-2 text-[10px] text-faint tabular-nums">
            <span>
              {slowMode > 0 && !isHost && (coolingDown ? `Wait ${Math.ceil((cooldownUntil - now) / 1000)}s` : `Slow mode: ${slowMode}s`)}
            </span>
            {message.length > 450 && (
              <span className={message.length > 480 ? "text-destructive" : "text-warning"}>
                {message.length}/{MAX_LEN}
              </span>
            )}
          </p>
        )}
      </div>
    </section>
  );
};

export default StreamChat;
