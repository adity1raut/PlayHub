// Shared end-to-end harness: a real server process + MongoDB + Socket.IO clients that record
// every event they receive.
//
// Each test file gets its OWN database: TEST_MONGODB_URI's database name plus a suffix
// (spawnpoint_test → spawnpoint_test_sync), so files that `node --test` runs concurrently never
// share or wipe each other's data. The configured name must contain "test" (the database is
// wiped), and everything is skipped when TEST_MONGODB_URI is unset.
//
//   const h = createHarness("sync");
//   before(() => h.start({ users: ["alice", "bob"], seed: async ({ models, users }) => … }));
//   after(() => h.stop());
//   test("…", { skip: h.skip }, async () => { await h.api("alice", "POST", "/api/…", body); … });
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const BACKEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const PASSWORD = "secret123";
export const RZP_SECRET = "ci_test_secret";
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** A Razorpay-style payment signature the server accepts with RZP_SECRET. */
export const paymentSignature = (orderId, paymentId) =>
  crypto.createHmac("sha256", RZP_SECRET).update(`${orderId}|${paymentId}`).digest("hex");

/** A TCP port the OS says is free right now. */
const freePort = () =>
  new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });

/** TEST_MONGODB_URI with `_<suffix>` appended to its database name (query string kept). */
function databaseFor(suffix) {
  const base = process.env.TEST_MONGODB_URI;
  if (!base) return { skip: "set TEST_MONGODB_URI to run" };
  const url = new URL(base);
  const baseName = url.pathname.slice(1);
  if (!/test/i.test(baseName)) return { skip: `refusing to wipe "${baseName}": database name must contain "test"` };
  const name = `${baseName}_${suffix}`;
  url.pathname = `/${name}`;
  return { skip: false, uri: url.toString(), name };
}

export function createHarness(suffix) {
  if (!/^[\w-]+$/.test(suffix)) throw new Error(`invalid database suffix "${suffix}"`);
  const { skip, uri } = databaseFor(suffix);

  const cookie = {};
  const sockets = {};
  const events = {};
  const users = {};
  const models = {};
  let server, mongoose, io, apiUrl;

  const h = {
    skip,
    dbUri: uri,
    models,
    users,
    cookie,
    sockets,
    events,
    get url() {
      return apiUrl;
    },

    /** Events `label` (a user, or a second socket's label) received, optionally filtered. */
    seen: (label, event, pred = () => true) =>
      (events[label] || []).filter((e) => e.event === event && pred(e.payload)),

    /** Forget every recorded event. */
    clear: () => Object.values(events).forEach((list) => (list.length = 0)),

    /** Resolve with the first matching event's payload (polls; fails after `timeout` ms). */
    async waitFor(label, event, pred = () => true, timeout = 3000) {
      const until = Date.now() + timeout;
      for (;;) {
        const hit = h.seen(label, event, pred)[0];
        if (hit) return hit.payload;
        if (Date.now() > until) throw new Error(`${label} never got "${event}" (within ${timeout}ms)`);
        await sleep(25);
      }
    },

    /** JSON request as `who` (their session cookie). Resolves with the parsed body. */
    async api(who, method, route, body) {
      const res = await fetch(`${apiUrl}${route}`, {
        method,
        headers: { cookie: cookie[who], ...(body ? { "Content-Type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      return res.json().catch(() => ({}));
    },

    /** Sign `who` in over HTTP; returns (and remembers) the session cookie. */
    async login(who, password = PASSWORD) {
      const res = await fetch(`${apiUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: who, password }),
      });
      if (!res.ok) throw new Error(`login failed for ${who}: ${res.status}`);
      cookie[who] = res.headers.get("set-cookie").split(";")[0];
      return cookie[who];
    },

    /**
     * Open a Socket.IO connection as `who` that records everything it receives under `label`
     * (default: the username). Use a different label for a second tab of the same user.
     */
    async connect(who, label = who) {
      const socket = io(apiUrl, { transports: ["websocket"], extraHeaders: { cookie: cookie[who] } });
      events[label] = [];
      socket.onAny((event, payload) => events[label].push({ event, payload }));
      await new Promise((resolve, reject) => {
        socket.once("connect", resolve);
        socket.once("connect_error", reject);
      });
      sockets[label] = socket;
      return socket;
    },

    /**
     * Wipe this file's database, create `users` (password PASSWORD), run `seed`, start the
     * server on free ports, then sign every user in and connect one socket each.
     */
    async start({ users: names = ["alice", "bob"], seed } = {}) {
      if (skip) return;
      mongoose = (await import("mongoose")).default;
      const bcrypt = (await import("bcryptjs")).default;
      ({ io } = await import("socket.io-client"));
      Object.assign(models, {
        User: (await import("../src/modules/auth/user.model.js")).default,
        Store: (await import("../src/modules/store/store.model.js")).default,
        Product: (await import("../src/modules/store/product.model.js")).default,
        Cart: (await import("../src/modules/store/cart.model.js")).default,
        Notification: (await import("../src/modules/notifications/notification.model.js")).default,
      });

      await mongoose.connect(uri);
      await mongoose.connection.dropDatabase();
      const password = await bcrypt.hash(PASSWORD, 10);
      for (const name of names) {
        users[name] = await models.User.create({
          username: name,
          email: `${name}@test.dev`,
          password,
          profile: { name: name[0].toUpperCase() + name.slice(1) },
        });
      }
      await seed?.({ models, users });

      const [port, sfuPort] = [await freePort(), await freePort()];
      apiUrl = `http://127.0.0.1:${port}`;
      server = spawn(process.execPath, ["src/server.js"], {
        cwd: BACKEND,
        stdio: ["ignore", "inherit", "inherit"],
        env: {
          ...process.env,
          MONGODB_URI: uri,
          PORT: String(port),
          SFU_PORT: String(sfuPort),
          NODE_ENV: "test",
          JWT_SECRET: process.env.JWT_SECRET || "ci_jwt_secret",
          COOKIE_SECURE: "false",
          RAZORPAY_KEY_ID: "rzp_test_ci",
          RAZORPAY_KEY_SECRET: RZP_SECRET,
          CLIENT_URL: "http://localhost:5173",
          MEDIA_STORAGE: "local", // uploads → backend/uploads, never Cloudinary
        },
      });
      let up = false;
      for (let i = 0; i < 80 && !up; i++) {
        try {
          up = (await fetch(`${apiUrl}/api/health`)).ok;
        } catch {
          /* not up yet */
        }
        if (!up) await sleep(250);
      }
      if (!up) throw new Error("server did not start");

      for (const name of names) {
        await h.login(name);
        await h.connect(name);
      }
      await sleep(300); // let the server finish its per-connection setup
    },

    async stop() {
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
    },
  };
  return h;
}
