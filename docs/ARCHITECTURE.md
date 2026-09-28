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
- **Quality**: the viewer's choice sets the highest simulcast layer the SFU may forward to them (`sfu:set-quality` → `consumer.setPreferredLayers`). The SFU reports the layer it actually sends as `sfu:layers`. A screen-share consumer gets a higher priority than the camera, and the player asks for the camera's low layer while it's only picture-in-picture.
- **Resilience**: when a transport's media path fails or stays disconnected for 2.5 s, the client asks for new ICE credentials (`sfu:restart-ice`) and restarts ICE on the same transport. A socket reconnect rebuilds the whole session.
- **Audio level**: each room has an `AudioLevelObserver` on the host's mic. It emits `sfu:audio-level` (0–1, in steps of 0.1, only on change) for the speaking indicator.
- **Viewers**: counted per person, not per tab, and never including the host. `sfu:viewers` carries the count plus the first 50 viewers' public profiles. The SFU reports changes to `recordViewers()`, which keeps `Stream.viewers` (everyone who watched) and `peakViewers`.
- **Stats**: the stats panels read `getStats()` from the SFU transports in the browser (`client/src/lib/rtcStats.js`). The server isn't involved.

**Stage** (`stage:*` in `backend/src/sfu/index.js`): viewers ask to join (`stage:request`), and the host approves or denies (`stage:respond`) or removes a guest (`stage:remove`).
- Up to 3 guests. After a denial, the viewer waits 30 s before asking again.
- Only the host and approved guests may open a send transport or produce. Guests may produce only `mic`, `screen` and `screen-audio`.
- Every producer carries `{ userId, role: host|guest, user }`, and nobody consumes their own tracks, so the host now receives guests too.
- Removing a guest closes their producers for everyone. A guest whose last tab drops keeps the spot for 20 s, and a pending request is withdrawn when the requester leaves.
- The audio-level observer reports the loudest mic's `userId`, which drives the "who's speaking" indicator.
- On the client, `StreamViewer` owns the media sessions (`useStreamBroadcast` / `useStreamWatch`), so the stage (`useStage`) and a guest's own mic and screen (`useGuestMedia`) share them. After a reconnect, a guest's live tracks are published again.

Stream interaction that isn't media lives in `backend/src/modules/stream/stream.socket.js`, over the stream room `stream_<id>`:

- **Chat**: `send-stream-message` (acknowledged; the REST fallback shares the same code). It enforces a 500-character limit, host mutes (`CHAT_MUTED`) and slow mode (`CHAT_SLOW`).
- **Moderation**: `stream-chat:delete` (host, or the author), `stream-chat:mute` (host, 1–60 min, 0 = unmute), `stream:set-slow-mode` (host, 0/5/15/30/60 s).
- **Reactions**: `stream:react` with one of ❤️ 🔥 😂 👏 😮 💯, rate-limited per tab (bursts of 6, then about 3 per second), broadcast as `stream:reaction`.
- **Stats**: `stream:stats` sends { viewers, uniqueViewers, peakViewers, messages, reactions }, at most once a second per stream, to the room and to the host's own tabs (the analytics modal updates live).

Media does **not** use the HTTP port. Browsers send it to `SFU_PORT` (default `44444`, UDP + TCP) at `SFU_ANNOUNCED_IP`: auto-detected LAN IP locally, the public IP in production. Broadcasting needs `https://` or `http://localhost` (camera access); watching works over plain HTTP.

## Realtime events

Controllers call `broadcast()` / `toUser()` / `toRoom()` from `backend/src/socket/realtime.js` after the database write succeeds. Payloads carry only public fields: never emails, addresses, settings or stream keys. Pages subscribe with `useSocketEvent()` from `client/src/lib/useSocketEvent.js`. Its `onReconnect` option refetches after any reconnect, so nothing missed while offline stays stale.

| Event | When | Who gets it |
| --- | --- | --- |
| `new-notification`, `notification-count` | any notification below | the recipient (plus web push to their devices) |
| `notification:read` / `notification:read-all` / `notification:deleted` | read state changed in one tab | that user's other tabs |
| `follow:updated` | follow / unfollow (users or stores); `friends: true` when it made them mutual | everyone |
| `user:updated` | profile edit (name, bio, avatar, cover) | everyone |
| `settings:updated` | settings saved | that user's other tabs |
| `new-message`, `conversation-updated` | a chat message or attachment | the conversation's members |
| `post:created` / `post:likes` / `post:comment` / `post:deleted` | feed activity | everyone |
| `store:created` / `store:updated` / `store:deleted` | store changes (deleting a store also removes its products) | everyone |
| `store:followers` | store follow / unfollow | everyone |
| `product:created` / `product:updated` / `product:deleted` | catalogue changes, and stock dropping after a purchase | everyone |
| `product:rating` | a new or edited review, with the new average | everyone |
| `cart:updated` / `wishlist:updated` | cart or wishlist changed (including the cart emptied after payment) | that user's tabs |
| `order:created` | a paid order | the seller only |
| `stream:started` / `stream:ended` / `stream:viewers` | live streams | everyone |
| `stream:stats`, `stream:reaction`, `new-stream-message`, `stream-chat:*`, `sfu:*` | inside a live stream (see "Live streaming" above) | the stream room (stats also go to the host's tabs) |

The socket reconnects on its own after network drops. If the server refuses the handshake (for example, an expired session), `SocketContext` re-checks the session: it signs out if the session is gone, or retries with a 2–30 s backoff if it's still valid.

## Friends and chat permissions

Friends are mutual followers. There's no separate friend request: following someone back makes you friends. `backend/src/modules/auth/friends.js` computes it, and `chatAccess()` decides who may chat:

- `canMessage = isFriend || (both players set settings.privacy.messages = "everyone")`. The rule is symmetric, so whoever can write can also get a reply.
- Every send goes through `sendChatMessage()` in `backend/src/modules/chat/chat.service.js`: socket `send-message`, `POST /api/chat/messages` and `POST /api/chat/messages/attachment`. A refusal is a 403 with `code: "CHAT_FORBIDDEN"` (on the socket, an `error` event carrying that code).
- `GET /api/chat/conversations` and `POST /api/chat/conversations` tag each thread with `isFriend` / `canMessage`. An existing thread always opens (read-only when locked). Creating a new thread needs permission.
- `join-conversation` only admits members of that conversation.
- Attachments: multer memory upload (allowlisted types, 25 MB), then Cloudinary, or `uploads/chat` when `MEDIA_STORAGE=local`. The stored extension comes from the checked MIME type, and `/uploads` is served with `nosniff`.

## Settings

`User.settings` holds `privacy.messages` (`friends` | `everyone`) and `notifications.{messages,follows,likes,comments,live,store}`. Always read it through `settingsOf()` (`backend/src/modules/auth/settings.js`), which fills defaults for older accounts. `GET/PUT /api/auth/settings` takes partial patches and rejects unknown keys. `PUT /api/auth/password` needs the current password. Settings are never included in public profiles.

## Notifications

**Desktop notifications while the app is open** (`client/src/lib/desktopNotify.js`): a notification arriving over the socket rings the OS when Spawnpoint isn't in front.
- **Tab hidden:** Web Push rings the device if it's on; otherwise the page shows the OS notification itself.
- **Tab visible but the window unfocused:** the page shows the OS notification plus the in-app pop-up.
- **Stage events:** these use the same helper.

`NotificationPermissionPrompt` asks once after sign-in, and only if the browser has never been asked (people who turned alerts off aren't nagged). The browser's own prompt needs a click, so the card provides one.

`backend/src/modules/notifications/notification.service.js` is the single place notifications are created. Each one is saved, emitted to the recipient's `user_<id>` socket room, and sent as a Web Push to their subscribed devices (`push.service.js`, service worker `client/public/sw.js`).

- Created for: new follower, new store follower, like, comment, message, a followed user going live, a new order (seller), an order confirmation (buyer), a product review.
- Never sent for your own actions. Repeats within 24 hours are suppressed (follow → unfollow → follow, like → unlike → like).
- Not created at all when the recipient turned that alert type off in Settings (`NOTIFICATION_GROUPS` maps each type to a switch; order updates to buyers are always sent).
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
| `/settings` | Profile, messaging privacy, alert types, theme, password |
| `/profile/me`, `/profile/:username` | Profiles |
| `/stores`, `/my-store`, `/products`, `/products/search`, `/products/:id` | Marketplace |
| `/cart`, `/checkout`, `/wishlist` | Buying |

API routers are mounted in `backend/src/routes.js`: `/api/auth`, `/api/chat`, `/api/posts`, `/api/notifications`, `/api/stores`, `/api/stream` (+ `/api/health`).
