import { AlertCircle, CheckCircle2, Info, Loader2, TriangleAlert } from "lucide-react";
import { cn } from "../../lib/cn";

/* Bracket accents on two opposite corners — the signature frame detail. */
export function Corners({ size = "size-3", className }) {
  const c = cn("pointer-events-none absolute border-primary/70", size);
  return (
    <span aria-hidden="true" className={className}>
      <span className={cn(c, "-top-px -left-px border-t border-l")} />
      <span className={cn(c, "-right-px -bottom-px border-r border-b")} />
    </span>
  );
}

/* Small uppercase label, optionally with an index ("001 / …") and rules. */
export function Eyebrow({ index, rule = false, className, children }) {
  return (
    <div className={cn("flex items-center gap-3 text-primary", className)}>
      {rule && <span aria-hidden="true" className="h-px w-8 bg-primary/60" />}
      <p className="eyebrow">
        {index && <span className="text-faint">{index} / </span>}
        {children}
      </p>
      {rule && <span aria-hidden="true" className="h-px flex-1 bg-border" />}
    </div>
  );
}

const dotTones = {
  success: "bg-success text-success",
  warning: "bg-warning text-warning",
  danger: "bg-destructive text-destructive",
  info: "bg-info text-info",
  idle: "bg-faint text-faint",
};

export function StatusDot({ tone = "success", pulse = false, className }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block size-1.5 shrink-0 shadow-[0_0_6px_currentColor]",
        dotTones[tone],
        pulse && "animate-pulse",
        className,
      )}
    />
  );
}

/* Animated "signal" bars used in status bars. */
export function ScanBars({ active = true, className }) {
  const heights = ["h-1.5", "h-3", "h-2", "h-3.5", "h-2.5", "h-4", "h-2", "h-3"];
  return (
    <span aria-hidden="true" className={cn("inline-flex h-4 items-end gap-[3px]", className)}>
      {heights.map((h, i) => (
        <span
          key={i}
          className={cn(
            "w-[3px] origin-bottom",
            h,
            active ? "animate-scan bg-primary/70" : "bg-faint/50",
          )}
          style={active ? { animationDelay: `${i * 0.13}s` } : undefined}
        />
      ))}
    </span>
  );
}

const badgeVariants = {
  default: "border-primary/40 bg-primary/10 text-primary",
  secondary: "border-border bg-muted text-muted-foreground",
  outline: "border-border-strong text-foreground",
  destructive: "border-destructive/40 bg-destructive/10 text-destructive",
  success: "border-success/40 bg-success/10 text-success",
  warning: "border-warning/40 bg-warning/10 text-warning",
  info: "border-info/40 bg-info/10 text-info",
};

export function Badge({ variant = "default", icon: Icon, className, children, ...props }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1 border px-1.5 py-0.5 text-[10px] leading-none font-bold tracking-[0.12em] whitespace-nowrap uppercase [&>svg]:size-3 [&>svg]:shrink-0",
        badgeVariants[variant],
        className,
      )}
      {...props}
    >
      {Icon && <Icon aria-hidden="true" />}
      {children}
    </span>
  );
}

/* Red unread counter. Renders nothing for 0. */
export function CountBadge({ count, className }) {
  if (!count) return null;
  return (
    <span
      className={cn(
        "inline-flex h-4.5 min-w-4.5 items-center justify-center bg-destructive px-1 text-[10px] leading-none font-bold text-white tabular-nums",
        className,
      )}
      aria-label={`${count} unread`}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

export function Card({ as: Comp = "div", interactive = false, corners = false, className, children, ...props }) {
  return (
    <Comp
      className={cn(
        "relative border border-border bg-card text-card-foreground",
        interactive && "transition-[border-color,background-color] hover:border-primary/40 hover:bg-accent/40",
        className,
      )}
      {...props}
    >
      {corners && <Corners />}
      {children}
    </Comp>
  );
}

/* Card title bar: eyebrow label on the left, optional slot on the right. */
export function CardBar({ title, right, className, titleClassName }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 border-b border-border px-5 py-3", className)}>
      <h2 className={cn("eyebrow text-primary", titleClassName)}>{title}</h2>
      {right}
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, actions, className }) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0 border-l border-dashed border-border-strong pl-4">
        {eyebrow && <p className="eyebrow mb-2 text-faint">{eyebrow}</p>}
        <h1 className="text-2xl font-extrabold tracking-[0.06em] text-foreground uppercase sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/* Standard page container inside the app shell. */
export function Page({ className, children, wide = false }) {
  return (
    <div
      className={cn(
        "mx-auto w-full space-y-8 px-4 py-8 sm:px-8 sm:py-10",
        wide ? "max-w-7xl" : "max-w-6xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      {Icon && (
        <div className="relative mb-5 flex size-14 items-center justify-center border border-border bg-card text-primary">
          <Corners size="size-2" />
          <Icon className="size-6" aria-hidden="true" />
        </div>
      )}
      <h3 className="text-xs font-bold tracking-[0.16em] text-foreground uppercase">{title}</h3>
      {description && (
        <p className="mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }) {
  return <div aria-hidden="true" className={cn("animate-pulse bg-muted", className)} />;
}

export function Spinner({ label = "Loading", className }) {
  return (
    <span role="status" className="inline-flex items-center">
      <Loader2 className={cn("size-5 animate-spin text-primary", className)} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

/* Full-area centered loader with a label. */
export function LoadingBlock({ label = "Loading", className }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-4 py-20", className)}>
      <Spinner label={label} className="size-6" />
      <p className="eyebrow text-faint">{label}…</p>
    </div>
  );
}

const alertVariants = {
  default: ["border-border bg-card text-foreground", Info],
  info: ["border-info/40 bg-info/[0.06] text-info", Info],
  success: ["border-success/40 bg-success/[0.06] text-success", CheckCircle2],
  warning: ["border-warning/40 bg-warning/[0.06] text-warning", TriangleAlert],
  destructive: ["border-destructive/40 bg-destructive/[0.06] text-destructive", AlertCircle],
};

export function Alert({ variant = "default", title, className, children, ...props }) {
  const [tone, Icon] = alertVariants[variant] ?? alertVariants.default;
  return (
    <div role="alert" className={cn("flex gap-3 border px-4 py-3 text-xs", tone, className)} {...props}>
      <Icon className="mt-px size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-bold tracking-[0.12em] uppercase">{title}</p>}
        {children && (
          <div className={cn("leading-relaxed", title ? "mt-1 text-muted-foreground" : "text-current")}>
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

/* Dashed "— or —" separator. */
export function OrSeparator({ label = "or", className }) {
  return (
    <div className={cn("eyebrow my-6 flex items-center gap-3 text-faint", className)} role="separator">
      <span className="h-px flex-1 border-t border-dashed border-border-strong" />
      {label}
      <span className="h-px flex-1 border-t border-dashed border-border-strong" />
    </div>
  );
}

/* Segmented tab control. options: [{ value, label, icon?, count? }] */
export function Tabs({ options, value, onChange, className }) {
  return (
    <div role="tablist" className={cn("flex flex-wrap border-t border-l border-border", className)}>
      {options.map(({ value: v, label, icon: Icon, count }) => {
        const active = v === value;
        return (
          <button
            key={v}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(v)}
            className={cn(
              "flex items-center gap-2 border-r border-b border-border px-4 py-2.5 text-[11px] font-bold tracking-[0.12em] uppercase transition-colors",
              active
                ? "bg-primary/10 text-primary shadow-[inset_0_-2px_0_var(--primary)]"
                : "bg-card/60 text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {Icon && <Icon className="size-3.5" aria-hidden="true" />}
            {label}
            {count != null && <span className="text-faint tabular-nums">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* Numbered stat tile used in grids with `border-t border-l` wrappers. */
export function StatTile({ index, icon: Icon, label, value, tone = "text-primary", className }) {
  return (
    <div className={cn("relative border-r border-b border-border bg-card/60 p-5", className)}>
      <span aria-hidden="true" className="absolute top-4 right-4 size-5 border-t border-r border-border-strong" />
      {index && <p className="text-[10px] text-faint tabular-nums">{index}</p>}
      <p className="mt-4 text-3xl font-extrabold tabular-nums">{value ?? "–"}</p>
      <p className={cn("eyebrow mt-2 flex items-center gap-1.5", tone)}>
        {Icon && <Icon className="size-3.5" aria-hidden="true" />}
        {label}
      </p>
    </div>
  );
}
