const idOf = (v) => String(v?._id ?? v ?? "");

/**
 * How many friends (mutual followers) a profile has, from its followers / following id arrays.
 * ProfilePage keeps those arrays live from `follow:updated`, so this stays current too.
 */
export function friendsCountOf(profile) {
  const followers = new Set((Array.isArray(profile?.followers) ? profile.followers : []).map(idOf));
  return (Array.isArray(profile?.following) ? profile.following : []).filter((f) => followers.has(idOf(f))).length;
}
