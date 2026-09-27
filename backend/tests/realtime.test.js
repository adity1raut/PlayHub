// End-to-end: real server + MongoDB + Socket.IO clients.
// Checks notifications and live events for follows, posts, stores, orders and streams.
//
// Needs TEST_MONGODB_URI pointing at a THROWAWAY database whose name contains "test"
// (the database is wiped). Skipped when unset, so `npm test` never touches real data.
//   TEST_MONGODB_URI=mongodb://127.0.0.1:27017/spawnpoint_test npm test
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DB = process.env.TEST_MONGODB_URI;
const dbName = DB ? new URL(DB).pathname.slice(1) : "";
const skip = !DB
  ? "set TEST_MONGODB_URI to run"
  : !/test/i.test(dbName)
    ? `refusing to wipe "${dbName}": database name must contain "test"`
    : false;

const BACKEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 4700 + Math.floor(Math.random() * 200);
const API = `http://127.0.0.1:${PORT}`;
const RZP_SECRET = "ci_test_secret";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let server, mongoose, io, models, alice, bob, store, product;
const cookie = {};
const sockets = {};
const events = { alice: [], bob: [] };

const seen = (who, event, pred = () => true) =>
  events[who].filter((e) => e.event === event && pred(e.payload));
const clear = () => {
  events.alice.length = 0;
  events.bob.length = 0;
};
const api = async (who, method, route, body) => {
  const res = await fetch(`${API}${route}`, {
    method,
    headers: { cookie: cookie[who], ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json().catch(() => ({}));
};
const notifications = (user, type) => models.Notification.countDocuments({ user: user._id, type });

before(async () => {
  if (skip) return;
  mongoose = (await import("mongoose")).default;
  const bcrypt = (await import("bcryptjs")).default;
  ({ io } = await import("socket.io-client"));
  models = {
    User: (await import("../src/modules/auth/user.model.js")).default,
    Store: (await import("../src/modules/store/store.model.js")).default,
    Product: (await import("../src/modules/store/product.model.js")).default,
    Notification: (await import("../src/modules/notifications/notification.model.js")).default,
  };

  await mongoose.connect(DB);
  await mongoose.connection.dropDatabase();
  const password = await bcrypt.hash("secret123", 10);
  alice = await models.User.create({ username: "alice", email: "alice@test.dev", password, profile: { name: "Alice" } });
  bob = await models.User.create({ username: "bob", email: "bob@test.dev", password, profile: { name: "Bob" } });
  store = await models.Store.create({ owner: alice._id, name: "Pixel Forge" });
  product = await models.Product.create({ store: store._id, name: "Pro Mouse", price: 999, stock: 10 });

  server = spawn(process.execPath, ["src/server.js"], {
    cwd: BACKEND,
    stdio: ["ignore", "inherit", "inherit"],
    env: {
      ...process.env,
      MONGODB_URI: DB,
      PORT: String(PORT),
      SFU_PORT: String(PORT + 10000),
      NODE_ENV: "test",
      JWT_SECRET: process.env.JWT_SECRET || "ci_jwt_secret",
      COOKIE_SECURE: "false",
      RAZORPAY_KEY_ID: "rzp_test_ci",
      RAZORPAY_KEY_SECRET: RZP_SECRET,
      CLIENT_URL: "http://localhost:5173",
    },
  });
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(`${API}/api/health`)).ok) break;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }

  for (const who of ["alice", "bob"]) {
    const res = await fetch(`${API}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: who, password: "secret123" }),
    });
    cookie[who] = res.headers.get("set-cookie").split(";")[0];
    const socket = io(API, { transports: ["websocket"], extraHeaders: { cookie: cookie[who] } });
    socket.onAny((event, payload) => events[who].push({ event, payload }));
    await new Promise((resolve, reject) => {
      socket.on("connect", resolve);
      socket.on("connect_error", reject);
    });
    sockets[who] = socket;
  }
  await sleep(300);
});

after(async () => {
  if (skip) return;
  Object.values(sockets).forEach((s) => s.close());
  if (server && server.exitCode === null) {
    const exited = new Promise((r) => server.once("exit", r));
    server.kill("SIGTERM");
    await Promise.race([exited, sleep(3000)]);
    if (server.exitCode === null) server.kill("SIGKILL");
  }
  await mongoose?.connection.dropDatabase().catch(() => {});
  await mongoose?.disconnect().catch(() => {});
});

test("follow: live counts + one notification (re-follow deduped)", { skip }, async () => {
  clear();
  await api("bob", "POST", "/api/auth/profile/alice/follow");
  await sleep(400);
  const update = seen("alice", "follow:updated")[0]?.payload;
  assert.equal(update?.followed, true);
  assert.equal(update?.followersCount, 1);
  assert.equal(seen("bob", "follow:updated").length, 1);
  assert.equal(seen("alice", "new-notification", (p) => p.type === "FOLLOW").length, 1);
  assert.ok(seen("alice", "notification-count").length >= 1);

  await api("bob", "POST", "/api/auth/profile/alice/follow"); // unfollow
  await api("bob", "POST", "/api/auth/profile/alice/follow"); // follow again
  await sleep(400);
  assert.equal(await notifications(alice, "FOLLOW"), 1);
});

let postId;
test("posts: created / likes / comments / deleted broadcast live", { skip }, async () => {
  clear();
  const form = new FormData();
  form.append("content", "GG everyone");
  const created = await (
    await fetch(`${API}/api/posts/create`, { method: "POST", headers: { cookie: cookie.alice }, body: form })
  ).json();
  postId = created.post?._id;
  await sleep(300);
  assert.equal(seen("bob", "post:created", (p) => p.post?._id === postId && p.post?.author?.username === "alice").length, 1);

  clear();
  await api("bob", "POST", `/api/posts/${postId}/like`);
  await sleep(300);
  assert.equal(seen("alice", "post:likes", (p) => p.postId === postId && p.likesCount === 1 && p.liked).length, 1);
  assert.equal(seen("alice", "new-notification", (p) => p.type === "LIKE").length, 1);

  await api("bob", "POST", `/api/posts/${postId}/like`); // unlike
  await api("bob", "POST", `/api/posts/${postId}/like`); // like again
  await api("alice", "POST", `/api/posts/${postId}/like`); // own like
  await sleep(400);
  assert.equal(await notifications(alice, "LIKE"), 1, "re-like deduped, own like never notifies");
  assert.equal(seen("bob", "post:likes").at(-1)?.payload.likesCount, 2);

  clear();
  await api("bob", "POST", `/api/posts/${postId}/comment`, { text: "nice" });
  await sleep(300);
  assert.equal(seen("alice", "post:comment", (p) => p.postId === postId && p.comment?.user?.username === "bob").length, 1);
  assert.equal(seen("alice", "new-notification", (p) => p.type === "COMMENT").length, 1);
});

test("stores: follow toggles, broadcasts and notifies the owner", { skip }, async () => {
  clear();
  // bob already follows alice, and following a store = following its owner
  const off = await api("bob", "POST", `/api/stores/${store._id}/follow`);
  const on = await api("bob", "POST", `/api/stores/${store._id}/follow`);
  await sleep(400);
  assert.equal(off.following, false);
  assert.equal(on.following, true);
  assert.equal(on.followersCount, 1);
  assert.equal(seen("bob", "store:followers", (p) => p.storeId === String(store._id) && p.following).length, 1);
  assert.equal(seen("alice", "new-notification", (p) => p.type === "STORE_FOLLOW").length, 1);

  const own = await api("alice", "POST", `/api/stores/${store._id}/follow`);
  assert.match(own.error || "", /own store/i);

  const list = await (await fetch(`${API}/api/stores`, { headers: { cookie: cookie.bob } })).json();
  assert.equal(list.stores?.[0]?.owner?.followers?.length, 1, "store list includes a starting follower count");
});

test("reviews notify the store owner", { skip }, async () => {
  clear();
  await api("bob", "POST", `/api/stores/products/${product._id}/rating`, { rating: 5, review: "great" });
  await sleep(400);
  assert.equal(seen("alice", "new-notification", (p) => p.type === "REVIEW").length, 1);
});

test("paid orders notify the seller (live) and confirm to the buyer", { skip }, async () => {
  clear();
  await api("bob", "POST", `/api/stores/${store._id}/cart/add`, { productId: String(product._id), quantity: 2 });
  await api("bob", "POST", "/api/stores/order/addresses", {
    name: "Bob",
    phone: "9999999999",
    street: "1 Main St",
    city: "Pune",
    state: "MH",
    zipCode: "411001",
  });
  const buyer = await models.User.findById(bob._id).lean();
  const addressId = String(buyer.addresses.at(-1)._id);
  const [orderId, paymentId] = ["order_ci_1", "pay_ci_1"];
  const signature = crypto.createHmac("sha256", RZP_SECRET).update(`${orderId}|${paymentId}`).digest("hex");

  const res = await api("bob", "POST", "/api/stores/order/verify", {
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: signature,
    addressId,
  });
  await sleep(600);
  assert.equal(res.success, true, res.message);
  assert.equal(seen("alice", "new-notification", (p) => p.type === "NEW_ORDER").length, 1);
  assert.equal(seen("alice", "order:created", (p) => p.itemCount === 2).length, 1);
  assert.equal(seen("bob", "order:created").length, 0, "only the seller gets order:created");
  assert.equal(seen("bob", "new-notification", (p) => p.type === "ORDER_UPDATE").length, 1);
});

test("streams: started / ended broadcast, stream key never leaks", { skip }, async () => {
  clear();
  const stream = await api("alice", "POST", "/api/stream/create", { title: "Ranked night" });
  await sleep(300);
  const started = seen("bob", "stream:started")[0]?.payload?.stream;
  assert.equal(started?._id, stream._id);
  assert.equal(started?.host?.username, "alice");
  assert.ok(!("streamKey" in started));

  await api("alice", "PUT", `/api/stream/${stream._id}/end`);
  await sleep(300);
  assert.equal(seen("bob", "stream:ended", (p) => p.streamId === stream._id).length, 1);
});

test("post deletion broadcasts with the author id", { skip }, async () => {
  clear();
  await api("alice", "DELETE", `/api/posts/${postId}`);
  await sleep(300);
  assert.equal(seen("bob", "post:deleted", (p) => p.postId === postId && p.authorId === String(alice._id)).length, 1);
});
