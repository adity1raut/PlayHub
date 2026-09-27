import {
  Bell,
  Eye,
  Heart,
  MessageCircle,
  MessagesSquare,
  Package,
  Radio,
  ShoppingBag,
  Star,
  Store,
  UserPlus,
} from "lucide-react";

/** Display metadata for every Notification.type in backend/src/modules/notifications/notification.model.js */
export const NOTIFICATION_TYPES = {
  FOLLOW: { label: "Follow", title: "New follower", icon: UserPlus, variant: "info" },
  LIKE: { label: "Like", title: "New like", icon: Heart, variant: "destructive" },
  COMMENT: { label: "Comment", title: "New comment", icon: MessageCircle, variant: "default" },
  MESSAGE: { label: "Message", title: "New message", icon: MessagesSquare, variant: "info" },
  ORDER_UPDATE: { label: "Order", title: "Order update", icon: Package, variant: "warning" },
  STREAM_START: { label: "Live", title: "Live now", icon: Radio, variant: "destructive" },
  STREAM_END: { label: "Stream ended", title: "Stream ended", icon: Radio, variant: "secondary" },
  STREAM_VIEWER: { label: "Viewer", title: "New viewer", icon: Eye, variant: "secondary" },
  STORE_FOLLOW: { label: "Store", title: "New store follower", icon: Store, variant: "info" },
  NEW_ORDER: { label: "Order", title: "New order", icon: ShoppingBag, variant: "success" },
  REVIEW: { label: "Review", title: "New review", icon: Star, variant: "warning" },
  GENERAL: { label: "General", title: "Spawnpoint", icon: Bell, variant: "secondary" },
};

/** Unknown / missing types (e.g. a newer server) fall back to GENERAL. */
const isKnownType = (type) =>
  typeof type === "string" && Object.prototype.hasOwnProperty.call(NOTIFICATION_TYPES, type);

export const typeMeta = (type) => (isKnownType(type) ? NOTIFICATION_TYPES[type] : NOTIFICATION_TYPES.GENERAL);

export const formatTimeAgo = (date) => {
  if (!date) return "";
  const diffInSeconds = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 1000));
  if (diffInSeconds < 60) return "just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return new Date(date).toLocaleDateString();
};

/**
 * Map backend notification links onto routes the client actually has.
 * /post/:postId has its own page; /chat/:conversationId opens the chat with that
 * conversation selected (passed as router state).
 */
export const resolveLink = (link) => {
  if (!link) return null;
  const chat = link.match(/^\/chat\/([^/?#]+)/);
  if (chat) return { to: "/chat", state: { conversationId: chat[1] } };
  return { to: link };
};

/** The populated sender, if any (REST results may carry only an id). */
export const senderOf = (notification) =>
  notification?.fromUser && typeof notification.fromUser === "object" ? notification.fromUser : null;
