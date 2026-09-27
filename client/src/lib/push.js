import axios from "axios";
import { API_URL } from "./config";

/*
 * Web Push for this device: service worker registration, permission, subscription
 * and syncing it with the signed-in account (POST /api/notifications/push/*).
 */

const SW_URL = `/sw.js?api=${encodeURIComponent(API_URL)}`;
const PUSH_API = `${API_URL}/api/notifications/push`;
const WANTED_KEY = "spawnpoint:push-wanted"; // the user turned alerts on for this device
const READY_TIMEOUT_MS = 10000;

let registrationPromise = null;
let messageListenerAttached = false;
const messageHandlers = new Set();
let lastKnownStatus = null;

/* ---------- environment ---------- */

export function isIOS() {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

export function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function notificationPermission() {
  return typeof window !== "undefined" && "Notification" in window ? Notification.permission : "default";
}

function setWanted(wanted) {
  try {
    if (wanted) localStorage.setItem(WANTED_KEY, "1");
    else localStorage.removeItem(WANTED_KEY);
  } catch {
    /* ignore */
  }
}

function isWanted() {
  try {
    return localStorage.getItem(WANTED_KEY) === "1";
  } catch {
    return false;
  }
}

/* ---------- service worker ---------- */

function attachMessageListener() {
  if (messageListenerAttached || !("serviceWorker" in navigator)) return;
  messageListenerAttached = true;
  navigator.serviceWorker.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || typeof data !== "object" || typeof data.type !== "string" || !data.type.startsWith("spawnpoint:")) return;
    messageHandlers.forEach((fn) => {
      try {
        fn(data);
      } catch (err) {
        console.error("Service worker message handler failed:", err);
      }
    });
  });
}

/**
 * Subscribe to messages from the service worker:
 *   { type: "spawnpoint:push", payload }  a push arrived while the app is on screen
 *   { type: "spawnpoint:navigate", url }  the user clicked a system notification
 * Returns an unsubscribe function.
 */
export function onServiceWorkerMessage(handler) {
  attachMessageListener();
  messageHandlers.add(handler);
  return () => messageHandlers.delete(handler);
}

/** Register /sw.js once (called from main.jsx). Resolves to the registration or null. */
export function registerServiceWorker() {
  if (registrationPromise) return registrationPromise;
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !window.isSecureContext) {
    registrationPromise = Promise.resolve(null);
    return registrationPromise;
  }
  attachMessageListener();
  registrationPromise = new Promise((resolve) => {
    const register = () =>
      navigator.serviceWorker
        .register(SW_URL, { scope: "/" })
        .then(resolve)
        .catch((err) => {
          console.warn("Service worker registration failed:", err);
          resolve(null);
        });
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  });
  return registrationPromise;
}

async function getReadyRegistration() {
  const reg = await registerServiceWorker();
  if (!reg) throw new Error("Service worker is not available in this browser.");
  if (reg.active) return reg;
  const ready = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise((resolve) => setTimeout(() => resolve(null), READY_TIMEOUT_MS)),
  ]);
  if (!ready) throw new Error("Service worker did not start. Reload the page and try again.");
  return ready;
}

async function getExistingSubscription() {
  if (!isPushSupported()) return null;
  try {
    const reg = (await navigator.serviceWorker.getRegistration("/")) || (await registerServiceWorker());
    return (await reg?.pushManager.getSubscription()) || null;
  } catch {
    return null;
  }
}

/* ---------- keys ---------- */

function urlBase64ToUint8Array(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = window.atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (ch) => ch.charCodeAt(0));
}

function sameKey(buffer, bytes) {
  if (!buffer) return true; // browser doesn't expose it: assume it matches
  const a = new Uint8Array(buffer);
  return a.length === bytes.length && a.every((v, i) => v === bytes[i]);
}

async function fetchPublicKey() {
  const res = await axios.get(`${PUSH_API}/public-key`);
  if (!res.data?.publicKey) throw new Error("Push is not configured on the server.");
  return urlBase64ToUint8Array(res.data.publicKey);
}

/**
 * Returns a subscription made with the server's current VAPID key, replacing one
 * made with an old key (the server may have rotated/regenerated its keys).
 */
async function ensureSubscription(reg) {
  const key = await fetchPublicKey();
  let sub = await reg.pushManager.getSubscription();
  if (sub && !sameKey(sub.options?.applicationServerKey, key)) {
    const oldEndpoint = sub.endpoint;
    await sub.unsubscribe().catch(() => {});
    axios.post(`${PUSH_API}/unsubscribe`, { endpoint: oldEndpoint }).catch(() => {});
    sub = null;
  }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  return sub;
}

async function saveSubscription(sub) {
  await axios.post(`${PUSH_API}/subscribe`, { subscription: sub.toJSON() });
}

/* ---------- public API ---------- */

/**
 * "unsupported" | "ios-needs-install" | "denied" | "enabled" | "disabled"
 */
export async function getPushStatus() {
  let status;
  if (isIOS() && !isStandalone()) status = "ios-needs-install";
  else if (!isPushSupported()) status = "unsupported";
  else if (Notification.permission === "denied") status = "denied";
  else if (Notification.permission === "granted" && (await getExistingSubscription())) status = "enabled";
  else status = "disabled";
  lastKnownStatus = status;
  return status;
}

/** Last status computed by getPushStatus/enablePush/disablePush (sync, may be null). */
export function getCachedPushStatus() {
  return lastKnownStatus;
}

function requestPermission() {
  // Old Safari only supports the callback form
  return new Promise((resolve) => {
    const maybe = Notification.requestPermission(resolve);
    if (maybe && typeof maybe.then === "function") maybe.then(resolve, () => resolve(Notification.permission));
  });
}

/** Ask permission (must run from a click), subscribe, and register the device. */
export async function enablePush() {
  if (isIOS() && !isStandalone()) {
    throw new Error("On iPhone/iPad, tap Share → Add to Home Screen, then open Spawnpoint from the icon.");
  }
  if (!isPushSupported()) {
    throw new Error(
      typeof window !== "undefined" && !window.isSecureContext
        ? "Push needs a secure (HTTPS) connection."
        : "This browser doesn't support push notifications.",
    );
  }
  // First await: keeps the permission prompt inside the user gesture (required on iOS)
  const permission = await requestPermission();
  if (permission !== "granted") {
    lastKnownStatus = permission === "denied" ? "denied" : "disabled";
    throw new Error(
      permission === "denied"
        ? "Notifications are blocked for this site. Allow them in your browser's site settings."
        : "Notification permission was dismissed.",
    );
  }
  const reg = await getReadyRegistration();
  const sub = await ensureSubscription(reg);
  await saveSubscription(sub);
  setWanted(true);
  lastKnownStatus = "enabled";
  return "enabled";
}

/** Stop push on this device and remove it from the account. */
export async function disablePush() {
  setWanted(false);
  const sub = await getExistingSubscription();
  if (sub) {
    const { endpoint } = sub;
    await axios.post(`${PUSH_API}/unsubscribe`, { endpoint }).catch((err) => {
      console.warn("Couldn't remove push subscription on the server:", err?.message);
    });
    await sub.unsubscribe().catch(() => {});
  }
  lastKnownStatus = isPushSupported() && Notification.permission === "denied" ? "denied" : "disabled";
  return lastKnownStatus;
}

/** Ask the server to push a test alert to every device of this account. */
export async function sendTestPush() {
  const res = await axios.post(`${PUSH_API}/test`);
  return res.data; // { success, sent, total, message }
}

/**
 * After sign-in: a subscription belongs to whoever is signed in, so silently
 * (re)attach this device's subscription to the current account. Also restores the
 * subscription after a sign-out if the user had turned alerts on here.
 * Never prompts and never throws.
 */
export async function syncPushSubscription() {
  try {
    if (!isPushSupported() || Notification.permission !== "granted") return false;
    const existing = await getExistingSubscription();
    if (!existing && !isWanted()) return false;
    const reg = await getReadyRegistration();
    const sub = await ensureSubscription(reg);
    await saveSubscription(sub);
    lastKnownStatus = "enabled";
    return true;
  } catch (err) {
    console.warn("Push subscription sync failed:", err?.message || err);
    return false;
  }
}

/**
 * After sign-out the server can no longer be told (the session cookie is gone), so
 * drop the browser subscription: the push service then answers 410 and the server
 * deletes the stale row. The "wanted" flag is kept so the next sign-in re-subscribes.
 */
export async function releasePushSubscription() {
  try {
    const sub = await getExistingSubscription();
    if (sub) await sub.unsubscribe();
  } catch {
    /* ignore */
  }
}

/**
 * Call BEFORE signing out (the session cookie is still valid): remove this device's
 * subscription on the server so the account's alerts stop reaching it immediately.
 */
export async function detachPushFromServer() {
  try {
    const sub = await getExistingSubscription();
    if (sub) await axios.post(`${PUSH_API}/unsubscribe`, { endpoint: sub.endpoint });
  } catch {
    /* best effort — releasePushSubscription() after sign-out covers the rest */
  }
}
