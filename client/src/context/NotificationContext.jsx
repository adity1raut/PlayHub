import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import axios from "axios";
import { useAuth } from "./AuthContext";
import { useSocket } from "./SocketContext";
import { API_URL } from "../lib/config";
import { toast } from "../lib/toast";
import { useSocketEvent } from "../lib/useSocketEvent";
import {
  initAlertSound,
  isSoundEnabled,
  playAlertSound,
  setSoundEnabled as storeSoundEnabled,
  vibrateAlert,
} from "../lib/alertSound";
import {
  disablePush,
  enablePush,
  getPushStatus,
  onServiceWorkerMessage,
  releasePushSubscription,
  sendTestPush,
  syncPushSubscription,
} from "../lib/push";
import { showDesktopNotification } from "../lib/desktopNotify";
import NotificationToast from "../features/notifications/NotificationToast";
import { resolveLink, typeMeta } from "../features/notifications/notificationMeta";

const NotificationContext = createContext();

const DEDUPE_MS = 10000; // socket + service-worker copies of one notification
const STICKY_TYPES = new Set(["MESSAGE", "STREAM_START"]);

const systemTitle = (type) => (type === "STREAM_START" ? "🔴 Live now" : typeMeta(type).title);

/** Router-less navigation: BrowserRouter listens to popstate and reads history.state.usr */
function historyNavigate(to, state) {
  const idx = (window.history.state?.idx ?? 0) + 1;
  window.history.pushState({ usr: state ?? null, key: Math.random().toString(36).slice(2, 10), idx }, "", to);
  window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
}

/** A push payload relayed by the service worker, shaped like a socket notification. */
const fromPushPayload = (p) => ({
  _id: p.id ?? null,
  type: p.type || "GENERAL",
  message: p.body || p.title || "New notification",
  link: p.url || null,
  tag: p.tag,
  isRead: false,
  createdAt: new Date(p.timestamp || Date.now()).toISOString(),
  fromUser: null,
});

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    totalCount: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  });
  // "checking" until the first probe, then see lib/push getPushStatus()
  const [pushStatus, setPushStatus] = useState("checking");
  const [soundEnabled, setSoundEnabledState] = useState(isSoundEnabled);

  const { user, isAuthenticated } = useAuth();
  const { socket } = useSocket();
  const userId = user?._id;

  const fetchNotifications = useCallback(
    async (page = 1, limit = 20) => {
      if (!isAuthenticated) return;
      setLoading(true);
      try {
        const res = await axios.get(`${API_URL}/api/notifications`, { params: { page, limit } });
        if (res.data.success) {
          setNotifications(res.data.notifications);
          setUnreadCount(res.data.unreadCount);
          setPagination(res.data.pagination);
        }
      } catch (error) {
        console.error("Error fetching notifications:", error);
      } finally {
        setLoading(false);
      }
    },
    [isAuthenticated],
  );

  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await axios.get(`${API_URL}/api/notifications/unread-count`);
      if (res.data.success) setUnreadCount(res.data.unreadCount);
    } catch (error) {
      console.error("Error fetching unread count:", error);
    }
  }, [isAuthenticated]);

  const markAsRead = useCallback(async (notificationId) => {
    try {
      const res = await axios.put(`${API_URL}/api/notifications/${notificationId}/read`);
      if (res.data.success) {
        setNotifications((prev) =>
          prev.map((n) => (n._id === notificationId ? { ...n, isRead: true } : n)),
        );
        // The server's count, not a local -1: its `notification-count` push may land first
        setUnreadCount((prev) => res.data.unreadCount ?? Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  }, []);

  const markAllAsRead = async () => {
    try {
      const res = await axios.put(`${API_URL}/api/notifications/read-all`);
      if (res.data.success) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(res.data.unreadCount ?? 0);
      }
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      const res = await axios.delete(`${API_URL}/api/notifications/${notificationId}`);
      if (res.data.success) {
        const deleted = notifications.find((n) => n._id === notificationId);
        setNotifications((prev) => prev.filter((n) => n._id !== notificationId));
        setUnreadCount((prev) => res.data.unreadCount ?? (deleted && !deleted.isRead ? Math.max(0, prev - 1) : prev));
      }
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [isAuthenticated, fetchNotifications]);

  // NotificationToaster plugs the router in
  const navigatorRef = useRef(null);

  const registerNavigator = useCallback((fn) => {
    navigatorRef.current = fn;
    return () => {
      if (navigatorRef.current === fn) navigatorRef.current = null;
    };
  }, []);

  const navigateTo = useCallback((link) => {
    const target = resolveLink(link || "/notification");
    if (!target) return;
    if (navigatorRef.current) navigatorRef.current(target.to, target.state ? { state: target.state } : undefined);
    else historyNavigate(target.to, target.state);
  }, []);

  const refreshPushStatus = useCallback(async () => {
    const status = await getPushStatus();
    setPushStatus(status);
    return status;
  }, []);

  const enableDeviceAlerts = useCallback(async () => {
    // enablePush() asks for permission first, so call this straight from a click handler
    try {
      return await enablePush();
    } finally {
      refreshPushStatus();
    }
  }, [refreshPushStatus]);

  const disableDeviceAlerts = useCallback(async () => {
    try {
      return await disablePush();
    } finally {
      refreshPushStatus();
    }
  }, [refreshPushStatus]);

  const setSoundEnabled = useCallback((enabled) => {
    storeSoundEnabled(enabled);
    setSoundEnabledState(enabled);
    if (enabled) playAlertSound({ force: true }); // preview (also unlocks audio)
  }, []);

  useEffect(() => {
    initAlertSound();
    refreshPushStatus();

    // Permission can change in browser settings while the app is open
    const onVisible = () => document.visibilityState === "visible" && refreshPushStatus();
    document.addEventListener("visibilitychange", onVisible);
    let permission;
    navigator.permissions
      ?.query({ name: "notifications" })
      .then((p) => {
        permission = p;
        p.onchange = () => refreshPushStatus();
      })
      .catch(() => {});
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (permission) permission.onchange = null;
    };
  }, [refreshPushStatus]);

  // A push subscription belongs to whoever is signed in on this device:
  // attach it to the account on sign-in, drop it on sign-out.
  const prevUserIdRef = useRef(null);
  useEffect(() => {
    const prev = prevUserIdRef.current;
    prevUserIdRef.current = userId ?? null;
    if (userId) syncPushSubscription().then(refreshPushStatus);
    else if (prev) releasePushSubscription().then(refreshPushStatus);
  }, [userId, refreshPushStatus]);

  const recentAlertsRef = useRef(new Map());
  const notificationsRef = useRef(notifications);
  const pushStatusRef = useRef(pushStatus);
  const authRef = useRef(isAuthenticated);
  notificationsRef.current = notifications;
  pushStatusRef.current = pushStatus;
  authRef.current = isAuthenticated;

  const openNotification = useCallback(
    (n) => {
      const id = n._id;
      const known = notificationsRef.current.find((x) => x._id === id);
      if (id && !known?.isRead) markAsRead(id);
      navigateTo(n.link);
    },
    [markAsRead, navigateTo],
  );

  const showToast = useCallback(
    (n, tag) => {
      toast(
        (t) => (
          <NotificationToast
            notification={n}
            onOpen={() => {
              toast.dismiss(t.id);
              openNotification(n);
            }}
            onDismiss={() => toast.dismiss(t.id)}
          />
        ),
        {
          id: `notif-${tag}`, // same conversation/post: update the pop-up instead of stacking
          duration: STICKY_TYPES.has(n.type) ? 7000 : 5000,
          style: { padding: "6px 4px", borderLeft: "2px solid var(--primary)" },
        },
      );
    },
    [openNotification],
  );

  const showSystemNotification = useCallback(
    (n, tag) =>
      showDesktopNotification({
        title: systemTitle(n.type),
        body: n.message,
        tag,
        url: n.link || "/notification",
        requireInteraction: STICKY_TYPES.has(n.type),
        onClick: () => openNotification(n),
      }),
    [openNotification],
  );

  const deliverAlert = useCallback(
    (raw) => {
      const n = { ...raw, _id: raw._id ?? raw.id ?? null };
      const tag = raw.tag || `${n.type}-${n.link || n._id}`;
      const key = n._id ? `id:${n._id}` : `tag:${tag}`;

      const now = Date.now();
      const recent = recentAlertsRef.current;
      for (const [k, at] of recent) if (now - at > DEDUPE_MS) recent.delete(k);
      if (recent.has(key)) return;
      recent.set(key, now);

      if (document.visibilityState === "hidden") {
        if (pushStatusRef.current === "enabled") return; // the service worker rings the device
        if (showSystemNotification(n, tag)) return;
      } else if (!document.hasFocus()) {
        // On screen but another window is in front: the OS notification gets noticed, and the
        // in-app pop-up below is waiting when they come back
        showSystemNotification(n, tag);
      }

      // On the chat screen new messages are already visible: just beep
      const onChat = n.type === "MESSAGE" && window.location.pathname.startsWith("/chat");
      if (!onChat) showToast(n, tag);
      playAlertSound();
      vibrateAlert();
    },
    [showSystemNotification, showToast],
  );

  // Live updates pushed by the server
  useEffect(() => {
    if (!socket) return undefined;
    const onNew = (n) => {
      const notification = { ...n, _id: n._id ?? n.id };
      setNotifications((prev) =>
        prev.some((p) => p._id === notification._id)
          ? prev.map((p) => (p._id === notification._id ? { ...p, ...notification } : p))
          : [notification, ...prev],
      );
      deliverAlert(notification);
    };
    const onCount = ({ count }) => setUnreadCount(count);
    socket.on("new-notification", onNew);
    socket.on("notification-count", onCount);
    return () => {
      socket.off("new-notification", onNew);
      socket.off("notification-count", onCount);
    };
  }, [socket, deliverAlert]);

  // Reads and deletions made in the user's other tabs (the badge follows `notification-count`)
  useSocketEvent(
    "notification:read",
    ({ id } = {}) => {
      if (!id) return;
      setNotifications((prev) =>
        prev.some((n) => n._id === id && !n.isRead)
          ? prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
          : prev,
      );
    },
    { onReconnect: () => fetchNotifications(pagination.page, pagination.limit) },
  );

  useSocketEvent("notification:read-all", () => {
    setNotifications((prev) => (prev.some((n) => !n.isRead) ? prev.map((n) => ({ ...n, isRead: true })) : prev));
  });

  useSocketEvent("notification:deleted", ({ id } = {}) => {
    if (!id) return;
    setNotifications((prev) => (prev.some((n) => n._id === id) ? prev.filter((n) => n._id !== id) : prev));
  });

  // Messages from the service worker: pushes while the app is on screen, notification clicks
  useEffect(
    () =>
      onServiceWorkerMessage((msg) => {
        if (msg.type === "spawnpoint:navigate" && msg.url) {
          navigateTo(msg.url);
          return;
        }
        if (msg.type !== "spawnpoint:push" || !msg.payload || !authRef.current) return;
        const n = fromPushPayload(msg.payload);
        // Normally the socket already delivered it; if not (reconnecting), show it now
        if (n._id && !notificationsRef.current.some((p) => p._id === n._id)) {
          setNotifications((prev) => (prev.some((p) => p._id === n._id) ? prev : [n, ...prev]));
          fetchUnreadCount();
        }
        deliverAlert(n);
      }),
    [navigateTo, deliverAlert, fetchUnreadCount],
  );

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        pagination,
        fetchNotifications,
        fetchUnreadCount,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        openNotification,
        registerNavigator,
        pushStatus,
        refreshPushStatus,
        enableDeviceAlerts,
        disableDeviceAlerts,
        sendTestAlert: sendTestPush,
        soundEnabled,
        setSoundEnabled,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);
