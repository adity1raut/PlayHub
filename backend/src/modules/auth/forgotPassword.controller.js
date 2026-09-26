import bcrypt from "bcryptjs";
import User from "./user.model.js";
import { consumeVerifiedOtp, issueOtp, normalizeEmail, verifyOtp } from "./otp.service.js";

// "identifier" is either the account email (any case) or the username
async function findUser(identifier) {
  const value = String(identifier || "").trim();
  if (!value) throw new Error("Email or username required");

  const user = await User.findOne({ $or: [{ email: normalizeEmail(value) }, { username: value }] });
  if (!user) throw new Error("No account found with this email or username");
  return user;
}

export async function sendOTP(identifier) {
  const user = await findUser(identifier);
  const { expiresInSeconds } = await issueOtp(user.email, "reset");
  return { success: true, message: "Reset code sent to your email", expiresInSeconds };
}

// Resending simply issues a new code (the old one stops working)
export const resendOTP = sendOTP;

export async function verifyOTP(identifier, otp) {
  if (!otp) throw new Error("Code required");
  const user = await findUser(identifier);
  return verifyOtp(user.email, "reset", otp);
}

export async function resetPassword(identifier, newPassword) {
  if (!newPassword || newPassword.length < 6) throw new Error("Password must be at least 6 characters");

  const user = await findUser(identifier);
  await consumeVerifiedOtp(user.email, "reset");

  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();

  return { success: true, message: "Password updated. You can sign in now." };
}
