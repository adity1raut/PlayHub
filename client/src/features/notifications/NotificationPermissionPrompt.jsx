import { useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";
import { useNotifications } from "../../context/NotificationContext";
import { desktopPermission } from "../../lib/desktopNotify";
import { toast } from "../../lib/toast";
import { Button, Corners, IconButton } from "../../components/ui";

const SNOOZE_KEY = "spawnpoint:alerts-prompt-snoozed-until";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
const SHOW_AFTER_MS = 4000; // let the workspace load first

const snoozed = () => {
  try {
    return Number(localStorage.getItem(SNOOZE_KEY) || 0) > Date.now();
  } catch {
    return false;
  }
};

/**
 * Asks once whether this device should get desktop notifications. Browsers only show their own
 * permission prompt after a click, so this card is that click. Shown only when the browser has
 * never been asked (people who turned alerts off on purpose aren't nagged); "Not now" waits a week.
 */
export default function NotificationPermissionPrompt() {
  const { pushStatus, enableDeviceAlerts } = useNotifications();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  const ios = pushStatus === "ios-needs-install";
  const eligible = !snoozed() && (ios || (pushStatus === "disabled" && desktopPermission() === "default"));

  useEffect(() => {
    if (!eligible) {
      setVisible(false);
      return undefined;
    }
    const timer = setTimeout(() => setVisible(true), SHOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [eligible]);

  const snooze = () => {
    setVisible(false);
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
    } catch {
      /* shows again next visit */
    }
  };

  const allow = () => {
    setBusy(true);
    // No await before this call: the browser's permission prompt must come from the click
    enableDeviceAlerts()
      .then(() => {
        toast.success("Desktop notifications are on");
        setVisible(false);
      })
      .catch((err) => {
        if (desktopPermission() === "granted") {
          // Allowed, but background push couldn't be set up: alerts still pop up while Spawnpoint is open
          toast.success("Desktop notifications are on while Spawnpoint is open");
          setVisible(false);
        } else if (desktopPermission() === "denied") {
          toast.error("Notifications are blocked. You can allow them in your browser's site settings.");
          setVisible(false);
        } else {
          toast.error(err?.message || "Couldn't turn on notifications");
        }
      })
      .finally(() => setBusy(false));
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="alerts-prompt-title"
      aria-describedby="alerts-prompt-body"
      className="fixed right-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-3 z-[70] border border-border-strong bg-popover p-4 shadow-float animate-slide-up sm:left-auto sm:w-96 md:right-5 md:bottom-12"
    >
      <Corners />
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center border border-primary/50 bg-primary/10 text-primary">
          <BellRing className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p id="alerts-prompt-title" className="text-xs font-bold tracking-[0.12em] text-foreground uppercase">
            {ios ? "Get alerts on your iPhone" : "Turn on desktop notifications?"}
          </p>
          <p id="alerts-prompt-body" className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
            {ios
              ? "Tap Share → Add to Home Screen, then open Spawnpoint from the icon to get message and live-stream alerts."
              : "Get a pop-up on this device for messages, follows, live streams and stage requests — even when Spawnpoint is in the background."}
          </p>
        </div>
        <IconButton icon={X} label="Not now" size="sm" className="-mt-1 -mr-1" onClick={snooze} />
      </div>
      {!ios && (
        <div className="mt-3 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={snooze}>
            Not now
          </Button>
          <Button size="sm" variant="solid" icon={BellRing} loading={busy} onClick={allow}>
            Allow
          </Button>
        </div>
      )}
    </div>
  );
}
