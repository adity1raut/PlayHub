# PlayHub

[![CI](https://github.com/adity1raut/PlayHub/actions/workflows/ci.yml/badge.svg)](https://github.com/adity1raut/PlayHub/actions/workflows/ci.yml)

PlayHub is a social platform for gamers. Chat with friends, go live on camera, share posts and clips, and run your own store, all in one app that updates in real time.

## Features

### Accounts & profiles
- Sign up with email verification (6-digit code), sign in with email or username
- Password reset by emailed code
- Profiles with avatar, cover image, bio, posts, followers and following
- Follow and unfollow players; counts update live

### Feed
- Share posts with images or video
- Like and comment; counts update live for everyone
- "N new posts" button when others post while you're reading
- Shareable links to single posts, plus a "My posts" page

### Chat
- One-to-one realtime messaging
- Typing indicators and read receipts
- Find people by username or name and start a chat from their profile

### Live streaming
- Go live from the browser with **camera, microphone and screen share**
- Switch camera or mic mid-stream, mute, turn the camera off, end the stream
- Viewers watch in real time with live chat and a live viewer count
- Followers get a "Live now" alert the moment you start
- Built on an SFU (mediasoup): you upload once, and the server relays to every viewer in the quality their connection can handle

### Notifications
- Alerts for new followers, likes, comments, messages, live streams, new orders, order confirmations and product reviews
- In-app pop-ups with sound, plus a notifications page with read/unread filters
- **Phone and desktop push notifications**, even when PlayHub is closed (installable app; on iPhone, use "Add to Home Screen")
- No alerts for your own actions, and no repeat spam from follow/unfollow or like/unlike

### Marketplace
- Open a store with a logo, and add products with up to 5 images
- Browse, search and filter products; trending products
- Wishlist, cart, saved delivery addresses
- Checkout with **Razorpay**
- Ratings and reviews
- Store analytics, and instant alerts to sellers when an order comes in
- Follow stores

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
  TEST_MONGODB_URI=mongodb://127.0.0.1:27017/playhub_test npm test
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
