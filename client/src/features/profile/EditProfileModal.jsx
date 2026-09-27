import { useRef, useState } from "react";
import { AtSign, Camera, ImagePlus, Save, UserRound, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { mediaUrl } from "../../lib/config";
import { toast } from "../../lib/toast";
import { Alert, Avatar, Button, IconButton, Input, Label, Modal, Textarea } from "../../components/ui";

// PUT /api/auth/profile has no multer: it reads JSON { name, bio, email, profileImage, coverImage }
// where images are base64 data URIs handed to cloudinary.uploader.upload. express.json() is capped
// at 10mb, so each image is limited to 4MB (≈5.4MB once base64-encoded) and sent in its own request.
const MAX_IMAGE_MB = 4;
const BIO_MAX = 200;
const FORM_ID = "edit-profile-form";

const readAsDataURL = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const EditProfileModal = ({
  profileData,
  isEditing,
  setIsEditing,
  updating,
  setUpdating,
  setSuccess,
  setError,
  setProfileData,
  onUserUpdated,
}) => {
  const [editForm, setEditForm] = useState({
    name: profileData.profile?.name || "",
    bio: profileData.profile?.bio || "",
    email: profileData.email || "",
  });
  const [profileImage, setProfileImage] = useState(null); // data URI
  const [coverImage, setCoverImage] = useState(null); // data URI
  const [formError, setFormError] = useState("");
  const avatarInputRef = useRef(null);
  const coverInputRef = useRef(null);

  const { updateProfile } = useAuth();

  const applyUser = (updatedUser) => {
    if (!updatedUser) return;
    if (onUserUpdated) onUserUpdated(updatedUser);
    else setProfileData(updatedUser);
  };

  const close = () => {
    if (!updating) setIsEditing(false);
  };

  const pickImage = async (e, setter) => {
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
    try {
      setter(await readAsDataURL(file));
    } catch {
      toast.error("Couldn't read that image");
    }
  };

  const handleUpdateProfile = async (e) => {
    e?.preventDefault();
    const name = editForm.name.trim();
    const email = editForm.email.trim();
    const bio = editForm.bio.trim();

    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      setFormError("Please enter a valid email address");
      return;
    }

    try {
      setUpdating(true);
      setError?.("");
      setFormError("");

      // updateProfile() PUTs JSON and stores the returned user in AuthContext (sidebar avatar etc.)
      const updateData = { name, email, bio };
      if (profileImage) updateData.profileImage = profileImage;

      const first = await updateProfile(updateData);
      if (!first?.success) {
        setFormError(first?.message || "Failed to update profile");
        return;
      }
      applyUser(first.user);
      setProfileImage(null);

      // Cover goes in its own request so two 4MB images never exceed the 10mb JSON limit
      if (coverImage) {
        const second = await updateProfile({ coverImage });
        if (!second?.success) {
          setFormError(`Profile saved, but the cover image failed: ${second?.message || "upload error"}`);
          return;
        }
        applyUser(second.user);
      }

      setIsEditing(false);
      setSuccess?.("Profile updated successfully");
    } catch (error) {
      console.error("Update failed:", error);
      setFormError(error.message || "Failed to update profile");
    } finally {
      setUpdating(false);
    }
  };

  const displayName = editForm.name || profileData.profile?.name || profileData.username;
  const coverSrc = coverImage || mediaUrl(profileData.profile?.coverImage);

  return (
    <Modal
      open={isEditing}
      onClose={close}
      title="Edit profile"
      description="Update how other players see you on Spawnpoint."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={close} disabled={updating}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} variant="solid" icon={Save} loading={updating}>
            {updating ? "Saving" : "Save changes"}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleUpdateProfile} className="space-y-5" noValidate>
        {/* Cover */}
        <div>
          <Label>Cover image</Label>
          <div className="relative h-28 overflow-hidden border border-border bg-muted bg-grid sm:h-32">
            {coverSrc && <img src={coverSrc} alt="Cover preview" className="absolute inset-0 size-full object-cover" />}
            <div className="absolute right-2 bottom-2 flex gap-2">
              {coverImage && (
                <IconButton
                  icon={X}
                  label="Discard new cover"
                  variant="secondary"
                  size="sm"
                  onClick={() => setCoverImage(null)}
                  disabled={updating}
                />
              )}
              <Button
                variant="secondary"
                size="sm"
                icon={ImagePlus}
                onClick={() => coverInputRef.current?.click()}
                disabled={updating}
              >
                {coverSrc ? "Change" : "Upload"}
              </Button>
            </div>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => pickImage(e, setCoverImage)}
            />
          </div>
        </div>

        {/* Avatar */}
        <div className="flex items-center gap-4">
          <Avatar src={profileImage || profileData.profile?.profileImage} name={displayName} size="lg" />
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                icon={Camera}
                onClick={() => avatarInputRef.current?.click()}
                disabled={updating}
              >
                Change photo
              </Button>
              {profileImage && (
                <Button variant="ghost" size="sm" icon={X} onClick={() => setProfileImage(null)} disabled={updating}>
                  Discard
                </Button>
              )}
            </div>
            <p className="text-[11px] text-faint">PNG, JPG, GIF or WebP · max {MAX_IMAGE_MB}MB each</p>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => pickImage(e, setProfileImage)}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Name"
            icon={UserRound}
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            disabled={updating}
            placeholder="Enter your full name"
            autoComplete="name"
          />
          <Input
            label="Email"
            type="email"
            icon={AtSign}
            value={editForm.email}
            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
            disabled={updating}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </div>

        <Textarea
          label="Bio"
          value={editForm.bio}
          onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
          rows={4}
          maxLength={BIO_MAX}
          disabled={updating}
          placeholder="Tell us about yourself…"
          hint={`${editForm.bio.length}/${BIO_MAX} characters`}
        />

        {formError && (
          <Alert variant="destructive" className="animate-shake">
            {formError}
          </Alert>
        )}
      </form>
    </Modal>
  );
};

export default EditProfileModal;
