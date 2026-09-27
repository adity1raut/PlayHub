/**
 * Spawnpoint one-time-code email.
 * Table layout + inline styles only, so it renders the same in Gmail, Outlook and Apple Mail.
 */

import path from "path";
import { fileURLToPath } from "url";

const BRAND = "Spawnpoint";
const ASSETS = path.join(path.dirname(fileURLToPath(import.meta.url)), "email-assets");

// Creator credit + links shown in the email footer
const CREATOR = {
  name: "Aditya Raut",
  title: "Software Engineer",
  links: [
    { id: "linkedin", label: "LinkedIn", url: "https://www.linkedin.com/in/aditya1-raut" },
    { id: "github", label: "GitHub", url: "https://github.com/adity1raut" },
    { id: "website", label: "adityaraut.me", url: "https://www.adityaraut.me/" },
  ],
};

// Images are embedded in the email itself (CID attachments): they show in every mail app,
// even in development where the site isn't publicly reachable.
const IMAGES = ["spawnpoint", ...CREATOR.links.map((l) => l.id)];
const cid = (id) => `${id}@spawnpoint`;
const attachments = IMAGES.map((id) => ({ filename: `${id}.png`, path: path.join(ASSETS, `${id}.png`), cid: cid(id) }));
const C = {
  page: "#0a0f17",
  card: "#0e141e",
  panel: "#141c2a",
  border: "#27303e",
  borderStrong: "#3a4658",
  text: "#e9edf5",
  muted: "#8e98aa",
  faint: "#6f798b",
  teal: "#5eead4",
  tealDim: "#123a37",
};
const MONO = "'JetBrains Mono',SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace";

const COPY = {
  register: {
    subject: `Your ${BRAND} verification code`,
    eyebrow: "Verify email",
    title: "Confirm your email",
    intro: "Enter this code on the sign-up screen to verify your email and finish creating your account.",
    ignore: "Didn't try to sign up? You can safely ignore this email.",
  },
  reset: {
    subject: `Your ${BRAND} password reset code`,
    eyebrow: "Password reset",
    title: "Reset your password",
    intro: "Enter this code on the reset screen to choose a new password.",
    ignore: "Didn't ask to reset your password? Ignore this email — your password stays the same.",
  },
};

const escapeHtml = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

function digitBoxes(code) {
  const cells = String(code)
    .split("")
    .map(
      (d) => `
        <td style="padding:0 2px">
          <div style="width:38px;height:50px;line-height:50px;border:1px solid ${C.teal};background:${C.tealDim};
                      color:${C.teal};font-family:${MONO};font-size:24px;font-weight:800;text-align:center">${d}</div>
        </td>`,
    )
    .join("");
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center"><tr>${cells}</tr></table>`;
}

/**
 * @param {{ code: string, purpose: "register" | "reset", name?: string, ttlMinutes: number }} opts
 * @returns {{ subject: string, html: string, text: string, attachments: object[] }}
 */
export function renderOtpEmail({ code, purpose, name, ttlMinutes }) {
  const copy = COPY[purpose] || COPY.register;
  const hello = name ? `Hi ${escapeHtml(name)},` : "Hi there,";
  const helloText = name ? `Hi ${name},` : "Hi there,";
  const year = new Date().getFullYear();
  const preheader = `${code} is your ${BRAND} code. It expires in ${ttlMinutes} minutes.`;

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>${copy.subject}</title>
</head>
<body style="margin:0;padding:0;background:${C.page}">
  <!-- inbox preview text -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${preheader}</div>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${C.page}">
    <tr>
      <td align="center" style="padding:32px 12px">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
               style="max-width:480px;background:${C.card};border:1px solid ${C.borderStrong}">

          <!-- brand bar -->
          <tr>
            <td style="padding:18px 24px;border-bottom:1px solid ${C.border}">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
                <td style="width:32px;vertical-align:middle">
                  <img src="cid:${cid("spawnpoint")}" width="32" height="32" alt="${BRAND}"
                       style="display:block;border:0;outline:none">
                </td>
                <td style="padding-left:12px;font-family:${MONO};font-size:15px;font-weight:800;font-style:italic;
                           letter-spacing:.16em;text-transform:uppercase;color:${C.text}">${BRAND}</td>
              </tr></table>
            </td>
          </tr>

          <!-- body -->
          <tr>
            <td style="padding:28px 24px 8px;font-family:${MONO}">
              <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${C.teal}">
                <span style="color:${C.faint}">001 /</span> ${copy.eyebrow}
              </p>
              <h1 style="margin:14px 0 0;font-size:22px;line-height:1.3;font-weight:800;letter-spacing:.06em;
                         text-transform:uppercase;color:${C.text}">${copy.title}</h1>
              <p style="margin:18px 0 0;font-size:13px;line-height:1.7;color:${C.muted}">${hello}</p>
              <p style="margin:6px 0 0;font-size:13px;line-height:1.7;color:${C.muted}">${copy.intro}</p>
            </td>
          </tr>

          <!-- code -->
          <tr>
            <td style="padding:22px 12px 6px">${digitBoxes(code)}</td>
          </tr>
          <tr>
            <td align="center" style="padding:10px 24px 0;font-family:${MONO};font-size:11px;color:${C.faint}">
              Expires in <strong style="color:${C.text}">${ttlMinutes} minutes</strong> &middot; only the newest code works
            </td>
          </tr>

          <!-- notes -->
          <tr>
            <td style="padding:24px 24px 26px;font-family:${MONO}">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
                     style="border:1px dashed ${C.borderStrong};background:${C.panel}">
                <tr><td style="padding:12px 14px;font-size:11px;line-height:1.7;color:${C.muted}">
                  <span style="color:${C.teal}">&gt;</span> Never share this code. ${BRAND} will never ask you for it.<br>
                  <span style="color:${C.teal}">&gt;</span> ${copy.ignore}
                </td></tr>
              </table>
            </td>
          </tr>

          <!-- creator -->
          <tr>
            <td style="padding:18px 24px;border-top:1px solid ${C.border};font-family:${MONO}">
              <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${C.faint}">Built by</p>
              <p style="margin:6px 0 0;font-size:13px;font-weight:800;color:${C.text}">
                ${CREATOR.name} <span style="font-weight:400;color:${C.muted}">&middot; ${CREATOR.title}</span>
              </p>
              <!-- inline-blocks wrap onto a new line on narrow phones -->
              <div style="margin-top:12px;line-height:1">
                ${CREATOR.links
                  .map(
                    (l) => `<a href="${l.url}" target="_blank" rel="noopener"
                     style="display:inline-block;margin:0 8px 8px 0;border:1px solid ${C.borderStrong};background:${C.panel};
                            padding:7px 10px;text-decoration:none;color:${C.text};font-size:11px;font-weight:700;white-space:nowrap">
                    <img src="cid:${cid(l.id)}" width="16" height="16" alt=""
                         style="display:inline-block;vertical-align:middle;border:0;margin-right:6px"><span
                         style="vertical-align:middle">${l.label}</span></a>`,
                  )
                  .join("")}
              </div>
            </td>
          </tr>

          <!-- footer -->
          <tr>
            <td style="padding:14px 24px;border-top:1px solid ${C.border};background:${C.page};font-family:${MONO};
                       font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${C.faint}">
              ${BRAND} &middot; Gaming community &middot; &copy; ${year}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `${BRAND} — ${copy.title}`,
    "",
    helloText,
    copy.intro,
    "",
    `Your code: ${code}`,
    `It expires in ${ttlMinutes} minutes. Only the newest code works.`,
    "",
    `Never share this code. ${BRAND} will never ask you for it.`,
    copy.ignore,
    "",
    "—",
    `Built by ${CREATOR.name} · ${CREATOR.title}`,
    ...CREATOR.links.map((l) => `${l.label}: ${l.url}`),
  ].join("\n");

  return { subject: copy.subject, html, text, attachments };
}
