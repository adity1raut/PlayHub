import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "../../lib/cn";

const sizes = { sm: "sm:max-w-sm", md: "sm:max-w-md", lg: "sm:max-w-lg", xl: "sm:max-w-2xl", "2xl": "sm:max-w-4xl" };

/** Bottom sheet on mobile, centered dialog on larger screens. */
export function Modal({ open, onClose, title, description, footer, size = "md", className, bodyClassName, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-100">
      <div className="absolute inset-0 bg-overlay backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        className={cn(
          "absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col border border-border-strong bg-popover text-popover-foreground shadow-panel animate-slide-up",
          "sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-[calc(100%-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2",
          sizes[size],
          className,
        )}
      >
        <span aria-hidden="true" className="pointer-events-none absolute -top-px -left-px size-3 border-t-2 border-l-2 border-primary" />
        <span aria-hidden="true" className="pointer-events-none absolute -right-px -bottom-px size-3 border-r-2 border-b-2 border-primary" />
        {title && (
          <div className="flex flex-col gap-1.5 border-b border-border px-5 pt-5 pb-4 pr-14 sm:px-6">
            <h2 className="text-sm font-bold tracking-[0.14em] uppercase">{title}</h2>
            {description && <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>}
          </div>
        )}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 flex size-8 items-center justify-center border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-accent hover:text-foreground"
        >
          <X className="size-4" aria-hidden="true" />
          <span className="sr-only">Close</span>
        </button>
        <div className={cn("flex-1 overflow-y-auto px-5 py-5 scrollbar-thin sm:px-6", bodyClassName)}>{children}</div>
        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
