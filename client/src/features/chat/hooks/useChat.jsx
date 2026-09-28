import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { API_URL } from "../../../lib/config";
import { toast } from "../../../lib/toast";
import { useAuth } from "../../../context/AuthContext";
import { useSocket } from "../../../context/SocketContext";

/* ---------- helpers (shared with the chat components) ---------- */

/** String id of a populated doc or a raw ObjectId/string. */
export const idOf = (value) =>
  value && typeof value === "object" ? String(value._id ?? "") : value ? String(value) : "";

/** Messages carry `conversationId` (see models/message.model.js). */
export const conversationIdOf = (message) => idOf(message?.conversationId ?? message?.conversation);

export const hasReadBy = (message, userId) =>
  (message?.readBy || []).some((entry) => idOf(entry?.user ?? entry) === String(userId));

const addReadBy = (message, userId) =>
  hasReadBy(message, userId)
    ? message
    : { ...message, readBy: [...(message.readBy || []), { user: userId, readAt: new Date().toISOString() }] };

/** Move (or insert) a conversation to the top of the list. */
const upsertTop = (list, conversation) => [conversation, ...list.filter((c) => c._id !== conversation._id)];

/** Add a message once (dedupe by _id); upgrade an unpopulated sender if a populated copy arrives. */
const appendUnique = (list, message) => {
  const index = list.findIndex((m) => m._id === message._id);
  if (index === -1) return [...list, message];
  const existing = list[index];
  if (typeof existing.sender !== "object" && typeof message.sender === "object") {
    const next = list.slice();
    next[index] = { ...existing, sender: message.sender };
    return next;
  }
  return list;
};

const SEND_TIMEOUT = 8000; // no echo of our own message → reconcile over HTTP
const TYPING_IDLE = 2500; // stop "typing" after this much inactivity
const TYPING_REFRESH = 3000; // re-send typing-start while a burst continues
const TYPING_EXPIRE = 6000; // drop a remote "typing" flag if no stop event arrives
const SEND_ERRORS = [
  "Conversation ID is required",
  "Message content is required",
  "Conversation not found",
  "Failed to send message",
];
// Server error code when the two players aren't friends (and don't both allow messages from everyone)
export const CHAT_FORBIDDEN = "CHAT_FORBIDDEN";

/** Whether the thread's composer is open. Unknown (e.g. a thread that just arrived live) counts as open. */
export const canMessageIn = (conversation) => conversation?.canMessage !== false;

/**
 * Chat state + realtime wiring on top of the shared Socket.IO connection.
 *
 * REST:   GET/POST /api/chat/conversations, GET /api/chat/conversations/:id/messages,
 *         POST /api/chat/messages (fallback while the socket is down),
 *         POST /api/chat/messages/attachment (photos, videos, audio, files)
 * Socket: join-conversation, leave-conversation, send-message, typing-start/stop, mark-as-read
 *         ← new-message, conversation-updated, user-typing, user-stop-typing, message-read, error
 *
 * Conversations carry { isFriend, canMessage } from the server: only friends (mutual followers)
 * can message each other, so a thread whose players stopped being friends is read-only.
 */
const useChat = (socketOverride, { onSendFailed } = {}) => {
  const { user } = useAuth();
  const me = idOf(user);
  const shared = useSocket();
  const socket = socketOverride ?? shared.socket;
  const isConnected =
    socketOverride && socketOverride !== shared.socket
      ? Boolean(socketOverride.connected)
      : Boolean(shared.socket) && shared.isConnected;

  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});
  const [currentConversation, setCurrentConversation] = useState(null);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [conversationsError, setConversationsError] = useState(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [pageVisible, setPageVisible] = useState(() =>
    typeof document === "undefined" ? true : document.visibilityState !== "hidden",
  );

  const currentIdRef = useRef(null);
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;
  const liveSocketRef = useRef(null);
  liveSocketRef.current = isConnected ? socket : null;
  const onSendFailedRef = useRef(onSendFailed);
  onSendFailedRef.current = onSendFailed;

  const messagesRequestRef = useRef(0);
  const pendingSendRef = useRef(null);
  const markedRef = useRef(new Set());
  const joinedRef = useRef(new Set());
  const remoteTypingTimers = useRef({});
  const selfTypingRef = useRef({ conversationId: null, startedAt: 0, timer: null });

  /* ---------- REST ---------- */

  const fetchConversations = useCallback(async () => {
    try {
      setConversationsError(null);
      const response = await axios.get(`${API_URL}/api/chat/conversations`, { withCredentials: true });
      if (response.data.success) {
        const fetched = response.data.conversations || [];
        const openId = currentIdRef.current;
        setConversations((prev) => {
          // Keep an open conversation that a concurrent create hasn't made it into this response yet
          if (openId && !fetched.some((c) => c._id === openId)) {
            const open = prev.find((c) => c._id === openId);
            if (open) return [open, ...fetched];
          }
          return fetched;
        });
        // Friendship may have changed (follow / unfollow) — keep the open thread's composer in step
        const fresh = openId && fetched.find((c) => c._id === openId);
        if (fresh) {
          setCurrentConversation((cur) =>
            cur?._id === fresh._id ? { ...cur, isFriend: fresh.isFriend, canMessage: fresh.canMessage } : cur,
          );
        }
      }
    } catch (error) {
      console.error("Error fetching conversations:", error);
      setConversationsError(error.response?.data?.message || "Could not load conversations");
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  const fetchMessages = useCallback(async (conversationId, { silent = false } = {}) => {
    if (!conversationId) return;
    const requestId = ++messagesRequestRef.current;
    if (!silent) setLoadingMessages(true);
    try {
      const response = await axios.get(`${API_URL}/api/chat/conversations/${conversationId}/messages`, {
        withCredentials: true,
      });
      if (requestId !== messagesRequestRef.current) return; // switched conversation meanwhile
      if (response.data.success) {
        const fetched = response.data.messages || [];
        const ids = new Set(fetched.map((m) => m._id));
        // Keep realtime messages that arrived while the request was in flight
        setMessages((prev) => [
          ...fetched,
          ...prev.filter((m) => conversationIdOf(m) === String(conversationId) && !ids.has(m._id)),
        ]);
      }
    } catch (error) {
      if (requestId !== messagesRequestRef.current) return;
      console.error("Error fetching messages:", error);
      if (!silent) toast.error(error.response?.data?.message || "Could not load messages");
    } finally {
      if (requestId === messagesRequestRef.current) setLoadingMessages(false);
    }
  }, []);

  // Create or get the 1:1 conversation with a user (POST /api/chat/conversations { userId })
  const startConversation = useCallback(
    async (userId) => {
      const target = idOf(userId);
      if (!target) return null;
      if (target === me) {
        toast.info("You can't message yourself");
        return null;
      }
      try {
        const response = await axios.post(
          `${API_URL}/api/chat/conversations`,
          { userId: target },
          { withCredentials: true },
        );
        if (!response.data.success) return null;
        const conversation = response.data.conversation;
        const known = conversationsRef.current.some((c) => c._id === conversation._id);
        setConversations((prev) =>
          prev.some((c) => c._id === conversation._id)
            ? // this endpoint doesn't populate lastMessage — keep the populated one we have
              prev.map((c) => (c._id === conversation._id ? { ...c, ...conversation, lastMessage: c.lastMessage } : c))
            : [
                {
                  ...conversation,
                  lastMessage: typeof conversation.lastMessage === "object" ? conversation.lastMessage : null,
                },
                ...prev,
              ],
        );
        // An existing thread we didn't have locally: refresh to get its populated last message
        if (!known && conversation.lastMessage) fetchConversations();
        return conversation;
      } catch (error) {
        console.error("Error creating conversation:", error);
        toast.error(error.response?.data?.message || "Could not start the conversation");
        return null;
      }
    },
    [me, fetchConversations],
  );

  /* ---------- typing (outgoing) ---------- */

  const stopTyping = useCallback(() => {
    const { conversationId, timer } = selfTypingRef.current;
    clearTimeout(timer);
    selfTypingRef.current = { conversationId: null, startedAt: 0, timer: null };
    if (conversationId) liveSocketRef.current?.emit("typing-stop", conversationId);
  }, []);

  const notifyTyping = useCallback(() => {
    const conversationId = currentIdRef.current;
    const live = liveSocketRef.current;
    if (!conversationId || !live) return;
    const state = selfTypingRef.current;
    const now = Date.now();
    if (state.conversationId && state.conversationId !== conversationId) live.emit("typing-stop", state.conversationId);
    // (Re)announce on a new burst and periodically, so the other side's expiry never fires mid-burst
    const announce = state.conversationId !== conversationId || now - state.startedAt > TYPING_REFRESH;
    if (announce) live.emit("typing-start", conversationId);
    clearTimeout(state.timer);
    selfTypingRef.current = {
      conversationId,
      startedAt: announce ? now : state.startedAt,
      timer: setTimeout(stopTyping, TYPING_IDLE),
    };
  }, [stopTyping]);

  /* ---------- selection ---------- */

  const openConversation = useCallback(
    (conversation) => {
      if (!conversation?._id) return;
      const same = currentIdRef.current === conversation._id;
      if (!same) {
        stopTyping();
        setMessages([]);
      }
      currentIdRef.current = conversation._id;
      setCurrentConversation(conversation);
      fetchMessages(conversation._id, { silent: same });
    },
    [fetchMessages, stopTyping],
  );

  const closeConversation = useCallback(() => {
    stopTyping();
    currentIdRef.current = null;
    messagesRequestRef.current += 1; // ignore in-flight message fetches
    setCurrentConversation(null);
    setMessages([]);
    setLoadingMessages(false);
  }, [stopTyping]);

  /* ---------- incoming ---------- */

  const clearPending = useCallback(() => {
    clearTimeout(pendingSendRef.current?.timer);
    pendingSendRef.current = null;
  }, []);

  // The server refused a send because the players aren't friends: make the thread read-only
  const lockConversation = useCallback((conversationId) => {
    const lock = (c) => (c?._id === conversationId ? { ...c, isFriend: false, canMessage: false } : c);
    setConversations((prev) => prev.map(lock));
    setCurrentConversation(lock);
  }, []);

  const clearRemoteTyping = useCallback((conversationId, userId) => {
    const key = `${conversationId}:${userId}`;
    clearTimeout(remoteTypingTimers.current[key]);
    delete remoteTypingTimers.current[key];
    setTypingUsers((prev) => {
      const list = prev[conversationId];
      if (!list?.includes(userId)) return prev;
      return { ...prev, [conversationId]: list.filter((id) => id !== userId) };
    });
  }, []);

  const receiveMessage = useCallback(
    (message) => {
      if (!message?._id) return;
      const conversationId = conversationIdOf(message);
      const senderId = idOf(message.sender);

      if (conversationId && conversationId === currentIdRef.current) {
        setMessages((prev) => appendUnique(prev, message));
      }
      if (senderId === me && pendingSendRef.current?.conversationId === conversationId) clearPending();
      if (senderId && senderId !== me) clearRemoteTyping(conversationId, senderId);

      if (!conversationsRef.current.some((c) => c._id === conversationId)) {
        fetchConversations(); // a thread we don't know about yet
        return;
      }
      setConversations((prev) => {
        const conversation = prev.find((c) => c._id === conversationId);
        if (!conversation) return prev;
        const last = conversation.lastMessage;
        if (last?._id === message._id) return prev;
        if (last?.createdAt && new Date(message.createdAt) < new Date(last.createdAt)) return prev;
        return upsertTop(prev, { ...conversation, lastMessage: message, updatedAt: message.createdAt });
      });
    },
    [me, clearPending, clearRemoteTyping, fetchConversations],
  );

  // Socket listeners — named handlers so we only remove our own on cleanup
  useEffect(() => {
    if (!socket) return undefined;

    const onNewMessage = (message) => receiveMessage(message);

    const onConversationUpdated = (conversation) => {
      if (!conversation?._id) return;
      setConversations((prev) => {
        const existing = prev.find((c) => c._id === conversation._id);
        return upsertTop(prev, existing ? { ...existing, ...conversation } : conversation);
      });
      if (conversation._id === currentIdRef.current) {
        setCurrentConversation((cur) => (cur?._id === conversation._id ? { ...cur, ...conversation } : cur));
        const last = conversation.lastMessage;
        // Backup path in case the room broadcast was missed
        if (last && typeof last === "object" && last._id) {
          setMessages((prev) => appendUnique(prev, last));
          if (idOf(last.sender) === me && pendingSendRef.current?.conversationId === conversation._id) {
            clearPending();
          }
        }
      }
    };

    const onUserTyping = ({ userId, conversationId } = {}) => {
      const uid = idOf(userId);
      const cid = idOf(conversationId);
      if (!uid || !cid || uid === me) return;
      setTypingUsers((prev) => {
        const list = prev[cid] || [];
        return list.includes(uid) ? prev : { ...prev, [cid]: [...list, uid] };
      });
      const key = `${cid}:${uid}`;
      clearTimeout(remoteTypingTimers.current[key]);
      remoteTypingTimers.current[key] = setTimeout(() => clearRemoteTyping(cid, uid), TYPING_EXPIRE);
    };

    const onUserStopTyping = ({ userId, conversationId } = {}) => {
      if (userId && conversationId) clearRemoteTyping(idOf(conversationId), idOf(userId));
    };

    const onMessageRead = ({ messageId, userId } = {}) => {
      const uid = idOf(userId);
      if (!messageId || !uid) return;
      setMessages((prev) =>
        prev.some((m) => m._id === messageId && !hasReadBy(m, uid))
          ? prev.map((m) => (m._id === messageId ? addReadBy(m, uid) : m))
          : prev,
      );
      setConversations((prev) =>
        prev.some((c) => c.lastMessage?._id === messageId && !hasReadBy(c.lastMessage, uid))
          ? prev.map((c) =>
              c.lastMessage?._id === messageId ? { ...c, lastMessage: addReadBy(c.lastMessage, uid) } : c,
            )
          : prev,
      );
    };

    // A player edited their profile (name / avatar): patch conversation members and message senders
    const onUserUpdated = ({ userId, profile } = {}) => {
      const uid = idOf(userId);
      if (!uid || !profile) return;
      const patchUser = (u) => (u && typeof u === "object" && idOf(u) === uid ? { ...u, profile: { ...u.profile, ...profile } } : u);
      const hasMember = (c) => c?.members?.some((m) => idOf(m) === uid);
      const patchConversation = (c) => (hasMember(c) ? { ...c, members: c.members.map(patchUser) } : c);
      setConversations((prev) => (prev.some(hasMember) ? prev.map(patchConversation) : prev));
      setCurrentConversation((cur) => (hasMember(cur) ? patchConversation(cur) : cur));
      setMessages((prev) =>
        prev.some((m) => idOf(m.sender) === uid)
          ? prev.map((m) => (idOf(m.sender) === uid ? { ...m, sender: patchUser(m.sender) } : m))
          : prev,
      );
    };

    const onError = (error) => {
      const text = error?.message || "Something went wrong";
      const pending = pendingSendRef.current;
      const forbidden = error?.code === CHAT_FORBIDDEN;
      if (pending && (SEND_ERRORS.includes(text) || forbidden)) {
        clearPending();
        if (forbidden) lockConversation(pending.conversationId);
        toast.error(`Message not sent: ${text}`);
        onSendFailedRef.current?.(pending.content, pending.conversationId);
      } else {
        console.warn("Socket error:", text);
      }
    };

    socket.on("new-message", onNewMessage);
    socket.on("conversation-updated", onConversationUpdated);
    socket.on("user-typing", onUserTyping);
    socket.on("user-stop-typing", onUserStopTyping);
    socket.on("message-read", onMessageRead);
    socket.on("user:updated", onUserUpdated);
    socket.on("error", onError);

    return () => {
      socket.off("new-message", onNewMessage);
      socket.off("conversation-updated", onConversationUpdated);
      socket.off("user-typing", onUserTyping);
      socket.off("user-stop-typing", onUserStopTyping);
      socket.off("message-read", onMessageRead);
      socket.off("user:updated", onUserUpdated);
      socket.off("error", onError);
    };
  }, [socket, me, receiveMessage, clearPending, clearRemoteTyping, lockConversation]);

  /* ---------- rooms ---------- */

  // The server doesn't auto-join conversation rooms, so join every conversation we know about
  // (needed to receive new-message / typing events) and re-join after every reconnect.
  const roomKey = useMemo(() => {
    const ids = new Set(conversations.map((c) => c._id));
    if (currentConversation?._id) ids.add(currentConversation._id);
    return [...ids].sort().join(",");
  }, [conversations, currentConversation?._id]);

  useEffect(() => {
    if (!socket || !isConnected) {
      joinedRef.current = new Set();
      return;
    }
    roomKey
      .split(",")
      .filter(Boolean)
      .forEach((id) => {
        if (joinedRef.current.has(id)) return;
        socket.emit("join-conversation", id);
        joinedRef.current.add(id);
      });
  }, [socket, isConnected, roomKey]);

  // Leave the rooms when the chat unmounts (or the socket is replaced)
  useEffect(
    () => () => {
      if (socket?.connected) joinedRef.current.forEach((id) => socket.emit("leave-conversation", id));
      joinedRef.current = new Set();
    },
    [socket],
  );

  // After a reconnect (not the first connect), catch up on anything missed while offline
  const linkRef = useRef({ was: isConnected, ever: isConnected });
  useEffect(() => {
    const link = linkRef.current;
    if (isConnected && !link.was && link.ever) {
      fetchConversations();
      if (currentIdRef.current) fetchMessages(currentIdRef.current, { silent: true });
    }
    link.was = isConnected;
    if (isConnected) link.ever = true;
  }, [isConnected, fetchConversations, fetchMessages]);

  /* ---------- read receipts ---------- */

  useEffect(() => {
    const onVisibility = () => setPageVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const currentId = currentConversation?._id;
  useEffect(() => {
    if (!currentId || !socket || !isConnected || !pageVisible || !me) return;
    const unread = messages.filter(
      (m) =>
        m._id &&
        conversationIdOf(m) === currentId &&
        idOf(m.sender) !== me &&
        !hasReadBy(m, me) &&
        !markedRef.current.has(m._id),
    );
    if (!unread.length) return;
    const ids = new Set();
    unread.forEach((m) => {
      ids.add(m._id);
      markedRef.current.add(m._id);
      socket.emit("mark-as-read", { messageId: m._id, conversationId: currentId });
    });
    setMessages((prev) => prev.map((m) => (ids.has(m._id) ? addReadBy(m, me) : m)));
    setConversations((prev) =>
      prev.map((c) =>
        c._id === currentId && c.lastMessage && ids.has(c.lastMessage._id)
          ? { ...c, lastMessage: addReadBy(c.lastMessage, me) }
          : c,
      ),
    );
  }, [messages, currentId, socket, isConnected, pageVisible, me]);

  /* ---------- sending ---------- */

  // Resolves true once the message has been handed off (socket) or saved (HTTP fallback).
  const sendMessage = useCallback(
    async (rawContent) => {
      const content = String(rawContent ?? "").trim();
      const conversationId = currentIdRef.current;
      if (!content || !conversationId) return false;
      stopTyping();

      const live = liveSocketRef.current;
      if (live) {
        clearPending();
        const timer = setTimeout(() => {
          if (pendingSendRef.current?.timer !== timer) return;
          pendingSendRef.current = null;
          if (currentIdRef.current === conversationId) fetchMessages(conversationId, { silent: true });
        }, SEND_TIMEOUT);
        pendingSendRef.current = { conversationId, content, timer };
        live.emit("send-message", { conversationId, content, type: "text" });
        return true;
      }

      // Realtime link is down — POST /api/chat/messages saves it; the other side sees it on next load
      setSending(true);
      try {
        const response = await axios.post(
          `${API_URL}/api/chat/messages`,
          { conversationId, content, type: "text" },
          { withCredentials: true },
        );
        if (response.data?.success && response.data.message?._id) {
          receiveMessage(response.data.message);
          return true;
        }
        toast.error("Message not sent");
        return false;
      } catch (error) {
        console.error("Error sending message:", error);
        if (error.response?.data?.code === CHAT_FORBIDDEN) lockConversation(conversationId);
        toast.error(error.response?.data?.message || "Message not sent");
        return false;
      } finally {
        setSending(false);
      }
    },
    [stopTyping, clearPending, fetchMessages, receiveMessage, lockConversation],
  );

  // Photo / video / audio / file with an optional caption. Always HTTP (multipart); the server
  // then delivers it live like any other message. Resolves true once saved.
  const sendAttachment = useCallback(
    async (file, caption = "", { onProgress } = {}) => {
      const conversationId = currentIdRef.current;
      if (!file || !conversationId) return false;
      stopTyping();

      const form = new FormData();
      form.append("conversationId", conversationId);
      form.append("content", String(caption ?? "").trim());
      form.append("file", file);
      try {
        const response = await axios.post(`${API_URL}/api/chat/messages/attachment`, form, {
          withCredentials: true,
          onUploadProgress: (e) => e.total && onProgress?.(Math.round((e.loaded / e.total) * 100)),
        });
        if (response.data?.success && response.data.message?._id) {
          receiveMessage(response.data.message);
          return true;
        }
        toast.error("File not sent");
        return false;
      } catch (error) {
        console.error("Error sending attachment:", error);
        if (error.response?.data?.code === CHAT_FORBIDDEN) lockConversation(conversationId);
        toast.error(error.response?.data?.message || "File not sent");
        return false;
      }
    },
    [stopTyping, receiveMessage, lockConversation],
  );

  // Cleanup timers on unmount
  useEffect(
    () => () => {
      stopTyping();
      clearTimeout(pendingSendRef.current?.timer);
      Object.values(remoteTypingTimers.current).forEach(clearTimeout);
      remoteTypingTimers.current = {};
    },
    [stopTyping],
  );

  return {
    conversations,
    setConversations,
    messages,
    setMessages,
    typingUsers,
    fetchConversations,
    fetchMessages,
    startConversation,
    currentConversation,
    openConversation,
    closeConversation,
    sendMessage,
    sendAttachment,
    notifyTyping,
    stopTyping,
    loadingConversations,
    conversationsError,
    loadingMessages,
    sending,
    isConnected,
    socket,
  };
};

export default useChat;
