import { cn } from "../../lib/cn";

export function LogoMark({ className }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" stroke="currentColor" strokeWidth="4" aria-hidden="true">
      <path d="M3 17V3h14M61 47v14H47" />
      <path d="M12 16h40v28H12z" fill="currentColor" fillOpacity=".1" />
      <path d="M27 23.5l11 6.5-11 6.5z" fill="currentColor" stroke="none" />
      <rect x="22" y="48" width="20" height="4" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Mark + skewed wordmark. `compact` hides the text. */
export function Logo({ subtitle, compact = false, size = "md", className }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <LogoMark
        className={cn(
          "shrink-0 text-primary drop-shadow-[0_0_8px_var(--glow)]",
          size === "sm" ? "size-6" : "size-9",
        )}
      />
      {!compact && (
        <div className="min-w-0">
          <p
            className={cn(
              "-skew-x-12 leading-none font-extrabold tracking-[0.16em] text-foreground uppercase italic",
              size === "sm" ? "text-[13px] sm:text-sm" : "text-[15px]",
            )}
          >
            PlayHub
          </p>
          {subtitle && <p className="eyebrow mt-1.5 text-faint">{subtitle}</p>}
        </div>
      )}
    </div>
  );
}
