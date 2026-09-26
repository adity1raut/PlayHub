import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

// Google shows App Passwords as "abcd efgh ijkl mnop"; SMTP needs them without spaces.
const pass = (process.env.MAIL_PASS || "").replace(/\s+/g, "");

const transporter = nodemailer.createTransport({
  service: process.env.MAIL_SERVICE || "gmail",
  auth: {
    user: process.env.MAIL_USER,
    pass,
  },
});

const isAuthError = (error) => error?.responseCode === 535 || error?.code === "EAUTH";

function explain(error) {
  if (!process.env.MAIL_USER || !pass) {
    return "MAIL_USER / MAIL_PASS are not set in backend/.env.";
  }
  if (isAuthError(error)) {
    return (
      "Gmail rejected MAIL_USER / MAIL_PASS. MAIL_PASS must be a 16-letter App Password " +
      "for the same Google account as MAIL_USER (2-Step Verification on) — create a new one at " +
      "https://myaccount.google.com/apppasswords and restart the server. " +
      "App Passwords are revoked whenever the Google account password changes."
    );
  }
  return error?.message || String(error);
}

/** Check the SMTP login once at startup so a bad password shows up in the server log. */
export async function verifyMailer() {
  try {
    await transporter.verify();
    console.log(`Mail: ready (${process.env.MAIL_USER})`);
    return true;
  } catch (error) {
    console.warn(`Mail: NOT working — ${explain(error)}`);
    return false;
  }
}

/**
 * Send an email. SMTP problems are logged with the real cause, and callers get an
 * Error with a user-safe message and HTTP status 503 instead of Google's raw reply.
 */
async function sendMail(options) {
  try {
    return await transporter.sendMail({ from: process.env.MAIL_USER, ...options });
  } catch (error) {
    console.error(`Mail send failed — ${explain(error)}`);
    const friendly = new Error(
      "We couldn't send the verification email right now. Please try again in a few minutes.",
    );
    friendly.status = 503;
    friendly.code = "MAIL_FAILED";
    throw friendly;
  }
}

export default { sendMail };
