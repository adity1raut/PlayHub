import Notification from "./notification.model.js";
import { pushTitleFor, sendPushToUser } from "./push.service.js";

const ONE_DAY = 24 * 60 * 60 * 1000;

class NotificationService {
  constructor(io) {
    this.io = io;
  }

  /**
   * Save a notification, push it to the recipient's open tabs (socket) and devices (web push).
   * Returns null (and sends nothing) when:
   *  - the recipient is the actor (no self-notifications), or
   *  - `dedupeMs` is set and the same actor already sent the same kind of alert for the same
   *    link within that window (e.g. follow → unfollow → follow again).
   */
  async createNotification(userId, type, message, link = null, fromUserId = null, { dedupeMs = 0 } = {}) {
    try {
      if (!userId || (fromUserId && String(userId) === String(fromUserId))) return null;

      if (dedupeMs > 0 && fromUserId) {
        const recent = await Notification.exists({
          user: userId,
          type,
          fromUser: fromUserId,
          link,
          createdAt: { $gte: new Date(Date.now() - dedupeMs) },
        });
        if (recent) return null;
      }

      const notification = new Notification({
        user: userId,
        type,
        message,
        link,
        fromUser: fromUserId,
      });

      await notification.save();

      let populatedNotification = notification;
      if (fromUserId) {
        try {
          populatedNotification = await notification.populate(
            "fromUser",
            "username profile.name profile.profileImage",
          );
        } catch (populateError) {
          console.warn("Failed to populate fromUser:", populateError);
          populatedNotification = notification;
        }
      }

      this.io.to(`user_${userId}`).emit("new-notification", {
        _id: populatedNotification._id,
        id: populatedNotification._id,
        type: populatedNotification.type,
        message: populatedNotification.message,
        link: populatedNotification.link,
        isRead: populatedNotification.isRead,
        createdAt: populatedNotification.createdAt,
        fromUser: populatedNotification.fromUser || null,
      });

      // Keep the recipient's unread badge in sync, whichever code path created this
      const unreadCount = await Notification.countDocuments({ user: userId, isRead: false });
      this.io.to(`user_${userId}`).emit("notification-count", { count: unreadCount });

      // Ring the recipient's phones/desktops too (Web Push). Fire-and-forget:
      // a push failure must never fail the notification itself.
      this.sendPush(userId, populatedNotification);

      return populatedNotification;
    } catch (error) {
      console.error("Error creating notification:", error);
      throw error;
    }
  }

  sendPush(userId, notification) {
    try {
      const id = String(notification._id);
      const { type, message, link } = notification;
      const payload = {
        title: pushTitleFor(type),
        body: message,
        url: link || "/notification",
        tag: `${type}-${link || id}`,
        type,
        id,
        icon: "/icons/icon-192.png",
        badge: "/icons/badge-96.png",
      };
      sendPushToUser(userId, payload).catch((err) => {
        console.warn("Push delivery failed:", err?.message || err);
      });
    } catch (err) {
      console.warn("Could not queue push notification:", err?.message || err);
    }
  }

  async sendLikeNotification(postOwnerId, likerUserId, likerUsername, postId) {
    if (postOwnerId.toString() === likerUserId.toString()) return;
    await this.createNotification(
      postOwnerId,
      "LIKE",
      `${likerUsername} liked your post`,
      `/post/${postId}`,
      likerUserId,
      { dedupeMs: ONE_DAY }, // like → unlike → like again doesn't re-alert
    );
  }

  async sendCommentNotification(postOwnerId, commenterUserId, commenterUsername, postId) {
    if (postOwnerId.toString() === commenterUserId.toString()) return;
    await this.createNotification(
      postOwnerId,
      "COMMENT",
      `${commenterUsername} commented on your post`,
      `/post/${postId}`,
      commenterUserId,
    );
  }

  async sendFollowNotification(followedUserId, followerUserId, followerUsername) {
    await this.createNotification(
      followedUserId,
      "FOLLOW",
      `${followerUsername} started following you`,
      `/profile/${followerUsername}`,
      followerUserId,
      { dedupeMs: ONE_DAY }, // follow → unfollow → follow again doesn't re-alert
    );
  }

  async sendStoreFollowNotification(ownerId, followerId, followerUsername, storeName) {
    await this.createNotification(
      ownerId,
      "STORE_FOLLOW",
      `${followerUsername} started following your store ${storeName}`,
      `/profile/${followerUsername}`,
      followerId,
      { dedupeMs: ONE_DAY },
    );
  }

  async sendNewOrderNotification(ownerId, buyerId, buyerUsername, itemCount, storeName) {
    await this.createNotification(
      ownerId,
      "NEW_ORDER",
      `${buyerUsername} ordered ${itemCount} item${itemCount === 1 ? "" : "s"} from ${storeName}`,
      "/my-store",
      buyerId,
    );
  }

  async sendReviewNotification(ownerId, reviewerId, reviewerUsername, productName, productId, rating) {
    await this.createNotification(
      ownerId,
      "REVIEW",
      `${reviewerUsername} rated ${productName} ${rating}★`,
      `/products/${productId}`,
      reviewerId,
      { dedupeMs: 60 * 60 * 1000 }, // editing a review within the hour doesn't re-alert
    );
  }

  async sendMessageNotification(receiverUserId, senderUserId, senderUsername, messageContent, conversationId) {
    if (receiverUserId.toString() === senderUserId.toString()) return;
    const truncated = messageContent.length > 50
      ? messageContent.substring(0, 50) + "..."
      : messageContent;
    await this.createNotification(
      receiverUserId,
      "MESSAGE",
      `${senderUsername} sent you a message: ${truncated}`,
      `/chat/${conversationId}`,
      senderUserId,
    );
  }

  async getUnreadCount(userId) {
    try {
      return await Notification.countDocuments({ user: userId, isRead: false });
    } catch (error) {
      console.error("Error getting unread count:", error);
      return 0;
    }
  }

  async markAsRead(notificationId, userId) {
    try {
      await Notification.findOneAndUpdate(
        { _id: notificationId, user: userId },
        { isRead: true },
      );
      return await this.getUnreadCount(userId);
    } catch (error) {
      console.error("Error marking notification as read:", error);
      throw error;
    }
  }

  async markAllAsRead(userId) {
    try {
      await Notification.updateMany({ user: userId, isRead: false }, { isRead: true });
      return 0;
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      throw error;
    }
  }

  async deleteNotification(notificationId, userId) {
    try {
      await Notification.findOneAndDelete({ _id: notificationId, user: userId });
      return await this.getUnreadCount(userId);
    } catch (error) {
      console.error("Error deleting notification:", error);
      throw error;
    }
  }

  async getNotifications(userId, page = 1, limit = 20, type = null) {
    try {
      const query = { user: userId };
      if (type) query.type = type;

      const notifications = await Notification.find(query)
        .populate("fromUser", "username profile.name profile.profileImage")
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip((page - 1) * limit);

      const totalCount = await Notification.countDocuments(query);
      const unreadCount = await this.getUnreadCount(userId);

      return {
        notifications,
        unreadCount,
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: page * limit < totalCount,
      };
    } catch (error) {
      console.error("Error getting notifications:", error);
      throw error;
    }
  }
}

export default NotificationService;
