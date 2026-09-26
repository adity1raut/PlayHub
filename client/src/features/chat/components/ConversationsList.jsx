import { MessagesSquare, RefreshCw, SquarePen } from "lucide-react";
import { Alert, Avatar, Button, EmptyState, Skeleton } from "../../../components/ui";
import { cn } from "../../../lib/cn";
import { hasReadBy, idOf } from "../hooks/useChat";

const ConversationsList = ({
  conversations,
  user,
  openConversation,
  getOtherUser,
  formatTime,
  currentConversationId,
  typingUsers = {},
  loading = false,
  error,
  onRetry,
  onNewChat,
}) => {
  const me = idOf(user);

  if (loading && conversations.length === 0) {
    return (
      <div role="status">
        <span className="sr-only">Loading conversations</span>
        <ul aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <li key={i} className="flex items-center gap-3 border-l-2 border-transparent px-4 py-2.5">
              <Skeleton className="size-10" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-2.5 w-3/4" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (error && conversations.length === 0) {
    return (
      <div className="space-y-3 p-4">
        <Alert variant="destructive" title="Couldn't load chats">
          {error}
        </Alert>
        {onRetry && (
          <Button size="sm" variant="outline" icon={RefreshCw} onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <EmptyState
        icon={MessagesSquare}
        title="No conversations yet"
        description="Search a player by @username to start your first chat."
        action={
          onNewChat && (
            <Button size="sm" icon={SquarePen} onClick={onNewChat}>
              New message
            </Button>
          )
        }
      />
    );
  }

  return (
    <ul>
      {conversations.map((conversation) => {
        const otherUser = getOtherUser(conversation);
        const name = otherUser?.profile?.name || otherUser?.username || "Unknown player";
        const active = conversation._id === currentConversationId;
        const last =
          conversation.lastMessage && typeof conversation.lastMessage === "object" ? conversation.lastMessage : null;
        const mine = last && idOf(last.sender) === me;
        const unread = Boolean(last && !mine && !active && !hasReadBy(last, me));
        const typing = (typingUsers[conversation._id] || []).length > 0;

        return (
          <li key={conversation._id}>
            <button
              type="button"
              onClick={() => openConversation(conversation)}
              aria-current={active ? "true" : undefined}
              className={cn(
                "flex w-full items-center gap-3 border-l-2 px-4 py-2.5 text-left transition-colors",
                active ? "border-primary bg-primary/10" : "border-transparent hover:bg-accent",
              )}
            >
              <Avatar src={otherUser?.profile?.profileImage} name={name} size="md" />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className={cn("truncate text-xs text-foreground", unread ? "font-extrabold" : "font-bold")}>
                    {name}
                  </span>
                  {last?.createdAt && (
                    <time dateTime={last.createdAt} className="shrink-0 text-[11px] text-faint tabular-nums">
                      {formatTime(last.createdAt)}
                    </time>
                  )}
                </span>
                <span className="mt-0.5 flex items-center justify-between gap-2">
                  {typing ? (
                    <span className="truncate text-[11px] text-primary">typing…</span>
                  ) : last ? (
                    <span className={cn("truncate text-[11px]", unread ? "text-foreground" : "text-muted-foreground")}>
                      {mine && <span className="text-faint">You: </span>}
                      {last.content}
                    </span>
                  ) : (
                    <span className="truncate text-[11px] text-faint">
                      @{otherUser?.username ?? "player"} · no messages yet
                    </span>
                  )}
                  {unread && (
                    <span className="flex shrink-0 items-center">
                      <span aria-hidden="true" className="size-1.5 bg-primary shadow-[0_0_6px_var(--primary)]" />
                      <span className="sr-only">Unread</span>
                    </span>
                  )}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
};

export default ConversationsList;
