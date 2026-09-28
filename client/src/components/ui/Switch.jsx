import { cn } from "../../lib/cn";

/** Square on/off toggle. Label it with `aria-label` or `aria-labelledby`. */
export function Switch({ checked, onChange, disabled = false, className, ...props }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center border transition-colors focus-visible:outline-1 focus-visible:outline-ring disabled:opacity-50",
        checked ? "border-primary/70 bg-primary/15" : "border-border-strong bg-muted",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-1/2 size-3 -translate-y-1/2 transition-[left,background-color]",
          checked ? "left-[calc(100%-1rem)] bg-primary shadow-[0_0_6px_var(--primary)]" : "left-1 bg-faint",
        )}
      />
    </button>
  );
}
