# Spawnpoint

[![CI](https://github.com/adity1raut/Spawnpoint/actions/workflows/ci.yml/badge.svg)](https://github.com/adity1raut/Spawnpoint/actions/workflows/ci.yml)

Spawnpoint is a full-stack social and e-commerce platform for gamers: real-time posts and chat, live streaming with camera, mic and screen share, instant notifications, and online stores with Razorpay checkout — all in a dark, gaming-inspired UI.

## Features

### Accounts & profiles
- Sign up with email verification (6-digit code), sign in with email or username
- Password reset by emailed code
- Profiles with avatar, cover image, bio, posts, friends, followers and following
- Follow and unfollow players; counts update live
- **Friends**: players who follow each other. Friends lists are public on every profile, and following someone back tells them you're now friends

### Feed
- Share posts with images or video
- Like and comment; counts update live for everyone
- "N new posts" button when others post while you're reading
- Shareable links to single posts, plus a "My posts" page

### Chat
- One-to-one realtime messaging between **friends**. Players who aren't friends can chat only if both allow messages from everyone in Settings
- Send **photos, videos, audio clips and files** (PDF, docs, zip; up to 25 MB) with an optional caption. Attach, paste or drag and drop
- If two players stop being friends, their thread stays readable but locked, with a one-click "Follow back"
- Typing indicators and read receipts
- Find people by username or name, or pick from your friends list

### Settings
- Edit name, email and bio
- Choose who can message you: friends only (default) or everyone
- Turn each alert type on or off: messages, followers, likes, comments, live streams, store activity
- Device push alerts and sound, theme, and password change

### Live streaming
- Go live from the browser with **camera, microphone and screen share**
- Switch camera or mic mid-stream, mute, turn the camera off, end the stream
- Viewers watch in real time with live chat, a live viewer count and a "Watching now" list
- Followers get a "Live now" alert the moment you start
- Built on an SFU (mediasoup): you upload once, and the server relays to every viewer in the quality their connection can handle
- **Quality picker** (Auto / Medium / Low) that shows the layer you're actually receiving. The camera drops to low automatically while it's the small picture over a screen share
- **Stream stats** for viewers (resolution, fps, bitrate, packet loss, round trip) and **upload stats** for the host (per quality layer, and what's limiting it), plus a connection-strength badge
- **Recovers from network changes** (Wi-Fi to mobile data) without dropping the stream
- **Speaking indicator** driven by the server's audio levels, so viewers see when the host talks even with the camera off
- **Live reactions** floating over the video, picture-in-picture, and live stats (watching now, peak viewers, messages, reactions)
- **Chat moderation** for the host: delete messages, mute a player for a set time, slow mode
- **Join the stage**: viewers ask to join, the host lets up to 3 in, and guests share their **screen and mic** with everyone. The browser asks each guest's permission first. Whoever's screen is up shows large, anything else becomes a tile you can click, and the speaking indicator names who's talking. The host can remove a guest at any time

### Notifications
- Alerts for new followers, likes, comments, messages, live streams, new orders, order confirmations and product reviews
- In-app pop-ups with sound, plus a notifications page with read/unread filters
- **Phone and desktop push notifications**, even when Spawnpoint is closed (installable app; on iPhone, use "Add to Home Screen")
- **Realtime desktop notifications** whenever Spawnpoint isn't the window in front, including stage requests for the host and "you're on stage" for guests
- Asks once for notification permission after sign-in ("Not now" waits a week). You can change it any time in Settings
- No alerts for your own actions, and no repeat spam from follow/unfollow or like/unlike

### Marketplace
- Open a store with a logo, and add products with up to 5 images
- Browse, search and filter products; trending products
- Wishlist, cart, saved delivery addresses
- Checkout with **Razorpay**
- Ratings and reviews
- Store analytics, and instant alerts to sellers when an order comes in
- Follow stores

### Everything updates live
- Prices, stock, new or removed products, reviews and store changes appear without a refresh for everyone browsing
- Profile edits show up everywhere they're displayed. Your cart, wishlist, settings and notification read state stay in sync across all your open tabs
- After a dropped connection, every page quietly catches up on what it missed

### Search
- Find people and posts from one search page

### Design
- Terminal-inspired look: monospace type, sharp edges, teal on navy
- Dark, light and system themes
- Works on phones (bottom navigation) and desktops (sidebar workspace)

## Tech stack

| Part | Technology |
| --- | --- |
| Frontend | React 18, Vite 6, Tailwind CSS 4, React Router 7, Socket.IO client, mediasoup-client |
| Backend | Node.js 22, Express 4, Socket.IO 4, MongoDB + Mongoose 8, mediasoup (SFU) |
| Services | Cloudinary (media), Gmail / Nodemailer (email codes), Razorpay (payments), Web Push |
| Auth | JWT in an httpOnly cookie |
| CI | GitHub Actions |

## Getting started

### Prerequisites
- **Node.js 22+**
- **MongoDB**: a local install or MongoDB Atlas
- Accounts for **Cloudinary**, **Razorpay** (test keys are fine), and a **Gmail App Password** for sending email codes

### 1. Backend

```bash
cd backend
cp .env.example .env     # then fill in the values (see below)
npm install
npm run dev              # API on http://localhost:4000
```

### 2. Frontend

```bash
cd client
echo 'VITE_BACKEND_URL="http://localhost:4000"' > .env
npm install
npm run dev              # app on http://localhost:5173
```

Open http://localhost:5173, create an account, and you're in.

## Configuration

### Backend (`backend/.env`)

| Variable | Required | Description |
| --- | --- | --- |
| `MONGODB_URI` | yes | MongoDB connection string |
| `JWT_SECRET` | yes | Secret used to sign login tokens |
| `CLIENT_URL` | yes | Frontend URL(s) allowed to connect, comma-separated |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | yes | Image and video uploads |
| `MEDIA_STORAGE` | no | `local` stores chat attachments in `backend/uploads/chat` instead of Cloudinary (used by the tests) |
| `MAIL_SERVICE`, `MAIL_USER`, `MAIL_PASS` | yes | Email for verification codes (`gmail` + a Gmail App Password) |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | yes | Payments |
| `PORT` | no | API port (default `4000`) |
| `NODE_ENV` | no | `development` locally, `production` when deployed |
| `COOKIE_SAMESITE`, `COOKIE_SECURE` | no | Cookie policy; set `COOKIE_SAMESITE=none` when the frontend and API are on different domains |
| `SFU_PORT`, `SFU_ANNOUNCED_IP` | no | Live-video port (default `44444`) and the public IP browsers connect to (auto-detected locally) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | no | Push-notification keys (generated automatically if unset) |

### Frontend (`client/.env`)

| Variable | Description |
| --- | --- |
| `VITE_BACKEND_URL` | Backend URL, e.g. `http://localhost:4000`. Leave empty to use the dev proxy. |

## Scripts

| Where | Command | What it does |
| --- | --- | --- |
| backend | `npm run dev` | Start the API with auto-reload |
| backend | `npm start` | Start the API |
| backend | `npm test` | Run the tests (see below) |
| backend | `npm run check` | Syntax-check every backend file |
| client | `npm run dev` | Start the app with hot reload |
| client | `npm run build` | Production build into `client/dist` |
| client | `npm run lint` | Lint the frontend |
| client | `npm run preview` | Preview the production build |

## Tests & CI

- `backend/tests/otp.test.js` covers the email-code rules (6 digits, expiry, resend, attempt limit). It runs anywhere and needs no database.
- `backend/tests/realtime.test.js` is an end-to-end test covering follows, posts, stores, orders, reviews and live streams: notifications and live socket updates. It runs only when `TEST_MONGODB_URI` points at a **throwaway** database whose name contains `test`:

  ```bash
  TEST_MONGODB_URI=mongodb://127.0.0.1:27017/spawnpoint_test npm test
  ```

**GitHub Actions** (`.github/workflows/ci.yml`) runs on every push and on pull requests to `main`:
- **Client:** install, lint, build
- **Backend:** install, syntax check, and all tests against a MongoDB service container

## Deployment notes

- Serve the app over **HTTPS**. Going live (camera/mic) and push notifications need it.
- Open the live-video port (`SFU_PORT`, default `44444`, UDP and TCP) and set `SFU_ANNOUNCED_IP` to the server's public IP.
- Hosting the frontend and API on different domains? Set `VITE_BACKEND_URL` to the API URL, and `CLIENT_URL` + `COOKIE_SAMESITE=none` on the backend.
- Set fixed `VAPID_*` keys in production so phones stay subscribed across deploys.

## Project structure

```
backend/src/
  server.js, routes.js      app entry + API router
  config/ db/ middleware/ utils/
  socket/                   realtime events
  sfu/                      live-video server
  modules/                  auth · chat · posts · notifications · stream · store
client/src/
  main.jsx, App.jsx         app entry + routes
  components/ui, layout/    shared UI
  context/ lib/ routes/     app state, helpers, route guards
  features/                 landing · auth · dashboard · chat · posts · profile ·
                            notifications · search · stream · store
.github/workflows/ci.yml    CI pipeline
docs/ARCHITECTURE.md        how the pieces connect (for developers)
```

For how auth, sockets, live video and realtime events work under the hood, see **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.
