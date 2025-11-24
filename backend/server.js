import express from "express";
import bodyParser from "body-parser";
import ConnectDB from "./db/ConnectDB.js";
import router from "./mainRouter/router.js";
import cookieParser from "cookie-parser";
import env from "dotenv";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import setupSocketHandlers from "./socket/socketHandlers.js";

env.config();

const app = express();

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  }),
);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use("/uploads", express.static("uploads"));

ConnectDB();

app.use(router);

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

setupSocketHandlers(io);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`CORS Origin Allowed: ${CLIENT_URL}`);
});
