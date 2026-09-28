/*
 * Desktop (OS) notifications from the open app, for realtime events that arrive over the socket.
 * Web Push (lib/push.js + public/sw.js) covers the app being closed; this covers it being open but
 * not in front of the user — another tab, another window, or the browser minimised.
 */

const ICON = "/icons/icon-192.png";
const BADGE = "/icons/badge-96.png";

export const desktopNotificationsSupported = () => typeof window !== "undefined" && "Notification" in window;

export const desktopPermission = () => (desktopNotificationsSupported() ? Notification.permission : "unsupported");

/** The user is looking at this tab right now (visible AND the window has focus). */
export const appInFocus = () =>
  typeof document !== "undefined" && document.visibilityState === "visible" && document.hasFocus();

/**
 * Show an OS notification if permission was granted. Clicking it focuses the tab and runs onClick.
 * Returns true when one was shown.
 */
export function showDesktopNotification({ title, body, tag, url, onClick, requireInteraction = false }) {
  if (desktopPermission() !== "granted") return false;
  const options = { body, icon: ICON, badge: BADGE, tag, renotify: Boolean(tag), requireInteraction, data: { url } };
  try {
    const notification = new Notification(title, options);
    notification.onclick = () => {
      try {
        window.focus();
      } catch {
        /* ignore */
      }
      notification.close();
      onClick?.();
    };
    return true;
  } catch {
    // Android Chrome only allows notifications through the service worker (its click handler opens `url`)
    navigator.serviceWorker
      ?.getRegistration("/")
      .then((reg) => reg?.showNotification(title, options))
      .catch(() => {});
    return true;
  }
}

/** Show it only when the app isn't in focus (in focus, the in-app pop-up is enough). */
export function notifyIfAway(options) {
  return appInFocus() ? false : showDesktopNotification(options);
}
