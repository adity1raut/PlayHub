import express from "express";
import authenticateToken from "../../middleware/auth.js";
import upload from "../../config/multer.js";
import {
  CreatePost,
  getFeed,
  SinglePost,
  DeletePost,
  likePost,
  addComment,
  getUserpost,
  searchPosts,
} from "./post.controller.js";

const router = express.Router();

router.post("/create", authenticateToken, upload.single("media"), CreatePost);
router.get("/feed", authenticateToken, getFeed);
router.get("/user/:username", authenticateToken, getUserpost);
router.get("/search/:query", authenticateToken, searchPosts);
router.get("/:postId", authenticateToken, SinglePost);
router.delete("/:postId", authenticateToken, DeletePost);
router.post("/:postId/like", authenticateToken, likePost);
router.post("/:postId/comment", authenticateToken, addComment);

export default router;
