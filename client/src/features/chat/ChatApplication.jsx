import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { cn } from "../../lib/cn";
import { toast } from "../../lib/toast";
import { useSocketEvent } from "../../lib/useSocketEvent";
import useChat, { canMessageIn, idOf } from "./hooks/useChat";
import useSearch from "./hooks/useSearch";
import useFriends from "./hooks/useFriends";
import { attachmentProblem } from "./attachments";
import Sidebar from "./components/Sidebar";
import ChatArea from "./components/ChatArea";
import WelcomeScreen from "./components/WelcomeScreen";

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

// Conversation list stamp: time today, "Yesterday", weekday this week, else a short date
const formatTime = (timestamp) => {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 864e5);
  if (days <= 0) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (days === 1) return "Yesterday";
  if (days < 7) return date.toLocaleDateString([], { weekday: "short" });
  return date.toLocaleDateString([], {
    day: "2-digit",
    month: "short",
    ...(date.getFullYear() !== now.getFullYear() && { year: "2-digit" }),
  });
};

// Message bubble stamp (the date lives in the day separators)
const formatClock = (timestamp) => {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const ChatApplication = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const params = useParams();

  // "conversations" | "search" (player search in the list) | "chat" (thread visible on mobile)
  const [activeView, setActiveView] = useState("conversations");
  const [drafts, setDrafts] = useState({});
  const searchInputRef = useRef(null);

  const setDraft = useCallback(
    (conversationId, value) =>
      conversationId &&
      setDrafts((prev) => ({
        ...prev,
        [conversationId]: typeof value === "function" ? value(prev[conversationId] ?? "") : value,
      })),
    [],
  );

  const chat = useChat(socket, {
    // Put the text back if the server rejected it (unless the user already typed something new)
    onSendFailed: (content, conversationId) => setDraft(conversationId, (cur) => (cur.trim() ? cur : content)),
  });
  const {
    conversations,
    messages,
    typingUsers,
    currentConversation,
    isConnected,
    fetchConversations,
    loadingConversations,
    openConversation: selectConversation,
    startConversation: createConversation,
    closeConversation,
    notifyTyping,
    stopTyping,
  } = chat;
  const { searchResults, searchQuery, setSearchQuery, searchType, setSearchType, loading } = useSearch();
  // The sidebar lists friends whenever it's searching (see Sidebar `searching`)
  const friendsShown = activeView === "search" || searchQuery.trim().length > 0;
  const friends = useFriends(friendsShown);

  const currentId = currentConversation?._id ?? null;
  const messageInput = (currentId && drafts[currentId]) || "";

  // A file picked for the open thread, and the upload in flight (one at a time)
  const [attachment, setAttachment] = useState(null); // { file, conversationId }
  const [upload, setUpload] = useState(null); // { conversationId, progress: 0-100 }
  const pendingFile = attachment?.conversationId === currentId ? attachment.file : null;
  const uploadProgress = upload?.conversationId === currentId ? upload.progress : null;

  const attachFile = (file) => {
    const problem = attachmentProblem(file);
    if (problem) toast.error(problem);
    else if (currentId) setAttachment({ file, conversationId: currentId });
  };
  const removeAttachment = () => setAttachment(null);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Following / unfollowing makes or breaks friendships, which opens or locks threads
  useSocketEvent("follow:updated", (e = {}) => {
    const me = idOf(user);
    if (!me || (e.targetId !== me && e.followerId !== me)) return;
    fetchConversations();
    if (friendsShown) friends.refresh();
  });

  // Other member of a 1:1 conversation (members are populated user docs)
  const getOtherUser = useCallback(
    (conversation) => {
      const members = (conversation?.members || []).filter((m) => m && typeof m === "object");
      return members.find((m) => idOf(m) !== idOf(user)) || members[0] || null;
    },
    [user],
  );

  const openConversation = useCallback(
    (conversation) => {
      selectConversation(conversation);
      setActiveView("chat");
    },
    [selectConversation],
  );

  const startConversation = useCallback(
    async (userId) => {
      const conversation = await createConversation(userId);
      if (conversation) {
        openConversation(conversation);
        setSearchQuery("");
      }
      return conversation;
    },
    [createConversation, openConversation, setSearchQuery],
  );

  const backToList = () => {
    closeConversation();
    setActiveView("conversations");
  };

  const startNewChat = () => {
    setActiveView("search");
    requestAnimationFrame(() => searchInputRef.current?.focus());
  };

  const endSearch = () => {
    setSearchQuery("");
    setActiveView(currentId ? "chat" : "conversations");
  };

  /* ---------- deep links ----------
   * router state: { openChat: { id, username } } | { startChatWith: user } | { conversationId }
   * query:        ?user=<userId> | ?conversation=<conversationId>
   * path:         /chat/:conversationId (if the route is registered)
   */
  const navState = location.state || {};
  const targetUserId =
    idOf(navState.openChat?.id ?? navState.openChat?.userId ?? navState.openChat?._id) ||
    idOf(navState.startChatWith) ||
    searchParams.get("user") ||
    "";
  const targetConversationId =
    idOf(navState.openChat?.conversationId) ||
    idOf(navState.conversationId) ||
    searchParams.get("conversation") ||
    params.conversationId ||
    "";
  const handledLinkRef = useRef(null);

  useEffect(() => {
    if (!user?._id || (!targetUserId && !targetConversationId)) return;
    const key = `${location.key}|${targetUserId}|${targetConversationId}`;
    if (handledLinkRef.current === key) return;
    if (!targetUserId && loadingConversations) return; // wait for the list to select from it
    handledLinkRef.current = key;

    if (targetUserId) {
      startConversation(targetUserId);
    } else {
      const conversation = conversations.find((c) => c._id === targetConversationId);
      if (conversation) openConversation(conversation);
      else toast.error("That conversation is no longer available");
    }

    // Clear the one-shot state / query so a refresh or back navigation doesn't re-trigger it
    const hasQuery = searchParams.has("user") || searchParams.has("conversation");
    if (location.state || hasQuery) {
      const next = new URLSearchParams(searchParams);
      next.delete("user");
      next.delete("conversation");
      const search = next.toString();
      navigate(
        { pathname: location.pathname, search: search ? `?${search}` : "", hash: location.hash },
        { replace: true, state: null },
      );
    }
  }, [
    user?._id,
    location.key,
    location.pathname,
    location.hash,
    location.state,
    searchParams,
    targetUserId,
    targetConversationId,
    loadingConversations,
    conversations,
    startConversation,
    openConversation,
    navigate,
  ]);

  /* ---------- composer ---------- */

  const sendMessage = async () => {
    const conversationId = currentId;
    const content = messageInput;
    if (!conversationId || chat.sending) return;

    // With a file attached, the text becomes its caption
    if (pendingFile) {
      if (upload) return;
      setDraft(conversationId, "");
      setUpload({ conversationId, progress: 0 });
      const sent = await chat.sendAttachment(pendingFile, content, {
        onProgress: (progress) => setUpload({ conversationId, progress }),
      });
      setUpload(null);
      if (sent) setAttachment((cur) => (cur?.file === pendingFile ? null : cur));
      else setDraft(conversationId, (cur) => (cur.trim() ? cur : content));
      return;
    }

    if (!content.trim()) return;
    setDraft(conversationId, "");
    const sent = await chat.sendMessage(content);
    if (!sent) setDraft(conversationId, (cur) => (cur.trim() ? cur : content));
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleInputChange = (e) => {
    setDraft(currentId, e.target.value);
    if (e.target.value.trim()) notifyTyping();
    else stopTyping();
  };

  const handleTypingStop = () => stopTyping();

  const isUserTyping = Boolean(currentId && typingUsers[currentId]?.length);
  const showThread = Boolean(currentConversation) && activeView === "chat";
  const otherUser = currentConversation ? getOtherUser(currentConversation) : null;

  return (
    <div className="flex h-full min-h-0">
      <Sidebar
        className={showThread ? "hidden md:flex" : "flex"}
        activeView={activeView}
        setActiveView={setActiveView}
        conversations={conversations}
        searchResults={searchResults}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchType={searchType}
        setSearchType={setSearchType}
        loading={loading}
        user={user}
        openConversation={openConversation}
        startConversation={startConversation}
        getOtherUser={getOtherUser}
        formatTime={formatTime}
        currentConversationId={currentId}
        typingUsers={typingUsers}
        loadingConversations={loadingConversations}
        conversationsError={chat.conversationsError}
        onRetry={fetchConversations}
        onNewChat={startNewChat}
        onEndSearch={endSearch}
        isConnected={isConnected}
        searchInputRef={searchInputRef}
        friends={friends.friends}
        friendsLoading={friends.loading}
      />

      <section
        aria-label={
          otherUser ? `Chat with ${otherUser.profile?.name || otherUser.username}` : "Chat"
        }
        className={cn("min-h-0 min-w-0 flex-1 flex-col bg-background", showThread ? "flex" : "hidden md:flex")}
      >
        {currentConversation ? (
          <ChatArea
            currentConversation={currentConversation}
            messages={messages}
            messageInput={messageInput}
            user={user}
            isUserTyping={isUserTyping}
            setActiveView={setActiveView}
            onBack={backToList}
            getOtherUser={getOtherUser}
            formatTime={formatClock}
            handleInputChange={handleInputChange}
            handleKeyPress={handleKeyPress}
            handleTypingStop={handleTypingStop}
            sendMessage={sendMessage}
            isConnected={isConnected}
            loadingMessages={chat.loadingMessages}
            sending={chat.sending}
            canMessage={canMessageIn(currentConversation)}
            attachment={pendingFile}
            onAttach={attachFile}
            onRemoveAttachment={removeAttachment}
            uploadProgress={uploadProgress}
            uploadBusy={Boolean(upload)}
          />
        ) : (
          <WelcomeScreen onNewChat={startNewChat} />
        )}
      </section>
    </div>
  );
};

export default ChatApplication;
