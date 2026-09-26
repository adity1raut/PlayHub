import express from "express";
import authenticateToken from "../../middleware/auth.js";
import {
  getNotification,
  unreadNotification,
  markNotification,
  readAll,
  deleteNotification,
} from "./notification.controller.js";
import {
  getPushPublicKey,
  subscribePush,
  unsubscribePush,
  sendTestPush,
} from "./push.controller.js";

const router = express.Router();

router.get("/", authenticateToken, getNotification);
router.get("/unread-count", authenticateToken, unreadNotification);

// Web Push (device alerts) — must stay above the /:id routes
router.get("/push/public-key", getPushPublicKey);
router.post("/push/subscribe", authenticateToken, subscribePush);
router.post("/push/unsubscribe", authenticateToken, unsubscribePush);
router.post("/push/test", authenticateToken, sendTestPush);

router.put("/read-all", authenticateToken, readAll);
router.put("/:id/read", authenticateToken, markNotification);
router.delete("/:id", authenticateToken, deleteNotification);

export default router;
