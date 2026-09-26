// OTP rules (sign-up / password reset) with in-memory fakes: no database, no email.
import { test, before } from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";

const { default: Otp } = await import("../src/modules/auth/otp.model.js");
const { default: mailer } = await import("../src/config/nodemailer.js");
const { issueOtp, verifyOtp, consumeVerifiedOtp } = await import("../src/modules/auth/otp.service.js");

const store = new Map();
let lastCode = null;
const key = (q) => `${q.email}|${q.purpose}`;
const withSave = (doc) => doc && Object.assign(doc, { save: async () => store.set(key(doc), doc) });

before(() => {
  Otp.findOneAndUpdate = async (q, update) => {
    const doc = { ...(store.get(key(q)) || { ...q, _id: key(q) }), ...update };
    store.set(key(q), doc);
    return doc;
  };
  Otp.findOne = async (q) => withSave(store.get(key(q)) ? { ...store.get(key(q)) } : null);
  Otp.deleteOne = async ({ _id }) => store.delete(_id);
  mailer.sendMail = async ({ text }) => {
    lastCode = text.match(/\d{6}/)[0];
  };
});

const rejects = (promise, pattern) => assert.rejects(promise, (err) => pattern.test(err.message));

test("issues a 6-digit code, normalising the email", async () => {
  await issueOtp("  Player@Gmail.COM ", "register");
  assert.match(lastCode, /^\d{6}$/);
  assert.ok(store.has("player@gmail.com|register"));
});

test("wrong code is rejected and counts down attempts", async () => {
  await issueOtp("a@test.dev", "register");
  await rejects(verifyOtp("a@test.dev", "register", "000000"), /4 tries left/);
});

test("right code works with spaces and any email case", async () => {
  await issueOtp("b@test.dev", "register");
  const spaced = `${lastCode.slice(0, 3)} ${lastCode.slice(3)}`;
  const res = await verifyOtp("B@TEST.dev", "register", spaced);
  assert.equal(res.success, true);
});

test("a verified code is consumed exactly once", async () => {
  await issueOtp("c@test.dev", "register");
  await verifyOtp("c@test.dev", "register", lastCode);
  await consumeVerifiedOtp("c@test.dev", "register");
  await rejects(consumeVerifiedOtp("c@test.dev", "register"), /verify the code/);
});

test("registering without verifying is blocked", async () => {
  await issueOtp("d@test.dev", "register");
  await rejects(consumeVerifiedOtp("d@test.dev", "register"), /verify the code/);
});

test("resend invalidates the previous code", async () => {
  await issueOtp("e@test.dev", "reset");
  const first = lastCode;
  await issueOtp("e@test.dev", "reset");
  if (first !== lastCode) await rejects(verifyOtp("e@test.dev", "reset", first), /Incorrect code/);
  assert.equal((await verifyOtp("e@test.dev", "reset", lastCode)).success, true);
});

test("locks after 5 wrong attempts, even for the right code", async () => {
  await issueOtp("f@test.dev", "reset");
  const good = lastCode;
  for (let i = 0; i < 5; i++) await verifyOtp("f@test.dev", "reset", "111111").catch(() => {});
  await rejects(verifyOtp("f@test.dev", "reset", good), /Too many wrong attempts/);
});

test("expired codes are rejected", async () => {
  await issueOtp("g@test.dev", "reset");
  store.get("g@test.dev|reset").expiresAt = new Date(Date.now() - 1000);
  await rejects(verifyOtp("g@test.dev", "reset", lastCode), /expired/);
});

test("a sign-up code can't be used for a password reset", async () => {
  await issueOtp("h@test.dev", "register");
  await rejects(verifyOtp("h@test.dev", "reset", lastCode), /expired or was never sent/);
});
