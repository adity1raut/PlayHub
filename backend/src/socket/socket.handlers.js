import jwt from "jsonwebtoken";
import Message from "../modules/chat/message.model.js";
import Conversation from "../modules/chat/conversation.model.js";
import { sendChatMessage } from "../modules/chat/chat.service.js";
import Notification from "../modules/notifications/notification.model.js";
import NotificationService from "../modules/notifications/notification.service.js";
import { registerSfuHandlers } from "../sfu/index.js";
import { registerStreamHandlers } from "../modules/stream/stream.socket.js";
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
      registerStreamHandlers(socket); // stream chat, reactions, moderation

      (async () => {
        const conversations = await Conversation.find({ members: socket.userId }).select("_id").lean();
        conversations.forEach((conv) => socket.join(conv._id.toString()));

        const unreadCount = await Notification.countDocuments({ user: socket.userId, isRead: false });
        socket.emit("notification-count", { count: unreadCount });
      })().catch((error) => console.error("Socket setup error:", error.message));

      // Only members may listen to a conversation's messages / typing events
      socket.on("join-conversation", async (conversationId) => {
        try {
          const member = await Conversation.exists({ _id: conversationId, members: socket.userId });
          if (member) socket.join(String(conversationId));
        } catch {
          /* malformed id — ignore */
        }
      });

      socket.on("leave-conversation", (conversationId) => {
        socket.leave(conversationId);
      });

      // Text messages. Attachments go over HTTP (POST /api/chat/messages/attachment); both paths
      // share sendChatMessage, which enforces the friends-only rule and delivers + notifies.
      socket.on("send-message", async (data = {}) => {
        try {
          await sendChatMessage({
            senderId: socket.userId,
            conversationId: data.conversationId,
            content: data.content,
          });
        } catch (error) {
          if (!error.status) console.error("Error sending message:", error);
          socket.emit("error", {
            message: error.status ? error.message : "Failed to send message",
            code: error.code,
          });
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
