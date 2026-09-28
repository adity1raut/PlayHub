import express from "express";
import Post from "../posts/post.model.js";
import User from "./user.model.js";
import generateToken, { authCookieOptions } from "../../utils/generateToken.js";
import authenticateToken from "../../middleware/auth.js";
import { toggleFollow } from "./follow.service.js";
import { chatAccess, friendIdsOf } from "./friends.js";
import {
  loginUser,
  logoutUser,
  getProfile,
  updateProfile,
  getSettings,
  updateSettings,
  changePassword,
} from "./auth.controller.js";
import {
  checkAvailability,
  sendRegistrationOTP,
  resendRegistrationOTP,
  verifyRegistrationOTP,
  registerUser,
} from "./signup.controller.js";
import {
  sendOTP,
  resendOTP,
  verifyOTP,
  resetPassword,
} from "./forgotPassword.controller.js";

const router = express.Router();

// Fields other users may see. Email, saved addresses, wishlist, conversations and settings stay private.
const PUBLIC_USER_EXCLUDE = "-password -email -addresses -wishlist -conversations -settings";
const PUBLIC_USER_FIELDS = "username profile followers following";

// --- Auth ---
router.post("/login", async (req, res) => {
  try {
    const { identifier, password } = req.body;
    const result = await loginUser(identifier, password);
    generateToken(res, result.user);
    res.status(200).json({ username: result.username, message: result.message });
  } catch (error) {
    res.status(400).json({ error: true, message: error.message });
  }
});

router.post("/logout", (req, res) => {
  logoutUser();
  res.clearCookie("token", authCookieOptions);
  res.status(200).json({ success: true, message: "Logged out successfully" });
});

// --- Profile ---
router.get("/profile", authenticateToken, (req, res) => getProfile(req, res));

router.get("/profile/me/posts", authenticateToken, async (req, res) => {
  try {
    const posts = await Post.find({ author: req.user.id })
      .sort({ createdAt: -1 })
      .populate({ path: "author", select: "username profile" });
    return res.json({ success: true, data: posts });
  } catch (error) {
    console.error("Fetch my posts error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/profile/:username", authenticateToken, async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username })
      .select(PUBLIC_USER_EXCLUDE)
      .lean();
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    // chat.open: you can message them even without being friends (both allow everyone).
    // Friendship itself is derived live on the client from followers/following.
    const access = (await chatAccess(req.user.id, [user._id])).get(String(user._id));
    return res.json({ success: true, data: { ...user, chat: { open: Boolean(access?.open) } } });
  } catch (error) {
    console.error("Profile by username error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.put("/profile", authenticateToken, (req, res) => updateProfile(req, res));

// --- Settings ---
router.get("/settings", authenticateToken, getSettings);
router.put("/settings", authenticateToken, updateSettings);
router.put("/password", authenticateToken, changePassword);

router.post("/profile/:username/follow", authenticateToken, async (req, res) => {
  try {
    const targetUser = await User.findOne({ username: req.params.username }).select("_id").lean();
    if (!targetUser) return res.status(404).json({ success: false, message: "User not found" });

    const result = await toggleFollow(req.user.id, targetUser._id);
    return res.json({ success: true, ...result });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    console.error("Follow error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/profile/:username/followers", authenticateToken, async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username }).populate({
      path: "followers",
      select: PUBLIC_USER_FIELDS,
    });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    return res.json({ success: true, data: user.followers });
  } catch (error) {
    console.error("Fetch followers error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/profile/:username/following", authenticateToken, async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username }).populate({
      path: "following",
      select: PUBLIC_USER_FIELDS,
    });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    return res.json({ success: true, data: user.following });
  } catch (error) {
    console.error("Fetch following error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// Friends = mutual followers. Public, like the followers / following lists they're derived from.
router.get("/profile/:username/friends", authenticateToken, async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username }).select("followers following").lean();
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    const friends = await User.find({ _id: { $in: friendIdsOf(user) } })
      .select(PUBLIC_USER_FIELDS)
      .lean();
    return res.json({ success: true, data: friends });
  } catch (error) {
    console.error("Fetch friends error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/profile/:username/posts", authenticateToken, async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    const posts = await Post.find({ author: user._id })
      .sort({ createdAt: -1 })
      .populate({ path: "author", select: "username profile" });
    return res.json({ success: true, data: posts });
  } catch (error) {
    console.error("Fetch user posts error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// --- Registration ---
router.post("/check-availability", async (req, res) => {
  try {
    const result = await checkAvailability(req.body.identifier);
    res.status(200).json(result);
  } catch (error) {
    res.status(error.status || 400).json({ success: false, message: error.message });
  }
});

router.post("/send-otp", async (req, res) => {
  try {
    const result = await sendRegistrationOTP(req.body.email, req.body.name);
    res.status(200).json(result);
  } catch (error) {
    res.status(error.status || 400).json({ success: false, message: error.message });
  }
});

router.post("/resend-otp", async (req, res) => {
  try {
    const result = await resendRegistrationOTP(req.body.email, req.body.name);
    res.status(200).json(result);
  } catch (error) {
    res.status(error.status || 400).json({ success: false, message: error.message });
  }
});

router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    const result = await verifyRegistrationOTP(email, otp);
    res.status(200).json(result);
  } catch (error) {
    res.status(error.status || 400).json({ success: false, message: error.message });
  }
});

router.post("/register", async (req, res) => {
  try {
    const result = await registerUser(req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(error.status || 400).json({ success: false, message: error.message });
  }
});

// --- Password Reset ---
router.post("/send-reset-otp", async (req, res) => {
  try {
    const result = await sendOTP(req.body.identifier);
    res.status(200).json(result);
  } catch (error) {
    res.status(error.status || 400).json({ success: false, message: error.message });
  }
});

router.post("/resend-reset-otp", async (req, res) => {
  try {
    const result = await resendOTP(req.body.identifier);
    res.status(200).json(result);
  } catch (error) {
    res.status(error.status || 400).json({ success: false, message: error.message });
  }
});

router.post("/verify-reset-otp", async (req, res) => {
  try {
    const { identifier, otp } = req.body;
    const result = await verifyOTP(identifier, otp);
    res.status(200).json(result);
  } catch (error) {
    res.status(error.status || 400).json({ success: false, message: error.message });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { identifier, newPassword } = req.body;
    const result = await resetPassword(identifier, newPassword);
    res.status(200).json(result);
  } catch (error) {
    res.status(error.status || 400).json({ success: false, message: error.message });
  }
});

export default router;
