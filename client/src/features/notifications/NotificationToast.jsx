import { X } from "lucide-react";
import { Avatar, IconButton, StatusDot } from "../../components/ui";
import { formatTimeAgo, senderOf, typeMeta } from "./notificationMeta";

/**
 * Body of the in-app notification pop-up (rendered by the app-wide toast viewport).
 * Clicking it opens the notification; the X only dismisses it.
 */
function NotificationToast({ notification, onOpen, onDismiss }) {
  const meta = typeMeta(notification.type);
  const TypeIcon = meta.icon;
  const from = senderOf(notification);
  const fromName = from?.profile?.name || from?.username;
  const live = notification.type === "STREAM_START";

  return (
    <div className="flex w-72 max-w-full items-start gap-1 text-left whitespace-normal">
      <button
        type="button"
        onClick={onOpen}
        className="group flex min-w-0 flex-1 items-start gap-3 py-1 pl-1 text-left focus-visible:outline-1 focus-visible:outline-primary"
      >
        {from ? (
          <Avatar src={from.profile?.profileImage} name={fromName} size="sm" />
        ) : (
          <span className="flex size-8 shrink-0 items-center justify-center border border-border-strong bg-muted text-primary">
            <TypeIcon className="size-4" aria-hidden="true" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            <StatusDot tone={live ? "danger" : "info"} pulse />
            <span className="eyebrow truncate text-primary">{meta.title}</span>
            <span className="ml-auto shrink-0 text-[10px] text-faint">
              {formatTimeAgo(notification.createdAt || Date.now())}
            </span>
          </span>
          <span className="mt-1 line-clamp-2 block text-xs leading-relaxed break-words text-foreground transition-colors group-hover:text-primary">
            {notification.message || "New notification"}
          </span>
        </span>
      </button>
      <IconButton icon={X} label="Dismiss notification" size="sm" onClick={onDismiss} className="-mr-1" />
    </div>
  );
}

export default NotificationToast;
