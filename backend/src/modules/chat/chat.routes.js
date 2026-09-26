import express from "express";
import authenticateToken from "../../middleware/auth.js";
import {
  getConversations,
  createOrGetConversation,
  getMessages,
  sendMessage,
  searchUsers,
} from "./chat.controller.js";

const router = express.Router();

router.get("/conversations", authenticateToken, getConversations);
router.post("/conversations", authenticateToken, createOrGetConversation);
router.get("/conversations/:conversationId/messages", authenticateToken, getMessages);
router.post("/messages", authenticateToken, sendMessage);
router.get("/search", authenticateToken, searchUsers);

export default router;
