/* Spawnpoint service worker: Web Push only (no fetch handler, no caching).
 *
 * Registered by src/lib/push.js as /sw.js?api=<encoded API_URL>. The API origin may differ
 * from the page origin, so the API base is read from this script's own query string.
 */

const API_BASE = (() => {
  try {
    const api = new URL(self.location.href).searchParams.get("api");
    if (api) return api.replace(/\/+$/, "");
  } catch {
    /* fall through */
  }
  return self.location.origin;
})();

const DEFAULT_URL = "/notification";
const DEFAULT_ICON = "/icons/icon-192.png";
const DEFAULT_BADGE = "/icons/badge-96.png";
const STICKY_TYPES = ["MESSAGE", "STREAM_START"];
const VIBRATE = [300, 100, 300, 100, 600];

// Safari/WebKit revokes a push subscription whose pushes don't show a notification,
// so there we always show one even when the app is on screen.
const IS_APPLE_WEBKIT = (() => {
  const ua = (self.navigator && self.navigator.userAgent) || "";
  return /AppleWebKit/i.test(ua) && !/Chrome|Chromium|Edg\/|OPR|Android/i.test(ua);
})();

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function readPayload(event) {
  if (!event.data) return {};
  try {
    return event.data.json() || {};
  } catch {
    try {
      return { body: event.data.text() };
    } catch {
      return {};
    }
  }
}

function normalize(data) {
  return {
    title: data.title || "Spawnpoint",
    body: data.body || "",
    url: data.url || DEFAULT_URL,
    tag: data.tag || "spawnpoint",
    type: data.type || "GENERAL",
    id: data.id || null,
    icon: data.icon || DEFAULT_ICON,
    badge: data.badge || DEFAULT_BADGE,
    test: Boolean(data.test),
    timestamp: Date.now(),
  };
}

async function windowClients() {
  const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  // Only windows of this app (same origin, inside the SW scope)
  return all.filter((c) => c.url && c.url.indexOf(self.registration.scope) === 0);
}

async function handlePush(payload) {
  const windows = await windowClients();
  const visible = windows.filter((c) => c.visibilityState === "visible");

  // App is on screen: it plays its own in-app alert with sound instead.
  // Test pushes always go to the system tray so the user can see the real thing.
  if (visible.length && !payload.test && !IS_APPLE_WEBKIT) {
    visible.forEach((c) => c.postMessage({ type: "spawnpoint:push", payload }));
    return;
  }

  await self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: payload.icon,
    badge: payload.badge,
    tag: payload.tag,
    renotify: true,
    requireInteraction: STICKY_TYPES.indexOf(payload.type) !== -1,
    vibrate: VIBRATE,
    data: { url: payload.url, id: payload.id, type: payload.type },
    timestamp: payload.timestamp,
  });
}

self.addEventListener("push", (event) => {
  const payload = normalize(readPayload(event));
  event.waitUntil(
    handlePush(payload).catch(() =>
      // Never end a push without showing something (browsers penalise silent pushes)
      self.registration.showNotification(payload.title, { body: payload.body, icon: payload.icon, tag: payload.tag }),
    ),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const target = new URL(data.url || DEFAULT_URL, self.location.origin);

  event.waitUntil(
    (async () => {
      const windows = await windowClients();
      const client =
        windows.find((c) => c.focused) || windows.find((c) => c.visibilityState === "visible") || windows[0];

      if (client && target.origin === self.location.origin) {
        try {
          await client.focus();
        } catch {
          /* focus may be refused; still navigate */
        }
        // In-app (SPA) navigation keeps the socket and state alive; see src/lib/push.js
        client.postMessage({ type: "spawnpoint:navigate", url: target.pathname + target.search + target.hash });
        return;
      }
      await self.clients.openWindow(target.href);
    })(),
  );
});

function urlBase64ToUint8Array(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const res = await fetch(`${API_BASE}/api/notifications/push/public-key`, { credentials: "include" });
      const { publicKey } = await res.json();
      if (!publicKey) return;

      const subscription = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      await fetch(`${API_BASE}/api/notifications/push/subscribe`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });

      const old = event.oldSubscription;
      if (old && old.endpoint && old.endpoint !== subscription.endpoint) {
        await fetch(`${API_BASE}/api/notifications/push/unsubscribe`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: old.endpoint }),
        }).catch(() => {});
      }
    })().catch((err) => console.warn("[sw] pushsubscriptionchange failed:", err)),
  );
});
