import crypto from "crypto";
import bcrypt from "bcryptjs";
import User from "../../models/User.models.js";
import transporter from "../../config/nodeMailer.js";
import dotenv from "dotenv";

dotenv.config();
const otpStore = new Map();

// Send OTP (Forgot Password)
export async function sendOTP(identifier) {
  try {
    if (!identifier) throw new Error("Email or Username required");

    // find user by email or username
    const user = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }],
    });

    if (!user) throw new Error("No user found with this email or username");

    const otp = crypto.randomInt(1000, 9999).toString();
    otpStore.set(user.email, {
      otp,
      expiresAt: Date.now() + 2 * 60 * 1000,
      verified: false,
    });

    const gamingResetContent = `
🔐 ACCOUNT RECOVERY PROTOCOL ACTIVATED 🔐

Gamer, we've detected a password reset request for your account!

🛡️ SECURITY CODE: ${otp}

⏱️ This recovery code expires in 2 minutes!
🎮 Use this code to regain access to your gaming realm!

If you didn't request this, your account is still secure - just ignore this message.

🚀 Ready to get back in the game?
- The Spark Gaming Security Team
    `;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: "🔐 Gaming Account Recovery - Your Security Code Inside! 🎮",
      text: gamingResetContent,
      html: `
        <div style="background: linear-gradient(135deg, #ff4757 0%, #ff3742 100%); padding: 20px; font-family: 'Courier New', monospace; color: white;">
          <div style="background: rgba(0,0,0,0.9); padding: 30px; border-radius: 15px; border: 2px solid #ff6b6b; text-align: center;">
            <h1 style="color: #ff6b6b; text-shadow: 0 0 10px #ff6b6b;">🔐 ACCOUNT RECOVERY PROTOCOL 🔐</h1>
            <div style="background: #2d3436; padding: 20px; border-radius: 10px; margin: 20px 0; border: 2px solid #fdcb6e;">
              <h2 style="color: #fdcb6e; margin: 0; text-shadow: 0 0 5px #fdcb6e;">⚠️ SECURITY ALERT ⚠️</h2>
              <p style="color: #ddd; margin: 10px 0;">Password reset request detected for your gaming account!</p>
            </div>
            <div style="background: #1a1a1a; padding: 20px; border-radius: 10px; margin: 20px 0; border: 1px solid #00ff00;">
              <h2 style="color: #00ff00; margin: 0;">🛡️ SECURITY CODE</h2>
              <div style="font-size: 48px; color: #00ff00; font-weight: bold; letter-spacing: 10px; margin: 15px 0; text-shadow: 0 0 20px #00ff00;">${otp}</div>
            </div>
            <p style="color: #ff6b6b; font-size: 18px;">⏱️ Recovery code expires in 2 minutes!</p>
            <p style="color: #87ceeb;">🎮 Use this code to regain access to your gaming realm!</p>
            <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="color: #ffeaa7; margin: 0;">🔒 If you didn't request this, your account is still secure - just ignore this message.</p>
            </div>
            <div style="margin-top: 30px; padding: 15px; background: rgba(255,255,255,0.1); border-radius: 8px;">
              <p style="color: #ffd700; margin: 0;">🚀 Ready to get back in the game?</p>
              <p style="color: #ddd; margin: 5px 0 0 0;">- The Spark Gaming Security Team</p>
            </div>
          </div>
        </div>
      `,
    });

    console.log("OTP sent successfully:", otp);
    return { success: true, message: "Recovery code sent to your email! 🔐🎮" };
  } catch (error) {
    console.error("Error sending OTP:", error);
    throw error;
  }
}

// Resend OTP
export async function resendOTP(identifier) {
  try {
    if (!identifier) throw new Error("Email or Username required");

    const user = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }],
    });
    if (!user) throw new Error("No user found with this email or username");

    const otp = crypto.randomInt(1000, 9999).toString();
    otpStore.set(user.email, {
      otp,
      expiresAt: Date.now() + 2 * 60 * 1000,
      verified: false,
    });

    const resendResetContent = `
🔄 NEW RECOVERY CODE GENERATED 🔄

Your previous security code has been replaced, gamer!

🛡️ NEW SECURITY CODE: ${otp}

⏱️ This code expires in 2 minutes!
🎮 Your old code has been deactivated for security.

Time is ticking - enter your new code and reclaim your account!

⚡ Don't let anything stop your gaming session!
- The Spark Gaming Security Team
    `;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: "🔄 New Recovery Code Generated - Quick Action Required! 🎮",
      text: resendResetContent,
      html: `
        <div style="background: linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%); padding: 20px; font-family: 'Courier New', monospace; color: white;">
          <div style="background: rgba(0,0,0,0.9); padding: 30px; border-radius: 15px; border: 2px solid #a29bfe; text-align: center;">
            <h1 style="color: #a29bfe; text-shadow: 0 0 10px #a29bfe;">🔄 NEW RECOVERY CODE GENERATED 🔄</h1>
            <p style="color: #ffeb3b;">Your previous security code has been replaced, gamer!</p>
            <div style="background: #1a1a1a; padding: 20px; border-radius: 10px; margin: 20px 0; border: 1px solid #00ff00;">
              <h2 style="color: #00ff00; margin: 0;">🛡️ NEW SECURITY CODE</h2>
              <div style="font-size: 48px; color: #00ff00; font-weight: bold; letter-spacing: 10px; margin: 15px 0; text-shadow: 0 0 20px #00ff00;">${otp}</div>
            </div>
            <p style="color: #ff6b6b; font-size: 18px;">⏱️ This code expires in 2 minutes!</p>
            <p style="color: #87ceeb;">🎮 Your old code has been deactivated for security.</p>
            <p style="color: #98fb98;">Time is ticking - enter your new code and reclaim your account!</p>
            <div style="margin-top: 30px; padding: 15px; background: rgba(255,255,255,0.1); border-radius: 8px;">
              <p style="color: #ffd700; margin: 0;">⚡ Don't let anything stop your gaming session!</p>
              <p style="color: #ddd; margin: 5px 0 0 0;">- The Spark Gaming Security Team</p>
            </div>
          </div>
        </div>
      `,
    });

    console.log("Resent OTP:", otp);
    return { success: true, message: "New recovery code sent! 🔄🎮" };
  } catch (error) {
    console.error("Error resending OTP:", error);
    throw error;
  }
}

// Verify OTP
export async function verifyOTP(identifier, otp) {
  try {
    if (!identifier || !otp) throw new Error("Identifier and OTP required");

    // get user to map identifier -> email
    const user = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }],
    });
    if (!user) throw new Error("No user found with this email or username");

    const storedOtp = otpStore.get(user.email);
    if (
      !storedOtp ||
      storedOtp.otp !== otp ||
      storedOtp.expiresAt < Date.now()
    ) {
      throw new Error("Invalid or expired OTP");
    }

    storedOtp.verified = true; // mark OTP verified
    otpStore.set(user.email, storedOtp);

    return {
      success: true,
      message: "Security code verified! Access granted! 🔓🎮",
    };
  } catch (error) {
    console.error("Error verifying OTP:", error);
    throw error;
  }
}

// Reset Password
export async function resetPassword(identifier, newPassword) {
  try {
    if (!identifier || !newPassword)
      throw new Error("Identifier and new password required");

    const user = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }],
    });
    if (!user) throw new Error("No user found with this email or username");

    const storedOtp = otpStore.get(user.email);
    if (!storedOtp || !storedOtp.verified) {
      throw new Error("OTP not verified. Please verify OTP first.");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    otpStore.delete(user.email); // cleanup OTP

    return {
      success: true,
      message: "Password updated successfully! Welcome back, gamer! 🎮🚀",
    };
  } catch (error) {
    console.error("Error updating password:", error);
    throw error;
  }
}
