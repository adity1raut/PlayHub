import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import cloudinary from "../../config/cloudinary.js";

export const MAX_ATTACHMENT_MB = 25;

// Allowed chat attachments → the extension they're stored with. The extension comes from this
// list, never from the uploaded file name, so nothing is ever served back as HTML/SVG/script.
const ALLOWED = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/webm": "weba",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/zip": "zip",
  "application/x-zip-compressed": "zip",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
};

/** Message.type for an uploaded file. */
export function attachmentType(mimetype = "") {
  if (mimetype.startsWith("image/")) return "image";
  if (mimetype.startsWith("video/")) return "video";
  if (mimetype.startsWith("audio/")) return "audio";
  return "file";
}

export const chatUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ATTACHMENT_MB * 1024 * 1024, files: 1 },
  fileFilter(req, file, cb) {
    if (ALLOWED[file.mimetype]) return cb(null, true);
    const error = new Error("That file type can't be sent. Try a photo, video, audio clip, PDF, document or zip.");
    error.status = 400;
    cb(error);
  },
});

const UPLOADS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../uploads/chat");

// MEDIA_STORAGE=local forces disk storage (tests, offline dev); otherwise Cloudinary when configured
const useCloudinary = () =>
  process.env.MEDIA_STORAGE !== "local" &&
  Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

// Keep a readable, harmless download name: "Match notes (final).pdf" → "Match_notes_final.pdf"
const safeName = (name, ext) => {
  const base = path
    .basename(String(name || "file"), path.extname(String(name || "")))
    .replace(/[^\w.-]+/g, "_")
    .replace(/^[_.]+|[_.]+$/g, "")
    .slice(0, 60);
  return `${base || "file"}.${ext}`;
};

function uploadToCloudinary(file, type, fileName) {
  // Cloudinary files audio under "video"; documents are "raw" (their public_id keeps the extension)
  const resourceType = type === "image" ? "image" : type === "file" ? "raw" : "video";
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          resource_type: resourceType,
          folder: "spawnpoint/chat",
          filename_override: fileName,
          use_filename: true,
          unique_filename: true,
        },
        (error, result) => (error ? reject(error) : resolve(result)),
      )
      .end(file.buffer);
  });
}

/** Store an uploaded file (multer memory storage) and return a Message.attachments entry + its type. */
export async function storeAttachment(file) {
  const ext = ALLOWED[file.mimetype];
  const type = attachmentType(file.mimetype);
  const originalName = safeName(file.originalname, ext);
  const meta = { originalName, mimetype: file.mimetype, size: file.size };

  if (useCloudinary()) {
    const result = await uploadToCloudinary(file, type, originalName);
    return { type, attachment: { ...meta, filename: result.public_id, url: result.secure_url } };
  }

  const filename = `${crypto.randomBytes(16).toString("hex")}.${ext}`;
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOADS_DIR, filename), file.buffer);
  return { type, attachment: { ...meta, filename, url: `uploads/chat/${filename}` } };
}
