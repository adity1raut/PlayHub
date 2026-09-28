import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, MessageSquare } from "lucide-react";
import { EmptyState, LoadingBlock } from "../../../components/ui";
import { idOf } from "../hooks/useChat";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";

const NEAR_BOTTOM = 120; // px from the bottom that still counts as "following" the thread

const dayLabel = (date) => {
  const now = new Date();
  const start = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((start(now) - start(date)) / 864e5);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return date.toLocaleDateString([], {
    weekday: "short",
    day: "2-digit",
    month: "short",
    ...(date.getFullYear() !== now.getFullYear() && { year: "numeric" }),
  });
};

const DateSeparator = ({ label }) => (
  <div role="separator" aria-label={label} className="eyebrow flex items-center gap-3 py-1 text-faint">
    <span aria-hidden="true" className="h-px flex-1 border-t border-dashed border-border-strong" />
    <span>{"// "}{label}</span>
    <span aria-hidden="true" className="h-px flex-1 border-t border-dashed border-border-strong" />
  </div>
);

const MessagesList = ({
  conversationId,
  messages,
  user,
  otherUser,
  isUserTyping,
  loading = false,
  messagesEndRef,
  formatTime,
}) => {
  const scrollRef = useRef(null);
  const followRef = useRef(true);
  const [showJump, setShowJump] = useState(false);
  const lastMessage = messages[messages.length - 1];

  const scrollToBottom = (behavior = "smooth") => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior });
  };

  // Jump to the latest message when a thread opens / finishes loading
  useLayoutEffect(() => {
    if (loading) return;
    scrollToBottom("auto");
    followRef.current = true;
    setShowJump(false);
  }, [conversationId, loading]);

  // New message: follow it if we're at the bottom or we sent it
  useEffect(() => {
    if (!lastMessage) return;
    if (followRef.current || idOf(lastMessage.sender) === idOf(user)) scrollToBottom();
  }, [lastMessage?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isUserTyping && followRef.current) scrollToBottom();
  }, [isUserTyping]);

  // Photos / videos grow the thread after they load: stay pinned to the bottom while following
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const onMediaLoad = () => followRef.current && el.scrollTo({ top: el.scrollHeight });
    el.addEventListener("load", onMediaLoad, true);
    el.addEventListener("loadedmetadata", onMediaLoad, true);
    return () => {
      el.removeEventListener("load", onMediaLoad, true);
      el.removeEventListener("loadedmetadata", onMediaLoad, true);
    };
  }, []);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM;
    followRef.current = near;
    setShowJump(!near);
  };

  let lastDay = null;
  const otherName = otherUser?.profile?.name || otherUser?.username;

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        role="log"
        aria-label="Messages"
        className="h-full space-y-3 overflow-y-auto bg-grid px-4 py-4 scrollbar-thin"
      >
        {loading && messages.length === 0 ? (
          <LoadingBlock label="Loading messages" className="h-full py-0" />
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <EmptyState
              icon={MessageSquare}
              title="No messages yet"
              description={otherName ? `Say hello to ${otherName}.` : "Say hello."}
            />
          </div>
        ) : (
          messages.map((message) => {
            const date = new Date(message.createdAt);
            const day = Number.isNaN(date.getTime()) ? null : date.toDateString();
            const separator = day && day !== lastDay ? <DateSeparator label={dayLabel(date)} /> : null;
            if (day) lastDay = day;
            return (
              <Fragment key={message._id}>
                {separator}
                <MessageBubble message={message} user={user} formatTime={formatTime} />
              </Fragment>
            );
          })
        )}

        {isUserTyping && <TypingIndicator name={otherName} />}
        <div ref={messagesEndRef} aria-hidden="true" />
      </div>

      {showJump && (
        <button
          type="button"
          onClick={() => scrollToBottom()}
          aria-label="Jump to latest messages"
          className="absolute right-4 bottom-4 flex size-9 items-center justify-center border border-primary/50 bg-popover text-primary shadow-float hover:bg-primary/15"
        >
          <ArrowDown className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
};

export default MessagesList;
