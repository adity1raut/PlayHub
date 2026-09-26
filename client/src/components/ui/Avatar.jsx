import { useState } from "react";
import { cn } from "../../lib/cn";
import { mediaUrl } from "../../lib/config";

const sizes = {
  xs: { box: "size-6 text-[9px]", dot: "size-1.5" },
  sm: { box: "size-8 text-[10px]", dot: "size-2" },
  md: { box: "size-10 text-xs", dot: "size-2.5" },
  lg: { box: "size-14 text-sm", dot: "size-3" },
  xl: { box: "size-24 text-2xl", dot: "size-4" },
};

const initials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";

/** Square avatar with image, initials fallback and optional online dot. */
export function Avatar({ src, name, size = "md", online = false, className }) {
  const [failed, setFailed] = useState(false);
  const s = sizes[size] ?? sizes.md;
  const url = src && !failed ? mediaUrl(src) : "";
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <span
        className={cn(
          "flex items-center justify-center overflow-hidden border border-border-strong bg-muted font-bold text-primary",
          s.box,
        )}
      >
        {url ? (
          <img
            src={url}
            alt={name || "User"}
            loading="lazy"
            className="size-full object-cover"
            onError={() => setFailed(true)}
          />
        ) : (
          <span role="img" aria-label={name || "User"}>
            {initials(name)}
          </span>
        )}
      </span>
      {online && (
        <span
          aria-label="Online"
          className={cn(
            "absolute -right-0.5 -bottom-0.5 bg-success shadow-[0_0_6px_var(--glow)] ring-2 ring-background",
            s.dot,
          )}
        />
      )}
    </span>
  );
}
