import User from "./user.model.js";
import { getNotificationService } from "../../socket/socket.handlers.js";
import { broadcast } from "../../socket/realtime.js";

function fail(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

/**
 * Follow or unfollow `targetId` as `followerId` (following a store = following its owner).
 * Uses atomic $addToSet/$pull so double-clicks can't double-count, then:
 *  - broadcasts `follow:updated` (and `store:followers` for stores) so open pages update live
 *  - notifies the followed user on a new follow (deduped, no self-notifications)
 */
export async function toggleFollow(followerId, targetId, { store = null } = {}) {
  if (String(followerId) === String(targetId)) {
    throw fail(store ? "You cannot follow your own store" : "Cannot follow yourself", 400);
  }

  const [follower, target] = await Promise.all([
    User.findById(followerId).select("username").lean(),
    User.findById(targetId).select("username").lean(),
  ]);
  if (!follower || !target) throw fail("User not found", 404);

  const alreadyFollowing = await User.exists({ _id: targetId, followers: followerId });
  const op = alreadyFollowing ? "$pull" : "$addToSet";
  await Promise.all([
    User.updateOne({ _id: targetId }, { [op]: { followers: followerId } }),
    User.updateOne({ _id: followerId }, { [op]: { following: targetId } }),
  ]);

  const [t, f, followsBack] = await Promise.all([
    User.findById(targetId).select("followers").lean(),
    User.findById(followerId).select("following").lean(),
    User.exists({ _id: targetId, following: followerId }),
  ]);
  const result = {
    followed: !alreadyFollowing,
    // Mutual follow = friends, who can message each other
    friends: !alreadyFollowing && Boolean(followsBack),
    followersCount: t?.followers?.length ?? 0,
    followingCount: f?.following?.length ?? 0,
  };

  broadcast("follow:updated", {
    targetId: String(targetId),
    targetUsername: target.username,
    followerId: String(followerId),
    followerUsername: follower.username,
    ...result,
  });
  if (store) {
    broadcast("store:followers", {
      storeId: String(store._id),
      ownerId: String(targetId),
      followersCount: result.followersCount,
      userId: String(followerId),
      following: result.followed,
    });
  }

  if (result.followed) {
    const notifications = getNotificationService();
    const sent = store
      ? notifications?.sendStoreFollowNotification(targetId, followerId, follower.username, store.name)
      : notifications?.sendFollowNotification(targetId, followerId, follower.username, { followBack: result.friends });
    sent?.catch((error) => console.error("Follow notification failed:", error.message));
  }

  return result;
}
