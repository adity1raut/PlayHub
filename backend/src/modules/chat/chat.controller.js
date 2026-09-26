import Conversation from "./conversation.model.js";
import Message from "./message.model.js";
import User from "../auth/user.model.js";
import { getNotificationService } from "../../socket/socket.handlers.js";

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

    const users = await User.find(searchQuery).select("username profile").limit(10);

    res.json({
      success: true,
      users: users.map((user) => ({
        _id: user._id,
        username: user.username,
        profile: {
          name: user.profile?.name || null,
          profileImage: user.profile?.profileImage,
          bio: user.profile?.bio,
        },
      })),
    });
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during search",
    });
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

    res.json({ success: true, conversations });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function getMessages(req, res) {
  try {
    const { conversationId } = req.params;

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

    let conversation = await Conversation.findOne({
      members: { $all: [req.user.id, userId] },
    }).populate("members", "username profile firstName lastName");

    if (!conversation) {
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

    res.json({ success: true, conversation });
  } catch (error) {
    console.error("Error creating conversation:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function sendMessage(req, res) {
  try {
    const { conversationId, content, type = "text" } = req.body;

    if (!conversationId || !content) {
      return res.status(400).json({
        success: false,
        message: "Conversation ID and content are required",
      });
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      members: req.user.id,
    }).populate("members", "username profile firstName lastName");

    if (!conversation) {
      return res
        .status(404)
        .json({ success: false, message: "Conversation not found" });
    }

    const message = new Message({
      conversationId,
      sender: req.user.id,
      content: String(content).trim(),
      type,
    });
    await message.save();

    conversation.lastMessage = message._id;
    if (conversation.messages) conversation.messages.push(message._id);
    conversation.updatedAt = new Date();
    await conversation.save();

    await message.populate("sender", "username profile.name profile.profileImage");

    // Deliver in real time exactly like the socket "send-message" path
    const notificationService = getNotificationService();
    const io = notificationService?.io;
    if (io) {
      io.to(String(conversationId)).emit("new-message", message);

      const updatedConversation = await Conversation.findById(conversationId)
        .populate("members", "username profile.name profile.profileImage")
        .populate("lastMessage");
      conversation.members.forEach((member) => {
        io.to(`user_${member._id}`).emit("conversation-updated", updatedConversation);
      });
    }

    const sender = await User.findById(req.user.id).select("username profile.name");
    const senderName = sender?.profile?.name || sender?.username || "Someone";
    const preview = `${content.substring(0, 50)}${content.length > 50 ? "..." : ""}`;
    const otherMembers = conversation.members.filter(
      (member) => member._id.toString() !== String(req.user.id),
    );

    for (const member of otherMembers) {
      try {
        if (notificationService) {
          await notificationService.createNotification(
            member._id,
            "MESSAGE",
            `${senderName} sent you a message: ${preview}`,
            `/chat/${conversationId}`,
            req.user.id,
          );
        }
      } catch (notificationError) {
        console.error("Error creating message notification:", notificationError);
      }
    }

    res.json({ success: true, message });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}
