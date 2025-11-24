import jwt from "jsonwebtoken";
import Message from "../models/Messege.model.js";
import Conversation from "../models/Chat.models.js";
import User from "../models/User.models.js";
import Notification from "../models/Notification.models.js";
import NotificationService from "../services/NotificationServic.js";

const connectedUsers = new Map();
let notificationService;

const setupSocketHandlers = (io) => {
  // Initialize notification service
  notificationService = new NotificationService(io);

  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.request.headers?.cookie
          ?.split(";")
          ?.find((c) => c.trim().startsWith("token="))
          ?.split("=")[1];

      if (!token) {
        return next(new Error("Authentication error: No token provided"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Add user info to socket object (matching your HTTP middleware)
      socket.userId = decoded.id; // Using 'id' instead of 'userId' to match your token structure
      socket.user = decoded;

      next();
    } catch (error) {
      console.error("Socket authentication error:", error);

      if (error.name === "TokenExpiredError") {
        return next(new Error("Authentication error: Token expired"));
      }

      if (error.name === "JsonWebTokenError") {
        return next(new Error("Authentication error: Invalid token"));
      }

      return next(new Error("Authentication error: Server error"));
    }
  });

  io.on("connection", async (socket) => {
    try {
      // Store connected user
      connectedUsers.set(socket.userId, socket.id);

      // Update user's online status
      await User.findByIdAndUpdate(socket.userId, {
        isOnline: true,
        lastSeen: new Date(),
      });

      console.log(`User ${socket.userId} connected`);

      // Join user to their personal notification room
      socket.join(`user_${socket.userId}`);

      // Join user's conversation rooms
      const user = await User.findById(socket.userId).populate("conversations");
      if (user.conversations) {
        user.conversations.forEach((conv) => {
          socket.join(conv._id.toString());
        });
      }

      // Send unread notification count on connection
      const unreadCount = await Notification.countDocuments({
        user: socket.userId,
        isRead: false,
      });

      socket.emit("notification-count", { count: unreadCount });

      // Send recent notifications on connection
      const recentNotifications = await Notification.find({
        user: socket.userId,
        isRead: false,
      })
        .populate("fromUser", "username profile.name profile.profileImage")
        .sort({ createdAt: -1 })
        .limit(10);

      socket.emit("recent-notifications", recentNotifications);

      // Handle joining a conversation room
      socket.on("join-conversation", (conversationId) => {
        socket.join(conversationId);
      });

      // Handle leaving a conversation room
      socket.on("leave-conversation", (conversationId) => {
        socket.leave(conversationId);
      });

      // Handle sending messages
      socket.on("send-message", async (data) => {
        try {
          const { conversationId, content, type = "text" } = data;

          // Add validation for required fields
          if (!conversationId) {
            socket.emit("error", { message: "Conversation ID is required" });
            return;
          }

          if (!content || content.trim() === "") {
            socket.emit("error", { message: "Message content is required" });
            return;
          }

          // Verify user is member of conversation
          const conversation = await Conversation.findOne({
            _id: conversationId,
            members: socket.userId,
          }).populate(
            "members",
            "username profile.firstName profile.lastName profile.name profile.profileImage",
          );

          if (!conversation) {
            socket.emit("error", { message: "Conversation not found" });
            return;
          }

          // Create message
          const message = new Message({
            sender: socket.userId,
            conversationId: conversationId,
            content: content.trim(),
            type,
          });

          await message.save();

          // Update conversation
          conversation.lastMessage = message._id;
          if (conversation.messages) {
            conversation.messages.push(message._id);
          }
          await conversation.save();

          // Populate message
          const populatedMessage = await Message.findById(message._id).populate(
            "sender",
            "username profile.name profile.profileImage profile.firstName profile.lastName",
          );

          // Emit to conversation room
          io.to(conversationId).emit("new-message", populatedMessage);

          // Get sender info for notification
          const sender = await User.findById(socket.userId).select(
            "username profile",
          );
          const senderName = sender.profile?.firstName
            ? `${sender.profile.firstName} ${sender.profile.lastName || ""}`.trim()
            : sender.username;

          // Create notifications for other members using NotificationService
          const otherMembers = conversation.members.filter(
            (member) => member._id.toString() !== socket.userId,
          );

          for (const member of otherMembers) {
            try {
              await notificationService.createNotification(
                member._id,
                "MESSAGE",
                `${senderName} sent you a message: ${content.substring(0, 50)}${content.length > 50 ? "..." : ""}`,
                `/chat/${conversationId}`,
                socket.userId,
              );

              // Update notification count for the member
              const memberUnreadCount = await Notification.countDocuments({
                user: member._id,
                isRead: false,
              });

              io.to(`user_${member._id}`).emit("notification-count", {
                count: memberUnreadCount,
              });
            } catch (notificationError) {
              console.error(
                "Error creating message notification:",
                notificationError,
              );
            }
          }

          // Emit conversation update to all members
          const updatedConversation = await Conversation.findById(
            conversationId,
          )
            .populate(
              "members",
              "username profile.name profile.profileImage profile.firstName profile.lastName",
            )
            .populate("lastMessage");

          conversation.members.forEach((memberId) => {
            const memberSocketId = connectedUsers.get(memberId._id.toString());
            if (memberSocketId) {
              io.to(memberSocketId).emit(
                "conversation-updated",
                updatedConversation,
              );
            }
          });
        } catch (error) {
          console.error("Error sending message:", error);
          socket.emit("error", { message: "Failed to send message" });
        }
      });

      // Handle like notification (for real-time updates from frontend)
      socket.on("post-liked", async (data) => {
        try {
          const { postId, postOwnerId, likerUsername } = data;

          if (postOwnerId !== socket.userId) {
            await notificationService.sendLikeNotification(
              postOwnerId,
              socket.userId,
              likerUsername,
              postId,
            );

            // Update notification count
            const unreadCount = await Notification.countDocuments({
              user: postOwnerId,
              isRead: false,
            });

            io.to(`user_${postOwnerId}`).emit("notification-count", {
              count: unreadCount,
            });
          }
        } catch (error) {
          console.error("Error handling like notification:", error);
        }
      });

      // Handle comment notification (for real-time updates from frontend)
      socket.on("post-commented", async (data) => {
        try {
          const { postId, postOwnerId, commenterUsername } = data;

          if (postOwnerId !== socket.userId) {
            await notificationService.sendCommentNotification(
              postOwnerId,
              socket.userId,
              commenterUsername,
              postId,
            );

            // Update notification count
            const unreadCount = await Notification.countDocuments({
              user: postOwnerId,
              isRead: false,
            });

            io.to(`user_${postOwnerId}`).emit("notification-count", {
              count: unreadCount,
            });
          }
        } catch (error) {
          console.error("Error handling comment notification:", error);
        }
      });

      // Handle follow notification (for real-time updates from frontend)
      socket.on("user-followed", async (data) => {
        try {
          const { followedUserId, followerUsername } = data;

          await notificationService.sendFollowNotification(
            followedUserId,
            socket.userId,
            followerUsername,
          );

          // Update notification count
          const unreadCount = await Notification.countDocuments({
            user: followedUserId,
            isRead: false,
          });

          io.to(`user_${followedUserId}`).emit("notification-count", {
            count: unreadCount,
          });
        } catch (error) {
          console.error("Error handling follow notification:", error);
        }
      });

      // Handle typing indicators
      socket.on("typing-start", (conversationId) => {
        socket.to(conversationId).emit("user-typing", {
          userId: socket.userId,
          conversationId,
        });
      });

      socket.on("typing-stop", (conversationId) => {
        socket.to(conversationId).emit("user-stop-typing", {
          userId: socket.userId,
          conversationId,
        });
      });

      // Handle message read status
      socket.on("mark-as-read", async (data) => {
        try {
          const { messageId, conversationId } = data;

          await Message.findByIdAndUpdate(messageId, {
            $addToSet: {
              readBy: {
                user: socket.userId,
                readAt: new Date(),
              },
            },
          });

          socket.to(conversationId).emit("message-read", {
            messageId,
            userId: socket.userId,
          });
        } catch (error) {
          console.error("Error marking message as read:", error);
          socket.emit("error", { message: "Failed to mark message as read" });
        }
      });

      // Handle notification read status
      socket.on("mark-notification-read", async (data) => {
        try {
          const { notificationId } = data;

          await Notification.findOneAndUpdate(
            { _id: notificationId, user: socket.userId },
            { isRead: true },
          );

          // Update notification count
          const unreadCount = await Notification.countDocuments({
            user: socket.userId,
            isRead: false,
          });

          socket.emit("notification-count", { count: unreadCount });
          socket.emit("notification-read", { notificationId });
        } catch (error) {
          console.error("Error marking notification as read:", error);
          socket.emit("error", {
            message: "Failed to mark notification as read",
          });
        }
      });

      // Handle mark all notifications as read
      socket.on("mark-all-notifications-read", async () => {
        try {
          await Notification.updateMany(
            { user: socket.userId, isRead: false },
            { isRead: true },
          );

          socket.emit("notification-count", { count: 0 });
          socket.emit("all-notifications-read");
        } catch (error) {
          console.error("Error marking all notifications as read:", error);
          socket.emit("error", {
            message: "Failed to mark all notifications as read",
          });
        }
      });

      // Handle get notifications with pagination
      socket.on("get-notifications", async (data = {}) => {
        try {
          const { page = 1, limit = 20, type = null } = data;

          const query = { user: socket.userId };
          if (type) {
            query.type = type;
          }

          const notifications = await Notification.find(query)
            .populate("fromUser", "username profile.name profile.profileImage")
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

          const unreadCount = await Notification.countDocuments({
            user: socket.userId,
            isRead: false,
          });

          const totalCount = await Notification.countDocuments(query);

          socket.emit("notifications-list", {
            notifications,
            unreadCount,
            currentPage: page,
            totalPages: Math.ceil(totalCount / limit),
            hasMore: page * limit < totalCount,
          });
        } catch (error) {
          console.error("Error fetching notifications:", error);
          socket.emit("error", { message: "Failed to fetch notifications" });
        }
      });

      // Handle delete notification
      socket.on("delete-notification", async (data) => {
        try {
          const { notificationId } = data;

          await Notification.findOneAndDelete({
            _id: notificationId,
            user: socket.userId,
          });

          // Update notification count
          const unreadCount = await Notification.countDocuments({
            user: socket.userId,
            isRead: false,
          });

          socket.emit("notification-count", { count: unreadCount });
          socket.emit("notification-deleted", { notificationId });
        } catch (error) {
          console.error("Error deleting notification:", error);
          socket.emit("error", { message: "Failed to delete notification" });
        }
      });

      // Handle clear all notifications
      socket.on("clear-all-notifications", async () => {
        try {
          await Notification.deleteMany({ user: socket.userId });

          socket.emit("notification-count", { count: 0 });
          socket.emit("all-notifications-cleared");
        } catch (error) {
          console.error("Error clearing all notifications:", error);
          socket.emit("error", {
            message: "Failed to clear all notifications",
          });
        }
      });

      // Handle joining stream room
      socket.on("join-stream", (streamId) => {
        socket.join(`stream_${streamId}`);
        console.log(
          `User ${socket.userId} joined stream room: stream_${streamId}`,
        );
      });

      // Handle leaving stream room
      socket.on("leave-stream", (streamId) => {
        socket.leave(`stream_${streamId}`);
        console.log(
          `User ${socket.userId} left stream room: stream_${streamId}`,
        );
      });

      // Handle stream chat message
      socket.on("send-stream-message", async (data) => {
        try {
          const { streamId, message } = data;

          if (!streamId || !message || message.trim() === "") {
            socket.emit("error", {
              message: "Stream ID and message are required",
            });
            return;
          }

          // Verify stream exists and is live
          const Stream = (await import("../models/Sream.models.js")).default;
          const stream = await Stream.findById(streamId);

          if (!stream || !stream.isLive) {
            socket.emit("error", { message: "Stream not found or not live" });
            return;
          }

          // Create chat message
          const LiveMessage = (await import("../models/StreamChat.models.js"))
            .default;
          const newMessage = new LiveMessage({
            streamId,
            sender: socket.userId,
            message: message.trim(),
          });

          await newMessage.save();

          // Add to stream chat
          stream.liveChat.push(newMessage._id);
          await stream.save();

          // Populate sender info
          await newMessage.populate(
            "sender",
            "username profile.profileImage profile.name",
          );

          // Broadcast to all viewers in the stream room
          io.to(`stream_${streamId}`).emit("new-stream-message", {
            streamId,
            message: newMessage,
            timestamp: new Date(),
          });
        } catch (error) {
          console.error("Error sending stream message:", error);
          socket.emit("error", { message: "Failed to send stream message" });
        }
      });

      // Handle stream notifications
      socket.on("stream-started", async (data) => {
        try {
          const { streamId, streamTitle } = data;

          const user = await User.findById(socket.userId).populate(
            "followers",
            "_id",
          );

          if (user.followers && user.followers.length > 0) {
            for (const follower of user.followers) {
              await notificationService.createNotification(
                follower._id,
                "STREAM_START",
                `${user.username} started a live stream: ${streamTitle}`,
                `/stream/${streamId}`,
                socket.userId,
              );
            }
          }
        } catch (error) {
          console.error("Error handling stream start notification:", error);
        }
      });

      // Handle disconnect
      socket.on("disconnect", async () => {
        try {
          connectedUsers.delete(socket.userId);

          // Update user's offline status
          await User.findByIdAndUpdate(socket.userId, {
            isOnline: false,
            lastSeen: new Date(),
          });

          console.log(`User ${socket.userId} disconnected`);
        } catch (error) {
          console.error("Error handling disconnect:", error);
        }
      });
    } catch (error) {
      console.error("Socket connection error:", error);
      socket.disconnect();
    }
  });
};

export const getNotificationService = () => notificationService;

export default setupSocketHandlers;
