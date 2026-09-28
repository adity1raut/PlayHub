import mongoose from "mongoose";
import Conversation from "./conversation.model.js";
import Message from "./message.model.js";
import { chatAccess, NOT_FRIENDS_MESSAGE } from "../auth/friends.js";
import { getNotificationService } from "../../socket/socket.handlers.js";
import { toRoom, toUser } from "../../socket/realtime.js";

export const MAX_MESSAGE_LENGTH = 1000; // Message.content maxLength

function chatError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  if (code) error.code = code;
  return error;
}

/**
 * Check that `senderId` may post in `conversationId`: they're a member, and every other member
 * is a friend (or both allow messages from everyone). Returns the other members' ids.
 */
export async function authorizeSend(senderId, conversationId) {
  if (!conversationId) throw chatError("Conversation ID is required", 400);
  if (!mongoose.isValidObjectId(conversationId)) throw chatError("Conversation not found", 404);

  const conversation = await Conversation.findOne({ _id: conversationId, members: senderId })
    .select("members")
    .lean();
  if (!conversation) throw chatError("Conversation not found", 404);

  const others = conversation.members.map(String).filter((id) => id !== String(senderId));
  const access = await chatAccess(senderId, others);
  if (others.some((id) => !access.get(id)?.canMessage)) {
    throw chatError(NOT_FRIENDS_MESSAGE, 403, "CHAT_FORBIDDEN");
  }
  return others;
}

const ATTACHMENT_NOUNS = { image: "a photo", video: "a video", audio: "an audio clip", file: "a file" };

function notificationText(senderName, message) {
  const content = message.content || "";
  const preview = `${content.substring(0, 50)}${content.length > 50 ? "..." : ""}`;
  if (!message.attachments?.length) return `${senderName} sent you a message: ${preview}`;
  const noun = ATTACHMENT_NOUNS[message.type] ?? ATTACHMENT_NOUNS.file;
  return preview ? `${senderName} sent you ${noun}: ${preview}` : `${senderName} sent you ${noun}`;
}

/**
 * Save a message and deliver it: `new-message` to the conversation room, `conversation-updated`
 * to every member's tabs, and a MESSAGE notification (+ push) to the other members.
 * Throws errors with `status` (and `code: "CHAT_FORBIDDEN"` when they aren't friends).
 */
export async function sendChatMessage({ senderId, conversationId, content = "", type = "text", attachments = [] }) {
  const text = String(content ?? "").trim();
  if (!text && !attachments.length) throw chatError("Message content is required", 400);
  if (text.length > MAX_MESSAGE_LENGTH) {
    throw chatError(`Messages can be at most ${MAX_MESSAGE_LENGTH} characters`, 400);
  }

  const others = await authorizeSend(senderId, conversationId);

  const message = await Message.create({
    conversationId,
    sender: senderId,
    content: text,
    type: attachments.length ? type : "text",
    attachments,
  });
  await Conversation.updateOne(
    { _id: conversationId },
    { $set: { lastMessage: message._id }, $push: { messages: message._id } },
  );
  await message.populate("sender", "username profile.name profile.profileImage");

  toRoom(conversationId, "new-message", message);

  const updatedConversation = await Conversation.findById(conversationId)
    .populate("members", "username profile.name profile.profileImage")
    .populate("lastMessage");
  // user_<id> rooms reach every open tab of each member, even before they join the conversation room
  [String(senderId), ...others].forEach((id) => toUser(id, "conversation-updated", updatedConversation));

  const notifications = getNotificationService();
  if (notifications) {
    const senderName = message.sender?.profile?.name || message.sender?.username || "Someone";
    const body = notificationText(senderName, message);
    for (const id of others) {
      notifications
        .createNotification(id, "MESSAGE", body, `/chat/${conversationId}`, senderId)
        .catch((error) => console.error("Error creating message notification:", error.message));
    }
  }

  return message;
}
