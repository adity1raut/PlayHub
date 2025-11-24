import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "./AuthContext";

const backendUrl = import.meta.env.VITE_BACKEND_URL;

const NotificationContext = createContext();

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

  const { isAuthenticated } = useAuth();

  // Fetch notifications
  const fetchNotifications = async (page = 1, limit = 20) => {
    if (!isAuthenticated) return;

    setLoading(true);
    try {
      const res = await axios.get(
        `${backendUrl}/api/notifications?page=${page}&limit=${limit}`,
        {
          withCredentials: true,
        },
      );

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
  };

  // Fetch unread count
  const fetchUnreadCount = async () => {
    if (!isAuthenticated) return;

    try {
      const res = await axios.get(
        `${backendUrl}/api/notifications/unread-count`,
        {
          withCredentials: true,
        },
      );

      if (res.data.success) {
        setUnreadCount(res.data.unreadCount);
      }
    } catch (error) {
      console.error("Error fetching unread count:", error);
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    try {
      const res = await axios.put(
        `${backendUrl}/api/notifications/${notificationId}/read`,
        {},
        {
          withCredentials: true,
        },
      );

      if (res.data.success) {
        setNotifications((prev) =>
          prev.map((notif) =>
            notif._id === notificationId ? { ...notif, isRead: true } : notif,
          ),
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      const res = await axios.put(
        `${backendUrl}/api/notifications/read-all`,
        {},
        {
          withCredentials: true,
        },
      );

      if (res.data.success) {
        setNotifications((prev) =>
          prev.map((notif) => ({ ...notif, isRead: true })),
        );
        setUnreadCount(0);
      }
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  };

  // Delete notification
  const deleteNotification = async (notificationId) => {
    try {
      const res = await axios.put(
        `${backendUrl}/api/notifications/${notificationId}`,
        {},
        {
          withCredentials: true,
        },
      );

      if (res.data.success) {
        const deletedNotif = notifications.find(
          (n) => n._id === notificationId,
        );
        setNotifications((prev) =>
          prev.filter((notif) => notif._id !== notificationId),
        );

        if (deletedNotif && !deletedNotif.isRead) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      }
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
      fetchUnreadCount();
    }
  }, [isAuthenticated]);

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
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);
