import { File, FileArchive, FileText, Film, Headphones, Image as ImageIcon } from "lucide-react";

// Mirrors backend/src/modules/chat/attachments.js (the server re-checks every upload)
export const MAX_ATTACHMENT_MB = 25;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
  "audio/ogg",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/x-zip-compressed",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

/** `accept` for the file picker. */
export const ATTACHMENT_ACCEPT =
  "image/*,video/mp4,video/webm,video/quicktime,audio/*,.pdf,.txt,.csv,.zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx";

/** Why a file can't be sent, or null when it can. */
export function attachmentProblem(file) {
  if (!file) return "No file selected";
  if (!ALLOWED_TYPES.has(file.type)) {
    return "That file type can't be sent. Try a photo, video, audio clip, PDF, document or zip.";
  }
  if (file.size > MAX_ATTACHMENT_MB * 1024 * 1024) return `Files must be smaller than ${MAX_ATTACHMENT_MB}MB`;
  return null;
}

/** image | video | audio | file — from a mimetype. */
export function attachmentKind(mimetype = "") {
  if (mimetype.startsWith("image/")) return "image";
  if (mimetype.startsWith("video/")) return "video";
  if (mimetype.startsWith("audio/")) return "audio";
  return "file";
}

export const formatBytes = (bytes = 0) =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const KIND_META = {
  image: { icon: ImageIcon, label: "Photo" },
  video: { icon: Film, label: "Video" },
  audio: { icon: Headphones, label: "Audio" },
};

/** Icon for a non-media file (zip vs document). */
export const fileIcon = (mimetype = "") => (/zip/.test(mimetype) ? FileArchive : mimetype ? FileText : File);

export const attachmentIcon = (mimetype = "") => KIND_META[attachmentKind(mimetype)]?.icon ?? fileIcon(mimetype);

/** { icon, label } describing a message's first attachment (conversation list previews), or null. */
export function attachmentSummary(message) {
  const attachment = message?.attachments?.[0];
  if (!attachment) return null;
  const kind = attachmentKind(attachment.mimetype);
  return KIND_META[kind] ?? { icon: fileIcon(attachment.mimetype), label: attachment.originalName || "File" };
}
