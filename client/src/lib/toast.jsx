import hotToast, { Toaster as HotToaster } from "react-hot-toast";

// One toast API for the whole app (replaces the mix of react-toastify / react-hot-toast).
// Supports the react-toastify method names that existing pages use.
export const toast = Object.assign((msg, opts) => hotToast(msg, opts), {
  success: (msg, opts) => hotToast.success(msg, opts),
  error: (msg, opts) => hotToast.error(msg, opts),
  info: (msg, opts) => hotToast(msg, { icon: "›", ...opts }),
  warning: (msg, opts) => hotToast(msg, { icon: "!", ...opts }),
  warn: (msg, opts) => hotToast(msg, { icon: "!", ...opts }),
  loading: (msg, opts) => hotToast.loading(msg, opts),
  promise: (p, msgs, opts) => hotToast.promise(p, msgs, opts),
  dismiss: (id) => hotToast.dismiss(id),
});

/** Themed toast viewport — mount once near the app root. */
export function Toaster() {
  return (
    <HotToaster
      position="bottom-right"
      gutter={8}
      toastOptions={{
        duration: 3500,
        style: {
          borderRadius: 0,
          border: "1px solid var(--border-strong)",
          background: "var(--popover)",
          color: "var(--popover-foreground)",
          boxShadow: "var(--float-shadow)",
          fontFamily: "inherit",
          fontSize: "12px",
          padding: "10px 12px",
        },
        success: { iconTheme: { primary: "var(--success)", secondary: "var(--popover)" } },
        error: {
          iconTheme: { primary: "var(--destructive)", secondary: "var(--popover)" },
          style: { borderColor: "color-mix(in srgb, var(--destructive) 50%, transparent)" },
        },
      }}
    />
  );
}

export default toast;
