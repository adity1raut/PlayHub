import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon, Send, Video, X } from "lucide-react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { API_URL } from "../../lib/config";
import { cn } from "../../lib/cn";
import { toast } from "../../lib/toast";
import { Avatar, Button, Card, CardBar, IconButton, Textarea } from "../../components/ui";

const MAX_CHARS = 500;
const MAX_FILE_MB = 10;

const formatBytes = (bytes) =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const CreatePost = ({ onPostCreated }) => {
  const [content, setContent] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef();
  const { user } = useAuth();

  // Object URLs are cheap to create but must be released
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  const openPicker = (accept) => {
    if (!fileInputRef.current) return;
    fileInputRef.current.accept = accept;
    fileInputRef.current.click();
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      toast.error("Only image and video files are allowed");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      toast.error(`File size must be less than ${MAX_FILE_MB}MB`);
      e.target.value = "";
      return;
    }

    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const removeFile = () => {
    setSelectedFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) {
      toast.error("Please write something before posting");
      return;
    }

    setIsSubmitting(true);
    try {
      // POST /api/posts/create — multipart: "content" + optional file field "media"
      const formData = new FormData();
      formData.append("content", content.trim());
      if (selectedFile) formData.append("media", selectedFile);

      const res = await axios.post(`${API_URL}/api/posts/create`, formData, { withCredentials: true });

      if (res.data.success) {
        setContent("");
        removeFile();
        onPostCreated?.(res.data.post);
        toast.success("Post published");
      }
    } catch (error) {
      console.error("Error creating post:", error);
      toast.error(error.response?.data?.message || "Failed to create post. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isVideo = selectedFile?.type.startsWith("video/");
  const nearLimit = content.length > MAX_CHARS - 50;

  return (
    <Card corners>
      <CardBar
        title="New post"
        right={
          <span className={cn("text-[11px] tabular-nums", nearLimit ? "text-warning" : "text-faint")}>
            {content.length}/{MAX_CHARS}
          </span>
        }
      />

      <form onSubmit={handleSubmit} className="flex gap-3 p-4 sm:p-5">
        <span className="hidden sm:block">
          <Avatar src={user?.profile?.profileImage} name={user?.profile?.name || user?.username} size="md" />
        </span>

        <div className="min-w-0 flex-1 space-y-3">
          <Textarea
            aria-label="Post content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="> What's on your mind? Share your thoughts…"
            rows={3}
            maxLength={MAX_CHARS}
            disabled={isSubmitting}
          />

          {preview && (
            <div className="relative border border-border bg-background/60">
              {isVideo ? (
                <video src={preview} className="max-h-72 w-full object-contain" controls />
              ) : (
                <img src={preview} alt="Selected media preview" className="max-h-72 w-full object-contain" />
              )}
              <IconButton
                icon={X}
                label="Remove media"
                variant="secondary"
                size="sm"
                onClick={removeFile}
                disabled={isSubmitting}
                className="absolute top-2 right-2"
              />
              <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-2 text-[11px] text-faint">
                <span className="truncate">
                  <span className="text-primary">&gt;</span> {selectedFile?.name}
                </span>
                <span className="shrink-0 tabular-nums">{formatBytes(selectedFile?.size || 0)}</span>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-border pt-3">
            <div className="flex flex-wrap items-center gap-2">
              <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleFileSelect} className="hidden" />
              <Button
                variant="outline"
                size="sm"
                icon={ImageIcon}
                onClick={() => openPicker("image/*")}
                disabled={isSubmitting}
              >
                Photo
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon={Video}
                onClick={() => openPicker("video/*")}
                disabled={isSubmitting}
              >
                Video
              </Button>
              <span className="hidden text-[11px] text-faint md:inline">Max {MAX_FILE_MB}MB</span>
            </div>

            <Button type="submit" variant="solid" size="sm" icon={Send} loading={isSubmitting} disabled={!content.trim()}>
              {isSubmitting ? "Publishing" : "Publish"}
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
};

export default CreatePost;
