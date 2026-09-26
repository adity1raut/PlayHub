import jwt from "jsonwebtoken";
import Message from "../modules/chat/message.model.js";
import Conversation from "../modules/chat/conversation.model.js";
import User from "../modules/auth/user.model.js";
import Notification from "../modules/notifications/notification.model.js";
import NotificationService from "../modules/notifications/notification.service.js";
import { registerSfuHandlers } from "../sfu/index.js";
import { setRealtimeServer } from "./realtime.js";

const connectedUsers = new Map();
let notificationService;

const setupSocketHandlers = (io) => {
  notificationService = new NotificationService(io);
  setRealtimeServer(io);

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
      socket.userId = decoded.id;
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

  io.on("connection", (socket) => {
    try {
      connectedUsers.set(socket.userId, socket.id);
      socket.join(`user_${socket.userId}`);
      console.log(`User ${socket.userId} connected`);

      // Register every handler synchronously so no early client event is lost;
      // the database setup below runs in the background.
      registerSfuHandlers(socket);

      (async () => {
        // Join every conversation room this user belongs to
        const conversations = await Conversation.find({ members: socket.userId }).select("_id").lean();
        conversations.forEach((conv) => socket.join(conv._id.toString()));

        const unreadCount = await Notification.countDocuments({ user: socket.userId, isRead: false });
        socket.emit("notification-count", { count: unreadCount });
      })().catch((error) => console.error("Socket setup error:", error.message));

      socket.on("join-conversation", (conversationId) => {
        socket.join(conversationId);
      });

      socket.on("leave-conversation", (conversationId) => {
        socket.leave(conversationId);
      });

      socket.on("send-message", async (data) => {
        try {
          const { conversationId, content, type = "text" } = data;

          if (!conversationId) {
            socket.emit("error", { message: "Conversation ID is required" });
            return;
          }

          if (!content || content.trim() === "") {
            socket.emit("error", { message: "Message content is required" });
            return;
          }

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

          const message = new Message({
            sender: socket.userId,
            conversationId,
            content: content.trim(),
            type,
          });
          await message.save();

          conversation.lastMessage = message._id;
          if (conversation.messages) {
            conversation.messages.push(message._id);
          }
          await conversation.save();

          const populatedMessage = await Message.findById(message._id).populate(
            "sender",
            "username profile.name profile.profileImage profile.firstName profile.lastName",
          );

          io.to(conversationId).emit("new-message", populatedMessage);

          const sender = await User.findById(socket.userId).select("username profile");
          const senderName = sender.profile?.name || sender.username;

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

              const memberUnreadCount = await Notification.countDocuments({
                user: member._id,
                isRead: false,
              });
              io.to(`user_${member._id}`).emit("notification-count", { count: memberUnreadCount });
            } catch (notificationError) {
              console.error("Error creating message notification:", notificationError);
            }
          }

          const updatedConversation = await Conversation.findById(conversationId)
            .populate(
              "members",
              "username profile.name profile.profileImage profile.firstName profile.lastName",
            )
            .populate("lastMessage");

          // user_<id> rooms reach every open tab of each member
          conversation.members.forEach((member) => {
            io.to(`user_${member._id}`).emit("conversation-updated", updatedConversation);
          });
        } catch (error) {
          console.error("Error sending message:", error);
          socket.emit("error", { message: "Failed to send message" });
        }
      });

      socket.on("typing-start", (conversationId) => {
        socket.to(conversationId).emit("user-typing", { userId: socket.userId, conversationId });
      });

      socket.on("typing-stop", (conversationId) => {
        socket.to(conversationId).emit("user-stop-typing", { userId: socket.userId, conversationId });
      });

      socket.on("mark-as-read", async (data) => {
        try {
          const { messageId, conversationId } = data;
          await Message.findByIdAndUpdate(messageId, {
            $addToSet: { readBy: { user: socket.userId, readAt: new Date() } },
          });
          socket.to(conversationId).emit("message-read", { messageId, userId: socket.userId });
        } catch (error) {
          console.error("Error marking message as read:", error);
          socket.emit("error", { message: "Failed to mark message as read" });
        }
      });

      socket.on("mark-notification-read", async (data) => {
        try {
          const { notificationId } = data;
          await Notification.findOneAndUpdate(
            { _id: notificationId, user: socket.userId },
            { isRead: true },
          );
          const unreadCount = await Notification.countDocuments({
            user: socket.userId,
            isRead: false,
          });
          socket.emit("notification-count", { count: unreadCount });
          socket.emit("notification-read", { notificationId });
        } catch (error) {
          console.error("Error marking notification as read:", error);
          socket.emit("error", { message: "Failed to mark notification as read" });
        }
      });

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
          socket.emit("error", { message: "Failed to mark all notifications as read" });
        }
      });

      socket.on("get-notifications", async (data = {}) => {
        try {
          const { page = 1, limit = 20, type = null } = data;
          const query = { user: socket.userId };
          if (type) query.type = type;

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

      socket.on("delete-notification", async (data) => {
        try {
          const { notificationId } = data;
          await Notification.findOneAndDelete({ _id: notificationId, user: socket.userId });
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

      socket.on("clear-all-notifications", async () => {
        try {
          await Notification.deleteMany({ user: socket.userId });
          socket.emit("notification-count", { count: 0 });
          socket.emit("all-notifications-cleared");
        } catch (error) {
          console.error("Error clearing all notifications:", error);
          socket.emit("error", { message: "Failed to clear all notifications" });
        }
      });

      socket.on("join-stream", (streamId) => {
        socket.join(`stream_${streamId}`);
        console.log(`User ${socket.userId} joined stream room: stream_${streamId}`);
      });

      socket.on("leave-stream", (streamId) => {
        socket.leave(`stream_${streamId}`);
        console.log(`User ${socket.userId} left stream room: stream_${streamId}`);
      });

      socket.on("send-stream-message", async (data) => {
        try {
          const { streamId, message } = data;

          if (!streamId || !message || message.trim() === "") {
            socket.emit("error", { message: "Stream ID and message are required" });
            return;
          }

          const Stream = (await import("../modules/stream/stream.model.js")).default;
          const stream = await Stream.findById(streamId);

          if (!stream || !stream.isLive) {
            socket.emit("error", { message: "Stream not found or not live" });
            return;
          }

          const LiveMessage = (await import("../modules/stream/streamChat.model.js")).default;
          const newMessage = new LiveMessage({
            streamId,
            sender: socket.userId,
            message: message.trim(),
          });
          await newMessage.save();

          stream.liveChat.push(newMessage._id);
          await stream.save();

          await newMessage.populate("sender", "username profile.profileImage profile.name");

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

      socket.on("disconnect", () => {
        if (connectedUsers.get(socket.userId) === socket.id) connectedUsers.delete(socket.userId);
        console.log(`User ${socket.userId} disconnected`);
      });
    } catch (error) {
      console.error("Socket connection error:", error);
      socket.disconnect();
    }
  });
};

export const getNotificationService = () => notificationService;

export default setupSocketHandlers;
