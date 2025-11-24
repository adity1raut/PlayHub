import crypto from "crypto";
import bcrypt from "bcryptjs";
import User from "../../models/User.models.js";
import transporter from "../../config/nodeMailer.js";
import dotenv from "dotenv";

dotenv.config();
const otpStore = new Map();

export async function checkAvailability(identifier) {
  try {
    if (!identifier) throw new Error("Username or Email required");

    const existingUser = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }],
    });

    if (existingUser) {
      throw new Error("Email or Username already exists");
    }

    return { success: true, message: "Available" };
  } catch (error) {
    console.error("Error checking availability:", error);
    throw error;
  }
}

// Send OTP (Registration)
export async function sendRegistrationOTP(email) {
  try {
    if (!email) throw new Error("Email required");

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new Error("Email already exists");
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    otpStore.set(email, {
      code: otp,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
      verified: false,
    });

    const gamingEmailContent = `
🎮 WELCOME TO THE ARENA, GAMER! 🎮

Your secret access code has been generated:

🔑 ACTIVATION CODE: ${otp}

⚡ This code will self-destruct in 5 minutes! ⚡
🛡️ Use it to unlock your gaming account and join the battle!

Ready to dominate the leaderboards? Enter your code now!

🎯 Game on!
- The Spark Gaming Team
    `;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "🎮 Your Gaming Arena Access Code - Level Up Your Account! 🚀",
      text: gamingEmailContent,
      html: `
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; font-family: 'Courier New', monospace; color: white;">
          <div style="background: rgba(0,0,0,0.8); padding: 30px; border-radius: 15px; border: 2px solid #00ff00; text-align: center;">
            <h1 style="color: #00ff00; text-shadow: 0 0 10px #00ff00;">🎮 WELCOME TO THE ARENA 🎮</h1>
            <div style="background: #1a1a1a; padding: 20px; border-radius: 10px; margin: 20px 0; border: 1px solid #ff6b6b;">
              <h2 style="color: #ff6b6b; margin: 0;">🔑 ACTIVATION CODE</h2>
              <div style="font-size: 36px; color: #00ff00; font-weight: bold; letter-spacing: 5px; margin: 15px 0; text-shadow: 0 0 15px #00ff00;">${otp}</div>
            </div>
            <p style="color: #ffeb3b; font-size: 18px;">⚡ Code expires in 5 minutes! ⚡</p>
            <p style="color: #87ceeb;">🛡️ Use this code to unlock your gaming account and join the battle!</p>
            <p style="color: #98fb98;">Ready to dominate the leaderboards? Enter your code now!</p>
            <div style="margin-top: 30px; padding: 15px; background: rgba(255,255,255,0.1); border-radius: 8px;">
              <p style="color: #ffd700; margin: 0;">🎯 Game on!</p>
              <p style="color: #ddd; margin: 5px 0 0 0;">- The Spark Gaming Team</p>
            </div>
          </div>
        </div>
      `,
    });

    console.log("Registration OTP sent:", otp);
    return {
      success: true,
      message: "Gaming access code sent to your email! 🎮",
    };
  } catch (error) {
    console.error("Error sending registration OTP:", error);
    throw error;
  }
}

// Resend OTP (Registration)
export async function resendRegistrationOTP(email) {
  try {
    if (!email) throw new Error("Email required");

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new Error("Email already exists");
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    otpStore.set(email, {
      code: otp,
      expiresAt: Date.now() + 5 * 60 * 1000,
      verified: false,
    });

    const resendEmailContent = `
🔄 CODE REFRESH REQUESTED 🔄

A new access code has been generated, gamer!

🔑 NEW ACTIVATION CODE: ${otp}

⚡ This code will expire in 5 minutes! ⚡
🎮 Your previous code has been deactivated.

Don't let this opportunity slip away - enter your new code and join the action!

🚀 Level up now!
- The Spark Gaming Team
    `;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "🔄 New Gaming Access Code - Don't Miss Out! 🎮",
      text: resendEmailContent,
      html: `
        <div style="background: linear-gradient(135deg, #ff6b6b 0%, #ffa726 100%); padding: 20px; font-family: 'Courier New', monospace; color: white;">
          <div style="background: rgba(0,0,0,0.8); padding: 30px; border-radius: 15px; border: 2px solid #ffa726; text-align: center;">
            <h1 style="color: #ffa726; text-shadow: 0 0 10px #ffa726;">🔄 CODE REFRESH REQUESTED 🔄</h1>
            <p style="color: #ffeb3b;">A new access code has been generated, gamer!</p>
            <div style="background: #1a1a1a; padding: 20px; border-radius: 10px; margin: 20px 0; border: 1px solid #00ff00;">
              <h2 style="color: #00ff00; margin: 0;">🔑 NEW ACTIVATION CODE</h2>
              <div style="font-size: 36px; color: #00ff00; font-weight: bold; letter-spacing: 5px; margin: 15px 0; text-shadow: 0 0 15px #00ff00;">${otp}</div>
            </div>
            <p style="color: #ff6b6b; font-size: 18px;">⚡ This code expires in 5 minutes! ⚡</p>
            <p style="color: #87ceeb;">🎮 Your previous code has been deactivated.</p>
            <p style="color: #98fb98;">Don't let this opportunity slip away - enter your new code and join the action!</p>
            <div style="margin-top: 30px; padding: 15px; background: rgba(255,255,255,0.1); border-radius: 8px;">
              <p style="color: #ffd700; margin: 0;">🚀 Level up now!</p>
              <p style="color: #ddd; margin: 5px 0 0 0;">- The Spark Gaming Team</p>
            </div>
          </div>
        </div>
      `,
    });

    console.log("Registration OTP resent:", otp);
    return { success: true, message: "New gaming access code sent! 🎮🔄" };
  } catch (error) {
    console.error("Error resending registration OTP:", error);
    throw error;
  }
}

// Verify Registration OTP
export async function verifyRegistrationOTP(email, otp) {
  try {
    if (!email || !otp) throw new Error("Email and OTP required");

    const storedOtp = otpStore.get(email);
    if (!storedOtp) {
      throw new Error("OTP not requested");
    }

    if (storedOtp.expiresAt < Date.now()) {
      throw new Error("OTP expired, please request a new one");
    }

    if (storedOtp.code !== otp) {
      throw new Error("Invalid OTP");
    }

    // Mark OTP as verified
    storedOtp.verified = true;
    otpStore.set(email, storedOtp);

    return { success: true, message: "OTP verified successfully" };
  } catch (error) {
    console.error("Error verifying registration OTP:", error);
    throw error;
  }
}

// Register User
export async function registerUser(userData) {
  try {
    const { username, email, name, otp, password, confirmPassword } = userData;

    // Verify OTP first
    const otpVerification = await verifyRegistrationOTP(email, otp);
    if (!otpVerification.success) {
      throw new Error(otpVerification.message);
    }

    if (password !== confirmPassword) {
      throw new Error("Passwords do not match");
    }

    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });
    if (existingUser) {
      throw new Error("Email or Username already exists");
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      profile: { name },
    });
    await newUser.save();

    otpStore.delete(email); // cleanup

    return {
      success: true,
      message: "Account created successfully",
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        profile: newUser.profile,
      },
    };
  } catch (error) {
    console.error("Error registering user:", error);
    throw error;
  }
}
