import bcrypt from "bcryptjs";
import User from "./user.model.js";
import { consumeVerifiedOtp, issueOtp, normalizeEmail, verifyOtp } from "./otp.service.js";

const USERNAME_RE = /^[a-zA-Z0-9_.]{3,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// "identifier" is either an email or a username
export async function checkAvailability(identifier) {
  const value = String(identifier || "").trim();
  if (!value) throw new Error("Username or email required");

  const existingUser = await User.exists({
    $or: [{ email: normalizeEmail(value) }, { username: value }],
  });
  if (existingUser) throw new Error("Email or username already exists");

  return { success: true, message: "Available" };
}

export async function sendRegistrationOTP(email) {
  const to = normalizeEmail(email);
  if (!EMAIL_RE.test(to)) throw new Error("Enter a valid email address");
  if (await User.exists({ email: to })) throw new Error("An account with this email already exists");

  const { expiresInSeconds } = await issueOtp(to, "register");
  return { success: true, message: "Verification code sent to your email", expiresInSeconds };
}

// Resending simply issues a new code (the old one stops working)
export const resendRegistrationOTP = sendRegistrationOTP;

export async function verifyRegistrationOTP(email, otp) {
  if (!email || !otp) throw new Error("Email and code required");
  return verifyOtp(email, "register", otp);
}

export async function registerUser(userData) {
  const { username, name, otp, password, confirmPassword } = userData;
  const email = normalizeEmail(userData.email);
  const cleanUsername = String(username || "").trim();

  if (!cleanUsername || !email || !password) throw new Error("Username, email and password are required");
  if (!USERNAME_RE.test(cleanUsername)) {
    throw new Error("Username must be 3–30 characters: letters, numbers, _ or .");
  }
  if (password.length < 6) throw new Error("Password must be at least 6 characters");
  if (confirmPassword !== undefined && password !== confirmPassword) throw new Error("Passwords do not match");

  const existingUser = await User.exists({ $or: [{ email }, { username: cleanUsername }] });
  if (existingUser) throw new Error("Email or username already exists");

  await consumeVerifiedOtp(email, "register", otp);

  const newUser = await User.create({
    username: cleanUsername,
    email,
    password: await bcrypt.hash(password, 10),
    profile: { name: String(name || "").trim() || cleanUsername },
  });

  return {
    success: true,
    message: "Account created successfully",
    user: { id: newUser._id, username: newUser.username, email: newUser.email, profile: newUser.profile },
  };
}
