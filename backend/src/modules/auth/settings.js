/**
 * Per-user settings (privacy + notification preferences) stored on User.settings.
 * Always read them through settingsOf(): lean() queries and users created before
 * settings existed have no (or partial) settings, and the defaults must apply.
 */
export const DEFAULT_SETTINGS = Object.freeze({
  privacy: Object.freeze({ messages: "friends" }),
  notifications: Object.freeze({
    messages: true,
    follows: true,
    likes: true,
    comments: true,
    live: true,
    store: true,
  }),
});

const MESSAGE_PRIVACY = ["friends", "everyone"];

/** Which settings.notifications switch mutes each Notification.type (unlisted types are always sent). */
export const NOTIFICATION_GROUPS = {
  MESSAGE: "messages",
  FOLLOW: "follows",
  LIKE: "likes",
  COMMENT: "comments",
  STREAM_START: "live",
  STREAM_END: "live",
  STREAM_VIEWER: "live",
  STORE_FOLLOW: "store",
  NEW_ORDER: "store",
  REVIEW: "store",
};

/** A user's settings with defaults filled in. Accepts a user doc, a lean object or null. */
export function settingsOf(user) {
  const saved = user?.settings?.toObject?.() ?? user?.settings ?? {};
  const privacy = { ...DEFAULT_SETTINGS.privacy };
  if (MESSAGE_PRIVACY.includes(saved.privacy?.messages)) privacy.messages = saved.privacy.messages;

  const notifications = { ...DEFAULT_SETTINGS.notifications };
  for (const key of Object.keys(notifications)) {
    if (typeof saved.notifications?.[key] === "boolean") notifications[key] = saved.notifications[key];
  }
  return { privacy, notifications };
}

function invalid(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

/**
 * Validate a partial settings update, e.g. { privacy: { messages: "everyone" }, notifications: { likes: false } },
 * and turn it into a Mongo $set. Unknown keys and wrong types are rejected rather than ignored.
 */
export function settingsUpdate(body = {}) {
  const $set = {};
  const { privacy, notifications, ...rest } = body ?? {};
  if (Object.keys(rest).length) throw invalid(`Unknown setting: ${Object.keys(rest)[0]}`);

  if (privacy !== undefined) {
    if (typeof privacy !== "object" || privacy === null) throw invalid("privacy must be an object");
    for (const [key, value] of Object.entries(privacy)) {
      if (key !== "messages") throw invalid(`Unknown privacy setting: ${key}`);
      if (!MESSAGE_PRIVACY.includes(value)) throw invalid('privacy.messages must be "friends" or "everyone"');
      $set["settings.privacy.messages"] = value;
    }
  }

  if (notifications !== undefined) {
    if (typeof notifications !== "object" || notifications === null) throw invalid("notifications must be an object");
    for (const [key, value] of Object.entries(notifications)) {
      if (!(key in DEFAULT_SETTINGS.notifications)) throw invalid(`Unknown notification setting: ${key}`);
      if (typeof value !== "boolean") throw invalid(`notifications.${key} must be true or false`);
      $set[`settings.notifications.${key}`] = value;
    }
  }

  if (!Object.keys($set).length) throw invalid("No settings to update");
  return $set;
}
