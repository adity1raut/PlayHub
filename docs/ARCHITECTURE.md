# Spawnpoint architecture

Developer notes on how the pieces connect. For setup and features, see the [README](../README.md).

## Client ↔ server

- **Auth**: `POST /api/auth/login` sets an httpOnly `token` cookie; the client never reads the token. `axios.defaults.withCredentials = true` is set once in `client/src/lib/config.js`, so every request sends the cookie.
- **API base URL**: `API_URL` in `client/src/lib/config.js` comes from `VITE_BACKEND_URL`. Leave it empty to make requests relative through the Vite dev proxy (`VITE_PROXY_TARGET`, default `http://localhost:4000`).
- **Realtime**: one Socket.IO connection per signed-in session, from `SocketProvider` (`client/src/context/SocketContext.jsx`). The server authenticates it with the same cookie during the handshake. Chat, stream chat, live video signaling and notifications all share it.
- **CORS**: `CLIENT_URL` on the backend lists the allowed origins, comma-separated.
- **Cross-domain hosting** (e.g. client on Vercel, API on Render): set `VITE_BACKEND_URL=https://api.example.com` on the client, and `CLIENT_URL=https://app.example.com` + `COOKIE_SAMESITE=none` on the backend. Both sides must use HTTPS.

## Live streaming (SFU)

Streams use a **mediasoup SFU** running inside the backend (`backend/src/sfu/`); the browser side is `client/src/lib/sfu.js`.

- The host's stream page (`/stream/:id`) is a studio: camera, mic, screen share (with tab audio), device switching, End stream.
- The browser sends each track **once** to the SFU, which forwards it to every viewer. The camera goes out as 3 simulcast layers, and the SFU picks one per viewer.
- Signaling (`sfu:join`, `sfu:create-transport`, `sfu:produce`, `sfu:consume`, …) runs over the authenticated socket. Only the stream's host can publish.
- Followers get the "live now" notification when the host's first track starts (`announceStreamLive`), not when the stream record is created.

Media does **not** use the HTTP port. Browsers send it to `SFU_PORT` (default `44444`, UDP + TCP) at `SFU_ANNOUNCED_IP`: auto-detected LAN IP locally, the public IP in production. Broadcasting needs `https://` or `http://localhost` (camera access); watching works over plain HTTP.

## Realtime events

Controllers call `broadcast()` / `toUser()` from `backend/src/socket/realtime.js` after saving. Pages subscribe with `useSocketEvent()` from `client/src/lib/useSocketEvent.js`.

| Event | When | Who gets it |
| --- | --- | --- |
| `new-notification`, `notification-count` | any notification below | the recipient (plus web push to their devices) |
| `follow:updated` | follow / unfollow (users or stores) | everyone |
| `store:followers` | store follow / unfollow | everyone |
| `post:created` / `post:likes` / `post:comment` / `post:deleted` | feed activity | everyone |
| `stream:started` / `stream:ended` / `stream:viewers` | live streams | everyone |
| `order:created` | a paid order | the seller only |

## Notifications

`backend/src/modules/notifications/notification.service.js` is the single place notifications are created. Each one is saved, emitted to the recipient's `user_<id>` socket room, and sent as a Web Push to their subscribed devices (`push.service.js`, service worker `client/public/sw.js`).

- Created for: new follower, new store follower, like, comment, message, a followed user going live, a new order (seller), an order confirmation (buyer), a product review.
- Never sent for your own actions. Repeats within 24 hours are suppressed (follow → unfollow → follow, like → unlike → like).
- VAPID keys come from `VAPID_*` env vars, or are generated once into `backend/data/vapid.json` (gitignored).

## Email codes (OTP)

`backend/src/modules/auth/otp.service.js` issues 6-digit codes for sign-up and password reset. Codes are stored hashed in MongoDB (they survive restarts; a TTL index removes them), are valid for 10 minutes (30 minutes once verified), and allow 5 attempts. Only the newest code works.

## Routes

| Client route | Page |
| --- | --- |
| `/` | Landing (guests) → `/dashboard` (signed in) |
| `/login`, `/signup`, `/forgot-password` | Auth |
| `/dashboard` | Overview |
| `/post`, `/post/:id`, `/myposts` | Feed, single post, own posts |
| `/chat`, `/chat/:conversationId` | Direct messages |
| `/streams`, `/stream/:id` | Live streams |
| `/search` | People and post search |
| `/notification` | Notifications |
| `/profile/me`, `/profile/:username` | Profiles |
| `/stores`, `/my-store`, `/products`, `/products/search`, `/products/:id` | Marketplace |
| `/cart`, `/checkout`, `/wishlist` | Buying |

API routers are mounted in `backend/src/routes.js`: `/api/auth`, `/api/chat`, `/api/posts`, `/api/notifications`, `/api/stores`, `/api/stream` (+ `/api/health`).
