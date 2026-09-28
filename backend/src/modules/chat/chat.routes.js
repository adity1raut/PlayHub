import express from "express";
import authenticateToken from "../../middleware/auth.js";
import { chatUpload } from "./attachments.js";
import {
  getConversations,
  createOrGetConversation,
  getMessages,
  sendMessage,
  sendAttachment,
  searchUsers,
  getFriends,
} from "./chat.controller.js";

const router = express.Router();

router.get("/conversations", authenticateToken, getConversations);
router.post("/conversations", authenticateToken, createOrGetConversation);
router.get("/conversations/:conversationId/messages", authenticateToken, getMessages);
router.post("/messages", authenticateToken, sendMessage);
router.post("/messages/attachment", authenticateToken, chatUpload.single("file"), sendAttachment);
router.get("/search", authenticateToken, searchUsers);
router.get("/friends", authenticateToken, getFriends);

export default router;
