import { useNavigate } from "react-router-dom";
import { Check, Trash2 } from "lucide-react";
import { useNotifications } from "../../context/NotificationContext";
import { Avatar, Badge, IconButton, StatusDot } from "../../components/ui";
import { cn } from "../../lib/cn";
import { formatTimeAgo, resolveLink, senderOf, typeMeta } from "./notificationMeta";

function NotificationItem({ notification, compact = false, onNavigate }) {
  const { markAsRead, deleteNotification } = useNotifications();
  const navigate = useNavigate();

  const meta = typeMeta(notification.type);
  const TypeIcon = meta.icon;
  const unread = !notification.isRead;
  // fromUser is only populated on socket-pushed notifications; REST results carry an id
  const from = senderOf(notification);
  const fromName = from?.profile?.name || from?.username;
  const target = resolveLink(notification.link);

  const handleMarkAsRead = () => {
    if (unread) markAsRead(notification._id);
  };

  const handleOpen = () => {
    handleMarkAsRead();
    if (target) {
      onNavigate?.();
      navigate(target.to, target.state ? { state: target.state } : undefined);
    }
  };

  const handleDelete = () => {
    deleteNotification(notification._id);
  };

  return (
    <li
      className={cn(
        "group relative flex items-start gap-3 border-l-2 transition-colors hover:bg-accent",
        compact ? "py-3 pr-2 pl-3.5" : "py-3.5 pr-3 pl-4 sm:pr-4 sm:pl-5",
        unread ? "border-primary bg-primary/[0.04]" : "border-transparent",
      )}
    >
      <button
        type="button"
        onClick={handleOpen}
        className={cn("flex min-w-0 flex-1 items-start gap-3 text-left", !target && !unread && "cursor-default")}
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
            {unread && <StatusDot tone="info" pulse />}
            <Badge variant={meta.variant} icon={from ? TypeIcon : undefined}>
              {meta.label}
            </Badge>
            <span className="ml-auto shrink-0 text-[11px] text-faint">{formatTimeAgo(notification.createdAt)}</span>
          </span>
          <span
            className={cn(
              "mt-1.5 block text-xs leading-relaxed break-words",
              compact && "line-clamp-2",
              unread ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {notification.message || notification.content || "New notification"}
          </span>
          {unread && <span className="sr-only">(unread)</span>}
        </span>
      </button>

      <div
        className={cn(
          "flex shrink-0 items-center",
          compact && "opacity-100 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100",
        )}
      >
        {unread && !compact && <IconButton icon={Check} label="Mark as read" size="sm" onClick={handleMarkAsRead} />}
        <IconButton
          icon={Trash2}
          label="Delete notification"
          size="sm"
          onClick={handleDelete}
          className="hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
        />
      </div>
    </li>
  );
}

export default NotificationItem;
