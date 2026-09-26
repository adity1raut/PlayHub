import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "./db/connect.js";
import router from "./routes.js";
import cookieParser from "cookie-parser";
import env from "dotenv";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import setupSocketHandlers from "./socket/socket.handlers.js";
import { verifyMailer } from "./config/nodemailer.js";
import { initSfu } from "./sfu/index.js";
import { announceStreamLive } from "./modules/stream/stream.controller.js";

env.config();

const app = express();

// CLIENT_URL may list several origins separated by commas,
// e.g. "http://localhost:5173,https://playhub.example.com"
const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim().replace(/\/+$/, ""))
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    // Same-origin requests, curl and server-to-server calls send no Origin header
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    const err = new Error(`Origin ${origin} is not allowed by CORS`);
    err.status = 403;
    return callback(err);
  },
  credentials: true,
};

// Needed for secure cookies when running behind a hosting proxy / load balancer
app.set("trust proxy", 1);

app.use(cors(corsOptions));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
const BACKEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
app.use("/uploads", express.static(path.join(BACKEND_ROOT, "uploads")));

app.get("/api/health", (req, res) => {
  res.json({ success: true, status: "ok", uptime: process.uptime() });
});

app.use(router);

// JSON 404 for unknown API routes
app.use("/api", (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.originalUrl} not found` });
});

// Central error handler (CORS rejections, multer limits, etc.)
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err.status || (err.name === "MulterError" ? 400 : 500);
  if (status >= 500) console.error(err);
  res.status(status).json({ success: false, message: err.message || "Internal server error" });
});

const server = createServer(app);
const io = new Server(server, {
  cors: corsOptions,
  transports: ["websocket", "polling"],
});

setupSocketHandlers(io);

// Live video SFU. If it can't start (e.g. port in use) the rest of the app keeps working.
initSfu(io, { onBroadcastStart: announceStreamLive }).catch((error) =>
  console.error(`SFU failed to start — live video disabled: ${error.message}`),
);

const PORT = process.env.PORT || 4000;

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`CORS origins allowed: ${allowedOrigins.join(", ")}`);
    verifyMailer();
  });
});
