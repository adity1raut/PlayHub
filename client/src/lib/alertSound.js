/*
 * Short two-tone alert beep made with the Web Audio API (no audio files).
 * Browsers only let audio start after a user gesture, so initAlertSound() unlocks
 * the AudioContext on the first tap/click/keypress.
 */

const STORAGE_KEY = "playhub:alert-sound";
const MIN_GAP_MS = 1200; // collapse bursts of notifications into one beep
const MAX_START_DELAY_MS = 600; // don't play a stale beep if resuming took too long

let ctx = null;
let initialised = false;
let lastPlayedAt = 0;

function getContext() {
  if (ctx) return ctx;
  if (typeof window === "undefined") return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  try {
    ctx = new AudioCtx();
  } catch {
    ctx = null;
  }
  return ctx;
}

/** Per-device preference, default on. */
export function isSoundEnabled() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    /* storage unavailable (private mode): keep the in-memory state only */
  }
}

/** Attach one-time listeners that unlock audio on the first user gesture. */
export function initAlertSound() {
  if (initialised || typeof window === "undefined") return;
  initialised = true;

  const events = ["pointerdown", "keydown", "touchend"];
  const cleanup = () => events.forEach((e) => window.removeEventListener(e, unlock, true));

  function unlock() {
    const c = getContext();
    if (!c) return cleanup();
    try {
      // iOS needs a sound started inside the gesture itself
      const buffer = c.createBuffer(1, 1, 22050);
      const source = c.createBufferSource();
      source.buffer = buffer;
      source.connect(c.destination);
      source.start(0);
    } catch {
      /* ignore */
    }
    const done = () => c.state === "running" && cleanup();
    if (c.state === "suspended") c.resume().then(done).catch(() => {});
    else done();
  }

  events.forEach((e) => window.addEventListener(e, unlock, { capture: true, passive: true }));
}

function tone(c, out, frequency, start, duration) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(1, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(out);
  osc.start(start);
  osc.stop(start + duration + 0.03);
}

function beep(c) {
  const t0 = c.currentTime + 0.01;
  const master = c.createGain();
  master.gain.value = 0.22;
  master.connect(c.destination);
  tone(c, master, 880, t0, 0.13); // A5
  tone(c, master, 1318.5, t0 + 0.15, 0.2); // E6
}

/**
 * Play the alert beep. Respects the sound preference unless `force` is set
 * (used for the preview when the user turns sound on).
 * Returns true when a beep was scheduled.
 */
export function playAlertSound({ force = false } = {}) {
  if (!force && !isSoundEnabled()) return false;
  const now = Date.now();
  if (now - lastPlayedAt < MIN_GAP_MS) return false;
  const c = getContext();
  if (!c) return false;
  lastPlayedAt = now;

  try {
    if (c.state === "running") {
      beep(c);
      return true;
    }
    c.resume()
      .then(() => {
        if (Date.now() - now <= MAX_START_DELAY_MS) beep(c);
      })
      .catch(() => {});
    return true;
  } catch {
    return false;
  }
}

/** Short buzz on phones that support it (Android). Needs a prior user tap. */
export function vibrateAlert(pattern = [180, 80, 180]) {
  try {
    if (isSoundEnabled() && typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(pattern);
  } catch {
    /* ignore */
  }
}
