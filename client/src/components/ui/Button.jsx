import { Loader2 } from "lucide-react";
import { cn } from "../../lib/cn";

const base =
  "inline-flex shrink-0 items-center justify-center gap-2 border font-bold whitespace-nowrap uppercase tracking-[0.12em] select-none transition-[color,background-color,border-color,box-shadow] duration-150 disabled:pointer-events-none disabled:opacity-45 aria-busy:cursor-progress [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

const variants = {
  default:
    "border-primary/55 bg-primary/[0.07] text-primary hover:border-primary hover:bg-primary/15 hover:glow",
  solid: "border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:glow",
  outline:
    "border-border-strong bg-transparent text-foreground hover:border-primary/50 hover:bg-accent",
  secondary:
    "border-border bg-muted text-foreground hover:border-border-strong hover:bg-accent",
  ghost:
    "border-transparent text-muted-foreground hover:border-border hover:bg-accent hover:text-foreground",
  destructive:
    "border-destructive/50 bg-destructive/[0.07] text-destructive hover:border-destructive hover:bg-destructive/15",
  link: "h-auto border-transparent px-0 normal-case tracking-normal text-primary underline-offset-4 hover:underline",
};

const sizes = {
  sm: "h-8 px-3 text-[10px]",
  default: "h-10 px-4 text-[11px]",
  lg: "h-12 px-6 text-xs",
  icon: "size-10",
  "icon-sm": "size-8",
  "icon-lg": "size-11",
};

export function buttonClass({ variant = "default", size = "default", fullWidth = false } = {}) {
  return cn(base, variants[variant], sizes[size], fullWidth && "w-full");
}

/**
 * Terminal-style button. Pass `as={Link}` (plus `to`) to render a router link.
 */
export function Button({
  as: Comp = "button",
  variant = "default",
  size = "default",
  loading = false,
  icon: Icon,
  iconRight: IconRight,
  fullWidth = false,
  className,
  type,
  disabled,
  children,
  ...props
}) {
  const isButton = Comp === "button";
  return (
    <Comp
      data-slot="button"
      type={isButton ? (type ?? "button") : type}
      disabled={isButton ? disabled || loading : undefined}
      aria-disabled={!isButton && disabled ? true : undefined}
      aria-busy={loading || undefined}
      className={cn(buttonClass({ variant, size, fullWidth }), className)}
      {...props}
    >
      {loading ? (
        <Loader2 className="animate-spin" aria-hidden="true" />
      ) : (
        Icon && <Icon aria-hidden="true" />
      )}
      {children}
      {IconRight && !loading && <IconRight aria-hidden="true" />}
    </Comp>
  );
}

const iconSizes = { sm: "icon-sm", md: "icon", lg: "icon-lg" };

/** Square icon-only button with an accessible label and optional count badge. */
export function IconButton({
  icon: Icon,
  label,
  variant = "ghost",
  size = "md",
  active = false,
  badge,
  className,
  ...props
}) {
  return (
    <Button
      variant={variant}
      size={iconSizes[size]}
      aria-label={label}
      title={label}
      className={cn(
        "relative tracking-normal",
        active && "border-primary/50 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
        className,
      )}
      {...props}
    >
      <Icon
        aria-hidden="true"
        className={size === "lg" ? "size-5" : size === "sm" ? "size-4" : "size-[18px]"}
      />
      {badge ? (
        <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center bg-destructive px-1 text-[9px] font-bold text-white ring-2 ring-background">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </Button>
  );
}
