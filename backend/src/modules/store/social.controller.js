import Store from "./store.model.js";
import User from "../auth/user.model.js";
import { toggleFollow } from "../auth/follow.service.js";

export async function followStore(req, res) {
  try {
    const store = await Store.findById(req.params.storeId).select("owner name").lean();
    if (!store) return res.status(404).json({ error: "Store not found" });

    const result = await toggleFollow(req.user._id, store.owner, { store });
    res.status(200).json({
      message: result.followed ? "Following store successfully" : "Unfollowed store successfully",
      following: result.followed,
      followersCount: result.followersCount,
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
}

export async function getFollowStatus(req, res) {
  try {
    const store = await Store.findById(req.params.storeId);
    if (!store) return res.status(404).json({ error: "Store not found" });

    const user = await User.findById(req.user._id);
    res.status(200).json({ following: user.following.includes(store.owner) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function getFollowingStores(req, res) {
  try {
    const { page = 1, limit = 10 } = req.query;

    const user = await User.findById(req.user._id).populate("following");
    const followingUserIds = user.following.map((u) => u._id);

    const stores = await Store.find({ owner: { $in: followingUserIds } })
      .populate("owner", "username profile.name")
      .populate("products", "name price images")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Store.countDocuments({ owner: { $in: followingUserIds } });

    res.status(200).json({
      stores,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
