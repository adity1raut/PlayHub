import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  CalendarDays,
  Camera,
  Handshake,
  Loader2,
  Lock,
  Mail,
  MessagesSquare,
  Pencil,
  Settings,
  UserCheck,
  UserPlus,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { API_URL as backendUrl, mediaUrl } from "../../lib/config";
import { cn } from "../../lib/cn";
import { toast } from "../../lib/toast";
import { Avatar, Badge, Button, Card } from "../../components/ui";
import { friendsCountOf } from "./friends";

// PUT /api/auth/profile takes JSON with base64 data URIs; express.json() caps bodies at 10mb.
const MAX_IMAGE_MB = 4;
const idOf = (v) => String(v?._id ?? v ?? "");

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const formatDate = (date) => new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "long" });

const cameraLabel =
  "flex cursor-pointer items-center justify-center border border-primary/60 bg-popover text-primary transition-colors hover:bg-primary/15 focus-within:outline-1 focus-within:outline-ring has-[:disabled]:cursor-progress has-[:disabled]:opacity-60";

const ProfileHeader = ({
  profileData,
  isOwnProfile,
  uploadingImage,
  setUploadingImage,
  setSuccess,
  setError,
  setProfileData,
  setIsEditing,
  currentUserId,
  onUserUpdated,
  onStatClick,
}) => {
  const { updateProfile, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [uploadingType, setUploadingType] = useState(null);

  const handleImageUpload = async (e, type) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      toast.error(`Image must be smaller than ${MAX_IMAGE_MB}MB`);
      return;
    }

    setUploadingImage(true);
    setUploadingType(type);
    try {
      const base64 = await fileToBase64(file);
      // updateProfile() PUTs JSON { profileImage | coverImage: dataURI } and updates the auth user
      const res = await updateProfile({ [type === "profile" ? "profileImage" : "coverImage"]: base64 });

      if (res?.success) {
        if (onUserUpdated) onUserUpdated(res.user);
        else setProfileData(res.user);
        setSuccess?.(type === "profile" ? "Profile photo updated" : "Cover image updated");
      } else {
        setError?.(res?.message || "Failed to upload image");
      }
    } catch (error) {
      console.error("Upload failed:", error);
      setError?.("Failed to upload image");
    } finally {
      setUploadingImage(false);
      setUploadingType(null);
    }
  };

  const displayName = profileData.profile?.name || profileData.username;

  // Follow state — derived from profileData, which ProfilePage also patches from the
  // `follow:updated` socket event, so follows made in another tab/page show up here too.
  const [followLoading, setFollowLoading] = useState(false);
  const followersArr = Array.isArray(profileData.followers) ? profileData.followers : [];
  const followingArr = Array.isArray(profileData.following) ? profileData.following : [];
  const isFollowing = Boolean(currentUserId) && followersArr.some((f) => idOf(f) === String(currentUserId));
  const followersCount =
    typeof profileData.followersCount === "number" ? profileData.followersCount : followersArr.length;
  const followingCount =
    typeof profileData.followingCount === "number" ? profileData.followingCount : followingArr.length;

  const followsYou = !isOwnProfile && followingArr.some((f) => idOf(f) === String(currentUserId));
  // Friends = follow each other. Only friends can chat, unless both players allow messages from everyone.
  const isFriend = isFollowing && followsYou;
  const canMessage = isFriend || Boolean(profileData.chat?.open);

  // POST /api/auth/profile/:username/follow → { success, followed, followersCount }
  const handleFollow = async () => {
    setFollowLoading(true);
    try {
      const res = await axios.post(
        `${backendUrl}/api/auth/profile/${encodeURIComponent(profileData.username)}/follow`,
        {},
        { withCredentials: true },
      );
      if (res.data.success) {
        const { followed, followersCount: count } = res.data;
        // Keep followers an array of ids so the counts / tabs stay consistent
        setProfileData((prev) => {
          const others = (Array.isArray(prev.followers) ? prev.followers : []).filter(
            (f) => idOf(f) !== String(currentUserId),
          );
          return {
            ...prev,
            followers: followed ? [...others, currentUserId] : others,
            followersCount: typeof count === "number" ? count : undefined,
          };
        });

        // The follow route creates the FOLLOW notification on the server
        toast.success(
          followed
            ? followsYou
              ? `You and @${profileData.username} are now friends — you can message each other`
              : `Following @${profileData.username}`
            : `Unfollowed @${profileData.username}`,
        );
        // Keep the auth user's `following` list fresh for the rest of the app
        refreshUser?.();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to follow/unfollow");
    } finally {
      setFollowLoading(false);
    }
  };

  const openChat = () =>
    navigate("/chat", {
      state: { openChat: { id: profileData._id, username: profileData.username } },
    });

  const stats = [
    { key: "posts", label: "Posts", value: profileData.posts?.length || 0 },
    { key: "friends", label: "Friends", value: friendsCountOf(profileData) },
    { key: "followers", label: "Followers", value: followersCount },
    { key: "following", label: "Following", value: followingCount },
  ];

  const meta = [
    isOwnProfile && profileData.email && { icon: Mail, text: profileData.email },
    profileData.createdAt && { icon: CalendarDays, text: `Joined ${formatDate(profileData.createdAt)}` },
  ].filter(Boolean);

  const coverSrc = profileData.profile?.coverImage;

  return (
    <Card corners className="overflow-hidden">
      {/* Title strip */}
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-2.5 sm:px-6">
        <span className="eyebrow min-w-0 truncate text-muted-foreground">
          Profile <span className="text-faint">{"//"}</span> @{profileData.username}
        </span>
        {isOwnProfile ? (
          <Badge>You</Badge>
        ) : isFriend ? (
          <Badge variant="success" icon={Handshake}>
            Friends
          </Badge>
        ) : (
          followsYou && <Badge variant="secondary">Follows you</Badge>
        )}
      </div>

      {/* Cover */}
      <div className="relative h-32 border-b border-border bg-muted bg-grid sm:h-44">
        {coverSrc && (
          <img src={mediaUrl(coverSrc)} alt="" aria-hidden="true" className="absolute inset-0 size-full object-cover" />
        )}
        {isOwnProfile && (
          <label className={cn(cameraLabel, "absolute top-3 right-3 h-8 gap-2 px-2.5 text-[10px] font-bold tracking-[0.12em] uppercase")}>
            {uploadingType === "cover" ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Camera className="size-3.5" aria-hidden="true" />
            )}
            <span className="hidden sm:inline">Cover</span>
            <span className="sr-only">Change cover image</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="sr-only"
              disabled={uploadingImage}
              onChange={(e) => handleImageUpload(e, "cover")}
            />
          </label>
        )}
      </div>

      {/* Identity */}
      <div className="px-5 pb-6 sm:px-6">
        <div className="-mt-12 flex flex-wrap items-end justify-between gap-3">
          <div className="relative">
            <Avatar
              src={profileData.profile?.profileImage}
              name={displayName}
              size="xl"
              className="bg-card p-1 ring-1 ring-border-strong"
            />
            {isOwnProfile && (
              <label className={cn(cameraLabel, "absolute -right-2 -bottom-2 size-9")} title="Change photo">
                {uploadingType === "profile" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Camera className="size-4" aria-hidden="true" />
                )}
                <span className="sr-only">Change profile photo</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="sr-only"
                  disabled={uploadingImage}
                  onChange={(e) => handleImageUpload(e, "profile")}
                />
              </label>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 pb-1">
            {isOwnProfile ? (
              <>
                <Button variant="outline" icon={Pencil} onClick={() => setIsEditing(true)}>
                  Edit profile
                </Button>
                <Button as={Link} to="/settings" variant="ghost" icon={Settings}>
                  Settings
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant={isFollowing ? "outline" : "solid"}
                  icon={isFollowing ? UserCheck : UserPlus}
                  loading={followLoading}
                  onClick={handleFollow}
                  aria-pressed={isFollowing}
                  title={isFollowing ? "Unfollow" : "Follow"}
                >
                  {isFollowing ? "Following" : followsYou ? "Follow back" : "Follow"}
                </Button>
                {canMessage ? (
                  <Button icon={MessagesSquare} onClick={openChat}>
                    Message
                  </Button>
                ) : (
                  <p className="flex items-center gap-1.5 text-[11px] text-faint">
                    <Lock className="size-3.5" aria-hidden="true" />
                    {followsYou ? "Follow back to chat" : isFollowing ? "Chat unlocks when they follow back" : "Follow each other to chat"}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold tracking-[0.06em] break-words uppercase">{displayName}</h1>
            <p className="mt-1 text-xs text-faint">@{profileData.username}</p>
          </div>

          {profileData.profile?.bio ? (
            <p className="max-w-2xl border-l border-border-strong pl-3 text-xs leading-relaxed break-words whitespace-pre-line text-foreground">
              {profileData.profile.bio}
            </p>
          ) : (
            <p className="text-xs text-faint">
              <span className="text-primary">&gt;</span> {isOwnProfile ? "No bio yet — add one from Edit profile." : "No bio yet"}
            </p>
          )}

          {meta.length > 0 && (
            <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-[11px] text-muted-foreground">
              {meta.map(({ icon: Icon, text }) => (
                <li key={text} className="inline-flex min-w-0 items-center gap-1.5">
                  <Icon className="size-3.5 shrink-0 text-faint" aria-hidden="true" />
                  <span className="truncate">{text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Stats */}
      {/* 2×2 on phones, one row from sm. The card clips overflow, so -mr/-mb hide the outer cell borders. */}
      <div className="-mr-px -mb-px grid grid-cols-2 border-t border-border sm:grid-cols-4">
        {stats.map(({ key, label, value }, i) => (
          <button
            key={key}
            type="button"
            onClick={() => onStatClick?.(key)}
            aria-label={`${value} ${label} — show ${label.toLowerCase()}`}
            className="flex min-w-0 flex-col items-start border-r border-b border-border px-4 py-3.5 text-left transition-colors hover:bg-accent sm:px-6"
          >
            <span className="text-[10px] text-faint tabular-nums">{String(i + 1).padStart(2, "0")}</span>
            <span className="mt-1 text-xl font-extrabold tabular-nums">{value}</span>
            <span className="eyebrow mt-1 text-faint">{label}</span>
          </button>
        ))}
      </div>
    </Card>
  );
};

export default ProfileHeader;
