import mongoose from "mongoose";
import Conversation from "./conversation.model.js";
import Message from "./message.model.js";
import User from "../auth/user.model.js";
import { chatAccess, friendIdsOf, NOT_FRIENDS_MESSAGE } from "../auth/friends.js";
import { getNotificationService } from "../../socket/socket.handlers.js";
import { authorizeSend, sendChatMessage } from "./chat.service.js";
import { storeAttachment } from "./attachments.js";

const PLAYER_FIELDS = "username profile.name profile.profileImage profile.bio";

const playerCard = (user, access) => ({
  _id: user._id,
  username: user.username,
  profile: {
    name: user.profile?.name || null,
    profileImage: user.profile?.profileImage,
    bio: user.profile?.bio,
  },
  isFriend: Boolean(access?.isFriend),
  canMessage: Boolean(access?.canMessage),
});

const otherMemberId = (conversation, me) =>
  conversation.members.map((m) => String(m?._id ?? m)).find((id) => id !== String(me));

/** Attach { isFriend, canMessage } for the other member to each conversation (JSON-ready). */
async function withAccess(conversations, me) {
  const access = await chatAccess(
    me,
    conversations.map((c) => otherMemberId(c, me)).filter(Boolean),
  );
  return conversations.map((c) => {
    const a = access.get(otherMemberId(c, me));
    return { ...c.toJSON(), isFriend: Boolean(a?.isFriend), canMessage: Boolean(a?.canMessage) };
  });
}

function sendError(res, error, fallback) {
  if (error.status) {
    return res.status(error.status).json({ success: false, message: error.message, code: error.code });
  }
  console.error(`${fallback}:`, error);
  return res.status(500).json({ success: false, message: "Server error" });
}

export async function searchUsers(req, res) {
  try {
    const { query, type = "username" } = req.query;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Search query must be at least 2 characters long",
      });
    }

    const pattern = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const field = type === "name" ? "profile.name" : "username";
    const searchQuery = {
      [field]: { $regex: pattern, $options: "i" },
      _id: { $ne: req.user.id },
    };

    const users = await User.find(searchQuery).select(PLAYER_FIELDS).limit(10).lean();
    const access = await chatAccess(req.user.id, users.map((u) => u._id));

    res.json({ success: true, users: users.map((u) => playerCard(u, access.get(String(u._id)))) });
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during search",
    });
  }
}

/** Your friends (mutual followers) — the people you can start a chat with. */
export async function getFriends(req, res) {
  try {
    const me = await User.findById(req.user.id).select("following followers").lean();
    if (!me) return res.status(404).json({ success: false, message: "User not found" });

    const friends = await User.find({ _id: { $in: friendIdsOf(me) } })
      .select(PLAYER_FIELDS)
      .lean();
    friends.sort((a, b) =>
      (a.profile?.name || a.username).localeCompare(b.profile?.name || b.username, undefined, { sensitivity: "base" }),
    );
    // Friends can always message each other
    res.json({ success: true, users: friends.map((u) => playerCard(u, { isFriend: true, canMessage: true })) });
  } catch (error) {
    console.error("Error fetching friends:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function getConversations(req, res) {
  try {
    const conversations = await Conversation.find({
      members: req.user.id,
    })
      .populate("members", "username profile firstName lastName")
      .populate("lastMessage")
      .sort({ updatedAt: -1 });

    res.json({ success: true, conversations: await withAccess(conversations, req.user.id) });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function getMessages(req, res) {
  try {
    const { conversationId } = req.params;

    if (!mongoose.isValidObjectId(conversationId)) {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      members: req.user.id,
    });

    if (!conversation) {
      return res
        .status(404)
        .json({ success: false, message: "Conversation not found" });
    }

    const messages = await Message.find({ conversationId })
      .populate("sender", "username profile firstName lastName")
      .sort({ createdAt: 1 });

    res.json({ success: true, messages });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

/**
 * Open the 1:1 conversation with `userId`. An existing thread always opens (its history stays
 * readable, flagged canMessage: false if you're no longer friends); a new one needs permission.
 */
export async function createOrGetConversation(req, res) {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res
        .status(400)
        .json({ success: false, message: "User ID is required" });
    }

    if (String(userId) === String(req.user.id)) {
      return res.status(400).json({ success: false, message: "You can't message yourself" });
    }

    const access = (await chatAccess(req.user.id, [userId])).get(String(userId));
    if (!access) return res.status(404).json({ success: false, message: "User not found" });

    let conversation = await Conversation.findOne({
      members: { $all: [req.user.id, userId] },
    }).populate("members", "username profile firstName lastName");

    if (!conversation) {
      if (!access.canMessage) {
        return res.status(403).json({ success: false, message: NOT_FRIENDS_MESSAGE, code: "CHAT_FORBIDDEN" });
      }
      conversation = new Conversation({ members: [req.user.id, userId] });
      await conversation.save();
      await User.updateMany(
        { _id: { $in: [req.user.id, userId] } },
        { $addToSet: { conversations: conversation._id } },
      );
      // Put both users' open sockets (all tabs) into the new conversation room
      const io = getNotificationService()?.io;
      if (io) {
        [req.user.id, userId].forEach((id) =>
          io.in(`user_${id}`).socketsJoin(conversation._id.toString()),
        );
      }
      conversation = await Conversation.findById(conversation._id).populate(
        "members",
        "username profile firstName lastName",
      );
    }

    res.json({
      success: true,
      conversation: { ...conversation.toJSON(), isFriend: access.isFriend, canMessage: access.canMessage },
    });
  } catch (error) {
    console.error("Error creating conversation:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function sendMessage(req, res) {
  try {
    const { conversationId, content } = req.body;
    const message = await sendChatMessage({ senderId: req.user.id, conversationId, content });
    res.json({ success: true, message });
  } catch (error) {
    return sendError(res, error, "Error sending message");
  }
}

/** multipart: file (required), conversationId, content (optional caption) */
export async function sendAttachment(req, res) {
  try {
    const { conversationId, content = "" } = req.body;
    if (!req.file) return res.status(400).json({ success: false, message: "Choose a file to send" });

    // Check before uploading so a refused message never leaves an orphaned file behind
    await authorizeSend(req.user.id, conversationId);

    let stored;
    try {
      stored = await storeAttachment(req.file);
    } catch (uploadError) {
      console.error("Chat attachment upload error:", uploadError);
      return res.status(502).json({ success: false, message: "Couldn't upload that file. Please try again." });
    }

    const message = await sendChatMessage({
      senderId: req.user.id,
      conversationId,
      content,
      type: stored.type,
      attachments: [stored.attachment],
    });
    res.status(201).json({ success: true, message });
  } catch (error) {
    return sendError(res, error, "Error sending attachment");
  }
}
