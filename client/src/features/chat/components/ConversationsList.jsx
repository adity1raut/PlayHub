import { Lock, MessagesSquare, RefreshCw, SquarePen } from "lucide-react";
import { Alert, Avatar, Button, EmptyState, Skeleton } from "../../../components/ui";
import { cn } from "../../../lib/cn";
import { canMessageIn, hasReadBy, idOf } from "../hooks/useChat";
import { attachmentSummary } from "../attachments";

/** Last-message preview: the text, or an icon + "Photo" / "Video" / file name for attachments. */
const LastMessagePreview = ({ message }) => {
  const summary = attachmentSummary(message);
  if (!summary) return message.content;
  const Icon = summary.icon;
  return (
    <>
      <Icon className="mr-1 inline size-3 align-[-2px]" aria-hidden="true" />
      {message.content || summary.label}
    </>
  );
};

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
        description="Friends — players who follow each other — can chat. Pick a friend to start your first conversation."
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
                  <span
                    className={cn(
                      "flex min-w-0 items-center gap-1.5 text-xs text-foreground",
                      unread ? "font-extrabold" : "font-bold",
                    )}
                  >
                    <span className="truncate">{name}</span>
                    {!canMessageIn(conversation) && (
                      <span title="Read-only: you're not friends" className="shrink-0 text-faint">
                        <Lock className="size-3" aria-hidden="true" />
                        <span className="sr-only">(read-only, not friends)</span>
                      </span>
                    )}
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
                      <LastMessagePreview message={last} />
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
