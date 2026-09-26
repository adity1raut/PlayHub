import axios from "axios";

// Base URL of the backend. Leave VITE_BACKEND_URL empty when the app is served
// behind a proxy (e.g. the Vite dev proxy) so calls stay relative.
export const API_URL = (import.meta.env.VITE_BACKEND_URL ?? "").replace(/\/+$/, "");

// Auth is a httpOnly cookie, so every request must carry credentials.
axios.defaults.withCredentials = true;

// Turn a stored media path (e.g. "uploads/abc.jpg") into a loadable URL.
// Absolute URLs (Cloudinary, data:, blob:) are returned untouched.
export function mediaUrl(path) {
  if (!path) return "";
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  return `${API_URL}/${String(path).replace(/^\/+/, "")}`;
}
