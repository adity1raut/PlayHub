import { Check, CheckCheck } from "lucide-react";
import { cn } from "../../../lib/cn";
import { idOf } from "../hooks/useChat";

const MessageBubble = ({ message, user, formatTime }) => {
  const me = idOf(user);
  const isOwnMessage = idOf(message.sender) === me;
  const readByOther = isOwnMessage && (message.readBy || []).some((r) => idOf(r?.user ?? r) !== me);

  return (
    <div className={cn("flex", isOwnMessage ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] min-w-0 border px-3 py-2 text-xs",
          isOwnMessage
            ? "border-primary/40 border-r-2 border-r-primary bg-primary/10 text-foreground"
            : "border-border border-l-2 border-l-border-strong bg-muted text-muted-foreground",
        )}
      >
        <p className="leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">{message.content}</p>
        <p className="mt-1 flex items-center justify-end gap-1.5 text-[10px] text-faint tabular-nums">
          {message.edited && <span>edited ·</span>}
          <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
          {isOwnMessage &&
            (readByOther ? (
              <>
                <CheckCheck className="size-3 text-primary" aria-hidden="true" />
                <span className="sr-only">Read</span>
              </>
            ) : (
              <>
                <Check className="size-3" aria-hidden="true" />
                <span className="sr-only">Sent</span>
              </>
            ))}
        </p>
      </div>
    </div>
  );
};

export default MessageBubble;
