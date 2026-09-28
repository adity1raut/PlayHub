import User from "./user.model.js";
import bcrypt from "bcryptjs";
import cloudinary from "../../config/cloudinary.js";
import { settingsOf, settingsUpdate } from "./settings.js";
import { broadcast, toUser } from "../../socket/realtime.js";

const MIN_PASSWORD_LENGTH = 6; // same rule as sign-up

export async function loginUser(identifier, password) {
  if (!identifier || !password) throw new Error("Username/Email and password required");

  const user = await User.findOne({
    $or: [{ email: identifier.toLowerCase() }, { username: identifier }],
  });

  if (!user) throw new Error("Invalid username/email or password");

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) throw new Error("Invalid username/email or password");

  return { success: true, message: "Login successful", username: user.username, user };
}

export function logoutUser() {
  return { success: true, message: "Logged out successfully" };
}

export async function getProfile(req, res) {
  try {
    const user = await User.findById(req.user.id).select("-password").lean();
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    return res.json({ success: true, data: { ...user, settings: settingsOf(user) } });
  } catch (error) {
    console.error("Profile error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function getSettings(req, res) {
  try {
    const user = await User.findById(req.user.id).select("settings").lean();
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    return res.json({ success: true, data: settingsOf(user) });
  } catch (error) {
    console.error("Get settings error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

/** PUT /api/auth/settings — partial update, e.g. { notifications: { likes: false } } */
export async function updateSettings(req, res) {
  try {
    const $set = settingsUpdate(req.body);
    const user = await User.findByIdAndUpdate(req.user.id, { $set }, { new: true, runValidators: true })
      .select("settings")
      .lean();
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    const settings = settingsOf(user);
    toUser(req.user.id, "settings:updated", settings); // the user's other tabs (Settings page, AuthContext)
    return res.json({ success: true, message: "Settings saved", data: settings });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    console.error("Update settings error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body ?? {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "Current and new password are required" });
    }
    if (String(newPassword).length < MIN_PASSWORD_LENGTH) {
      return res
        .status(400)
        .json({ success: false, message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }

    const user = await User.findById(req.user.id).select("password");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    if (!(await bcrypt.compare(String(currentPassword), user.password))) {
      return res.status(400).json({ success: false, message: "Current password is incorrect" });
    }
    if (await bcrypt.compare(String(newPassword), user.password)) {
      return res.status(400).json({ success: false, message: "New password must be different from the current one" });
    }

    await User.updateOne({ _id: user._id }, { $set: { password: await bcrypt.hash(String(newPassword), 10) } });
    return res.json({ success: true, message: "Password changed" });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function updateProfile(req, res) {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const { name, bio, email } = req.body;

    if (name !== undefined) user.profile.name = String(name).trim();
    if (bio !== undefined) user.profile.bio = String(bio);
    if (email) {
      const normalized = String(email).trim().toLowerCase();
      if (normalized !== user.email) {
        const taken = await User.exists({ email: normalized, _id: { $ne: userId } });
        if (taken) return res.status(409).json({ success: false, message: "That email is already in use" });
        user.email = normalized;
      }
    }

    if (req.body.profileImage) {
      try {
        const uploadResponse = await cloudinary.uploader.upload(req.body.profileImage, {
          folder: "profile_pictures",
          public_id: `user_${userId}_profile`,
          overwrite: true,
        });
        user.profile.profileImage = uploadResponse.secure_url;
      } catch {
        return res.status(400).json({ success: false, message: "Failed to upload profile image" });
      }
    }

    if (req.body.coverImage) {
      try {
        const uploadResponse = await cloudinary.uploader.upload(req.body.coverImage, {
          folder: "cover_images",
          public_id: `user_${userId}_cover`,
          overwrite: true,
        });
        user.profile.coverImage = uploadResponse.secure_url;
      } catch {
        return res.status(400).json({ success: false, message: "Failed to upload cover image" });
      }
    }

    await user.save();

    // Public fields only (never the email): profile pages, chat lists and the user's other tabs patch live
    broadcast("user:updated", {
      userId: String(user._id),
      username: user.username,
      profile: {
        name: user.profile.name,
        bio: user.profile.bio,
        profileImage: user.profile.profileImage,
        coverImage: user.profile.coverImage,
      },
    });

    const { password: _password, ...safeUser } = user.toObject();
    res.status(200).json({ success: true, message: "Profile updated successfully", data: safeUser });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getProfileByUsername(req, res) {
  try {
    const user = await User.findOne({ username: req.params.username }).select("-password").lean();
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    return res.json({ success: true, data: user });
  } catch (error) {
    console.error("Profile by username error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
