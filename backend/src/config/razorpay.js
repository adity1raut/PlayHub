import Razorpay from "razorpay";

/**
 * Razorpay mode from the configured keys:
 *  - "test": keys start with rzp_test_ — dummy payments (test UPI / netbanking / cards), no real money
 *  - "live": keys start with rzp_live_ — real payments
 *  - null:   keys missing or still the .env.example placeholders — checkout is switched off
 */
export function paymentMode() {
  const keyId = process.env.RAZORPAY_KEY_ID || "";
  const secret = process.env.RAZORPAY_KEY_SECRET || "";
  if (!secret || /^your_/i.test(secret)) return null;
  if (keyId.startsWith("rzp_test_")) return "test";
  if (keyId.startsWith("rzp_live_")) return "live";
  return null;
}

let client = null;

/** The Razorpay API client, created on first use (so a server without keys still starts). */
export function razorpay() {
  if (!client) {
    client = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
  }
  return client;
}

/** One startup line saying whether checkout works, and how to fix it when it doesn't. */
export function logPaymentMode() {
  const mode = paymentMode();
  if (mode === "test") console.log("Payments: Razorpay TEST mode — dummy payments, no real money");
  else if (mode === "live") console.log("Payments: Razorpay LIVE mode — real payments");
  else {
    console.warn(
      "Payments: OFF — set RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET in backend/.env " +
        "(test keys: Razorpay Dashboard → Test Mode → Account & Settings → API Keys) and restart.",
    );
  }
}
