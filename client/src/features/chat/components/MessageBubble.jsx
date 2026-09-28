import { Check, CheckCheck, Download } from "lucide-react";
import { cn } from "../../../lib/cn";
import { mediaUrl } from "../../../lib/config";
import { idOf } from "../hooks/useChat";
import { attachmentKind, fileIcon, formatBytes } from "../attachments";

/** Photo / video / audio player, or a download card for other files. */
const Attachment = ({ attachment }) => {
  const url = mediaUrl(attachment.url);
  const name = attachment.originalName || "Attachment";

  switch (attachmentKind(attachment.mimetype)) {
    case "image":
      return (
        <a href={url} target="_blank" rel="noreferrer" title="Open full size" className="block">
          <img
            src={url}
            alt={name}
            loading="lazy"
            className="max-h-80 w-full border border-border bg-background/60 object-contain"
          />
        </a>
      );
    case "video":
      return (
        <video
          src={url}
          controls
          playsInline
          preload="metadata"
          aria-label={name}
          className="max-h-80 w-full border border-border bg-black"
        />
      );
    case "audio":
      return <audio src={url} controls preload="metadata" aria-label={name} className="w-full min-w-56" />;
    default: {
      const Icon = fileIcon(attachment.mimetype);
      const ext = name.includes(".") ? name.split(".").pop().toUpperCase() : "FILE";
      return (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          download={name}
          className="group flex min-w-0 items-center gap-3 border border-border bg-background/60 p-2.5 transition-colors hover:border-primary/50"
        >
          <span className="flex size-9 shrink-0 items-center justify-center border border-border-strong bg-muted text-primary">
            <Icon className="size-4" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-bold text-foreground">{name}</span>
            <span className="block text-[10px] text-faint tabular-nums">
              {ext}
              {attachment.size ? ` · ${formatBytes(attachment.size)}` : ""}
            </span>
          </span>
          <Download className="size-4 shrink-0 text-faint group-hover:text-primary" aria-hidden="true" />
          <span className="sr-only">Download</span>
        </a>
      );
    }
  }
};

const MessageBubble = ({ message, user, formatTime }) => {
  const me = idOf(user);
  const isOwnMessage = idOf(message.sender) === me;
  const readByOther = isOwnMessage && (message.readBy || []).some((r) => idOf(r?.user ?? r) !== me);
  const attachments = message.attachments || [];

  return (
    <div className={cn("flex", isOwnMessage ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] min-w-0 border px-3 py-2 text-xs",
          attachments.length > 0 && "w-80 space-y-2 px-2 pt-2",
          isOwnMessage
            ? "border-primary/40 border-r-2 border-r-primary bg-primary/10 text-foreground"
            : "border-border border-l-2 border-l-border-strong bg-muted text-muted-foreground",
        )}
      >
        {attachments.map((attachment, i) => (
          <Attachment key={attachment._id ?? i} attachment={attachment} />
        ))}
        {message.content && (
          <p className={cn("leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]", attachments.length > 0 && "px-1")}>
            {message.content}
          </p>
        )}
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
