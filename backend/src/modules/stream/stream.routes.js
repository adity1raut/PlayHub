import express from "express";
import authenticateToken from "../../middleware/auth.js";
import {
  createStream,
  endStream,
  getAllLiveStreams,
  getStreamById,
  getUserStreams,
  joinStream,
  leaveStream,
  sendChatMessage,
  getStreamAnalytics,
} from "./stream.controller.js";

const router = express.Router();

router.post("/create", authenticateToken, createStream);
router.get("/live", getAllLiveStreams);
router.get("/user/my-streams", authenticateToken, getUserStreams);
router.get("/:id", authenticateToken, getStreamById);
router.get("/:id/analytics", authenticateToken, getStreamAnalytics);
router.put("/:id/end", authenticateToken, endStream);
router.post("/:id/join", authenticateToken, joinStream);
router.post("/:id/leave", authenticateToken, leaveStream);
router.post("/:id/chat", authenticateToken, sendChatMessage);

export default router;
