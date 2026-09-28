import Notification from "./notification.model.js";
import { toUser } from "../../socket/realtime.js";

/**
 * Keep the user's other open tabs in step after a read / delete: send the change itself,
 * then the fresh unread badge (`notification-count`). Returns that count.
 */
async function syncOtherTabs(userId, event, payload) {
  const count = await Notification.countDocuments({ user: userId, isRead: false });
  toUser(userId, event, payload);
  toUser(userId, "notification-count", { count });
  return count;
}

export async function getNotification(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const notifications = await Notification.find({ user: req.user.id })
      .populate("fromUser", "username profile.name profile.profileImage")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const unreadCount = await Notification.countDocuments({
      user: req.user.id,
      isRead: false,
    });

    const totalCount = await Notification.countDocuments({ user: req.user.id });

    res.json({
      success: true,
      notifications,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNextPage: page < Math.ceil(totalCount / limit),
        hasPrevPage: page > 1,
      },
      unreadCount,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch notifications" });
  }
}

export async function unreadNotification(req, res) {
  try {
    const unreadCount = await Notification.countDocuments({
      user: req.user.id,
      isRead: false,
    });
    res.json({ success: true, unreadCount });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch unread count" });
  }
}

export async function markNotification(req, res) {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { isRead: true },
      { new: true },
    );

    if (!notification) {
      return res
        .status(404)
        .json({ success: false, message: "Notification not found" });
    }

    const unreadCount = await syncOtherTabs(req.user.id, "notification:read", { id: String(notification._id) });
    res.json({ success: true, notification, unreadCount });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to mark notification as read" });
  }
}

export async function readAll(req, res) {
  try {
    const result = await Notification.updateMany(
      { user: req.user.id, isRead: false },
      { isRead: true },
    );
    const unreadCount = await syncOtherTabs(req.user.id, "notification:read-all", {});
    res.json({ success: true, modifiedCount: result.modifiedCount, unreadCount });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark all notifications as read",
    });
  }
}

export async function deleteNotification(req, res) {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!notification) {
      return res
        .status(404)
        .json({ success: false, message: "Notification not found" });
    }

    const unreadCount = await syncOtherTabs(req.user.id, "notification:deleted", { id: String(notification._id) });
    res.json({ success: true, message: "Notification deleted successfully", unreadCount });
  } catch (error) {
    console.error("Error deleting notification:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to delete notification" });
  }
}
