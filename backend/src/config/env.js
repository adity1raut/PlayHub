// Startup check of backend/.env: stop with a clear message when the app can't work,
// and warn about settings that only matter once deployed.

const isPlaceholder = (value = "") => /^your_|^<|changeme/i.test(value.trim());

export function checkEnv() {
  const production = process.env.NODE_ENV === "production";
  const errors = [];
  const warnings = [];

  for (const key of ["MONGODB_URI", "JWT_SECRET"]) {
    if (!process.env[key] || isPlaceholder(process.env[key])) errors.push(`${key} is not set`);
  }

  if (production) {
    if (!process.env.CLIENT_URL)
      errors.push("CLIENT_URL is not set (the frontend URL, e.g. https://spawnpoint.example.com)");
    if ((process.env.JWT_SECRET || "").length < 32) {
      warnings.push("JWT_SECRET is shorter than 32 characters. Generate one with: openssl rand -hex 32");
    }
    if (!process.env.SFU_ANNOUNCED_IP) {
      warnings.push(
        "SFU_ANNOUNCED_IP is not set, so live video only works on this machine's network. Set it to the server's public IP",
      );
    }
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
      warnings.push(
        "VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are not set; push subscriptions break if backend/data/ is lost on redeploy",
      );
    }
    const cloudinary = ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"];
    if (cloudinary.some((key) => !process.env[key] || isPlaceholder(process.env[key]))) {
      warnings.push("Cloudinary is not configured, so image and video uploads will fail");
    }
  }

  for (const warning of warnings) console.warn(`Config warning: ${warning}`);
  if (errors.length) {
    for (const error of errors) console.error(`Config error: ${error}`);
    console.error("Fix backend/.env (see backend/.env.example) and restart.");
    process.exit(1);
  }
}
