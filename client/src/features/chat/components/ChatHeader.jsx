import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Avatar, Badge, IconButton, StatusDot } from "../../../components/ui";
import { cn } from "../../../lib/cn";

const ChatHeader = ({ currentConversation, setActiveView, onBack, getOtherUser, isTyping = false, isConnected = true }) => {
  const otherUser = getOtherUser(currentConversation);
  const name = otherUser?.profile?.name || otherUser?.username || "Unknown player";
  const handleBack = onBack ?? (() => setActiveView?.("conversations"));

  const identity = (
    <>
      <Avatar src={otherUser?.profile?.profileImage} name={name} size="sm" />
      <span className="min-w-0">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-xs font-extrabold tracking-[0.06em] text-foreground uppercase">{name}</span>
          {currentConversation?.isFriend && <Badge variant="success">Friend</Badge>}
        </span>
        <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px]">
          {otherUser?.username && <span className="truncate text-muted-foreground">@{otherUser.username}</span>}
          {isTyping && (
            <span className="shrink-0 text-primary" aria-live="polite">
              {otherUser?.username && <span className="text-faint">· </span>}
              typing…
            </span>
          )}
        </span>
      </span>
    </>
  );

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card px-4">
      <IconButton
        icon={ArrowLeft}
        label="Back to conversations"
        size="sm"
        className="-ml-2 md:hidden"
        onClick={handleBack}
      />

      {otherUser?.username ? (
        <Link
          to={`/profile/${otherUser.username}`}
          title={`View ${name}'s profile`}
          className="flex min-w-0 flex-1 items-center gap-3 border border-transparent p-1 hover:border-border hover:bg-accent"
        >
          {identity}
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3 p-1">{identity}</div>
      )}

      <span
        role="status"
        className={cn(
          "eyebrow shrink-0 items-center gap-2",
          isConnected ? "hidden text-faint sm:flex" : "flex text-warning",
        )}
      >
        <StatusDot tone={isConnected ? "success" : "danger"} pulse={!isConnected} />
        {isConnected ? "Link.Online" : "Link.Reconnecting"}
      </span>
    </header>
  );
};

export default ChatHeader;
