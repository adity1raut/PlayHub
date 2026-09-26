import crypto from "crypto";
import Otp from "./otp.model.js";
import mailer from "../../config/nodemailer.js";

export const OTP_LENGTH = 6;
const CODE_TTL_MINUTES = 10; // how long an emailed code can be used
const VERIFIED_TTL_MINUTES = 30; // how long a verified code lets you finish sign-up / reset
const MAX_ATTEMPTS = 5;

const minutesFromNow = (m) => new Date(Date.now() + m * 60 * 1000);
const hash = (code) => crypto.createHash("sha256").update(String(code)).digest("hex");

export const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

// Accept "123 456", " 123456 ", 123456 … — only the digits matter.
const normalizeCode = (code) => String(code ?? "").replace(/\D/g, "");

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

const SUBJECTS = {
  register: "Your PlayHub verification code",
  reset: "Your PlayHub password reset code",
};

const INTROS = {
  register: "Use this code to verify your email and finish creating your PlayHub account.",
  reset: "Use this code to reset your PlayHub password.",
};

function emailHtml(code, purpose) {
  return `
  <div style="background:#0a0f17;padding:32px 16px;font-family:'JetBrains Mono',Menlo,Consolas,monospace;color:#e9edf5">
    <div style="max-width:420px;margin:0 auto;border:1px solid #3a4658;background:#0e141e;padding:28px">
      <p style="margin:0;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#5eead4;font-weight:700">PlayHub</p>
      <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#8e98aa">${INTROS[purpose]}</p>
      <p style="margin:22px 0;padding:16px 0;border:1px solid #5eead4;background:rgba(94,234,212,.08);text-align:center;font-size:32px;font-weight:800;letter-spacing:.35em;color:#5eead4">${code}</p>
      <p style="margin:0;font-size:12px;color:#8e98aa">This code expires in ${CODE_TTL_MINUTES} minutes. If you didn't ask for it, you can ignore this email.</p>
    </div>
  </div>`;
}

/**
 * Create a fresh code for (email, purpose), replacing any previous one, and email it.
 * Only the newest code works — tell users to use the latest email.
 */
export async function issueOtp(email, purpose) {
  const to = normalizeEmail(email);
  const code = crypto.randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, "0");

  await Otp.findOneAndUpdate(
    { email: to, purpose },
    { codeHash: hash(code), attempts: 0, verified: false, expiresAt: minutesFromNow(CODE_TTL_MINUTES) },
    { upsert: true, setDefaultsOnInsert: true },
  );

  if (process.env.NODE_ENV !== "production") {
    console.log(`[dev] ${purpose} code for ${to}: ${code}`);
  }

  await mailer.sendMail({
    to,
    subject: SUBJECTS[purpose],
    text: `Your PlayHub code is ${code}. It expires in ${CODE_TTL_MINUTES} minutes.`,
    html: emailHtml(code, purpose),
  });

  return { expiresInSeconds: CODE_TTL_MINUTES * 60 };
}

/** Check a code. On success the record is marked verified for VERIFIED_TTL_MINUTES. */
export async function verifyOtp(email, purpose, code) {
  const to = normalizeEmail(email);
  const digits = normalizeCode(code);

  if (digits.length !== OTP_LENGTH) throw fail(`Enter the ${OTP_LENGTH}-digit code from the email`);

  const record = await Otp.findOne({ email: to, purpose });
  if (!record || record.expiresAt < new Date()) {
    throw fail("This code has expired or was never sent. Request a new code.");
  }
  if (record.verified) return { success: true, message: "Code already verified" };
  if (record.attempts >= MAX_ATTEMPTS) {
    throw fail("Too many wrong attempts. Request a new code.", 429);
  }

  if (record.codeHash !== hash(digits)) {
    record.attempts += 1;
    await record.save();
    const left = MAX_ATTEMPTS - record.attempts;
    throw fail(
      left > 0
        ? `Incorrect code — ${left} ${left === 1 ? "try" : "tries"} left. Use the code from the most recent email.`
        : "Too many wrong attempts. Request a new code.",
      left > 0 ? 400 : 429,
    );
  }

  record.verified = true;
  record.expiresAt = minutesFromNow(VERIFIED_TTL_MINUTES);
  await record.save();
  return { success: true, message: "Code verified" };
}

/** Require a verified code (verifying `code` first if given), then use it up. */
export async function consumeVerifiedOtp(email, purpose, code) {
  const to = normalizeEmail(email);
  let record = await Otp.findOne({ email: to, purpose });

  if ((!record || !record.verified) && code) {
    await verifyOtp(to, purpose, code);
    record = await Otp.findOne({ email: to, purpose });
  }
  if (!record || !record.verified || record.expiresAt < new Date()) {
    throw fail("Please verify the code from your email first.");
  }

  await Otp.deleteOne({ _id: record._id });
}
