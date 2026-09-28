import mongoose from "mongoose";
import User from "./user.model.js";
import { settingsOf } from "./settings.js";

/** Friends are mutual followers: people `user` follows who follow them back. */
export function friendIdsOf(user) {
  const followers = new Set((user?.followers || []).map(String));
  return (user?.following || []).filter((id) => followers.has(String(id)));
}

/**
 * Chat permissions between `userId` and each of `otherIds`:
 *  - isFriend:   they follow each other
 *  - open:       both allow messages from everyone (settings.privacy.messages)
 *  - canMessage: isFriend || open — symmetric, so whoever can write can also get a reply
 * Returns Map<otherId, access>; ids that are invalid, missing or `userId` itself are left out.
 */
export async function chatAccess(userId, otherIds) {
  const ids = [...new Set(otherIds.map(String))].filter(
    (id) => id !== String(userId) && mongoose.isValidObjectId(id),
  );
  const access = new Map();
  if (!ids.length) return access;

  const [me, others] = await Promise.all([
    User.findById(userId).select("following followers settings.privacy").lean(),
    User.find({ _id: { $in: ids } }).select("settings.privacy").lean(),
  ]);
  if (!me) return access;

  const friends = new Set(friendIdsOf(me).map(String));
  const meOpen = settingsOf(me).privacy.messages === "everyone";
  for (const other of others) {
    const id = String(other._id);
    const isFriend = friends.has(id);
    const open = meOpen && settingsOf(other).privacy.messages === "everyone";
    access.set(id, { isFriend, open, canMessage: isFriend || open });
  }
  return access;
}

export const NOT_FRIENDS_MESSAGE = "You can only message friends. Follow each other to start chatting.";
