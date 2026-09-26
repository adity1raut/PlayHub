import express from "express";
import authRouter from "./modules/auth/auth.routes.js";
import chatRouter from "./modules/chat/chat.routes.js";
import postRouter from "./modules/posts/post.routes.js";
import notificationRouter from "./modules/notifications/notification.routes.js";
import storeRouter from "./modules/store/store.routes.js";
import streamRouter from "./modules/stream/stream.routes.js";

const router = express.Router();

router.use("/api/auth", authRouter);
router.use("/api/chat", chatRouter);
router.use("/api/posts", postRouter);
router.use("/api/notifications", notificationRouter);
router.use("/api/stores", storeRouter);
router.use("/api/stream", streamRouter);

export default router;
