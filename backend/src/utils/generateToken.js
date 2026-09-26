import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

// SameSite policy for the auth cookie:
//  - "lax"  (default) when the client and API share a site (e.g. localhost dev)
//  - "none" when the client and API live on different domains (e.g. Vercel + Render);
//           this also requires HTTPS, so the cookie is marked secure.
const sameSite = (process.env.COOKIE_SAMESITE || "lax").toLowerCase();

// Secure (HTTPS-only) by default in production. Set COOKIE_SECURE=false to serve
// a production build over plain HTTP (e.g. on a LAN IP).
const secure =
  sameSite === "none" ||
  (process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === "true"
    : process.env.NODE_ENV === "production");

export const authCookieOptions = {
  httpOnly: true,
  secure,
  sameSite,
  path: "/",
};

const generateToken = (res, user) => {
  const token = jwt.sign(
    { id: user._id, username: user.username, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "7d" },
  );

  res.cookie("token", token, {
    ...authCookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return token;
};

export default generateToken;
