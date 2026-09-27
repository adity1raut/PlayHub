import { useState } from "react";
import { BellOff, BellRing, Send, Volume2, VolumeX } from "lucide-react";
import { useNotifications } from "../../context/NotificationContext";
import { toast } from "../../lib/toast";
import { Button, Card, CardBar, StatusDot } from "../../components/ui";
import { cn } from "../../lib/cn";

const STATES = {
  checking: { label: "Checking", tone: "idle" },
  enabled: { label: "On", tone: "success" },
  disabled: { label: "Off", tone: "idle" },
  denied: { label: "Blocked", tone: "danger" },
  "ios-needs-install": { label: "Install needed", tone: "warning" },
  unsupported: { label: "Unsupported", tone: "idle" },
};

function describe(status) {
  switch (status) {
    case "enabled":
      return "This device rings and vibrates for new messages, follows, likes and live streams, even when Spawnpoint is closed.";
    case "denied":
      return "Notifications are blocked for Spawnpoint in this browser. Open the site settings (lock icon next to the address, or ⋮ → Settings → Site settings on Android), set Notifications to Allow, then reload this page.";
    case "ios-needs-install":
      return "On iPhone and iPad (iOS 16.4+), push works only from the installed app: tap Share → Add to Home Screen, then open Spawnpoint from the icon and turn alerts on there.";
    case "unsupported":
      return typeof window !== "undefined" && !window.isSecureContext
        ? "Push needs a secure (HTTPS) connection. In-app pop-ups with sound still work while Spawnpoint is open."
        : "This browser can't receive push notifications. In-app pop-ups with sound still work while Spawnpoint is open.";
    case "checking":
      return "Checking what this device supports…";
    default:
      return "Get a ring and vibration on this device for new messages, follows and live streams, even when Spawnpoint is closed.";
  }
}

/** "Device alerts" settings: Web Push on/off, test push, and the in-app sound preference. */
function DeviceAlertsCard({ className }) {
  const { pushStatus, enableDeviceAlerts, disableDeviceAlerts, sendTestAlert, soundEnabled, setSoundEnabled } =
    useNotifications();
  const [busy, setBusy] = useState(null); // "enable" | "disable" | "test"

  const state = STATES[pushStatus] ?? STATES.disabled;
  const enabled = pushStatus === "enabled";
  const canEnable = pushStatus === "disabled";

  const handleEnable = () => {
    setBusy("enable");
    // No await before this call: the permission prompt must come from the click
    enableDeviceAlerts()
      .then(() => toast.success("Device alerts are on"))
      .catch((err) => toast.error(err?.response?.data?.message || err?.message || "Couldn't turn on alerts"))
      .finally(() => setBusy(null));
  };

  const handleDisable = async () => {
    setBusy("disable");
    try {
      await disableDeviceAlerts();
      toast("Device alerts are off");
    } catch (err) {
      toast.error(err?.message || "Couldn't turn off alerts");
    } finally {
      setBusy(null);
    }
  };

  const handleTest = async () => {
    setBusy("test");
    try {
      const res = await sendTestAlert();
      if (res?.sent > 0) toast.success(`Test alert sent to ${res.sent} device${res.sent === 1 ? "" : "s"}`);
      else toast.warning(res?.message || "No devices received the test");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Couldn't send a test alert");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className={className}>
      <CardBar
        title="Device alerts"
        right={
          <span className="flex items-center gap-2 text-[10px] font-bold tracking-[0.12em] text-muted-foreground uppercase">
            <StatusDot tone={state.tone} pulse={enabled} />
            {state.label}
          </span>
        }
      />
      <div className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <p
          className={cn(
            "max-w-2xl text-xs leading-relaxed",
            pushStatus === "denied" ? "text-destructive" : "text-muted-foreground",
          )}
          role="status"
        >
          {describe(pushStatus)}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {enabled ? (
            <>
              <Button size="sm" icon={Send} loading={busy === "test"} disabled={!!busy} onClick={handleTest}>
                Send test
              </Button>
              <Button
                size="sm"
                variant="outline"
                icon={BellOff}
                loading={busy === "disable"}
                disabled={!!busy}
                onClick={handleDisable}
              >
                Disable
              </Button>
            </>
          ) : (
            canEnable && (
              <Button
                size="sm"
                variant="solid"
                icon={BellRing}
                loading={busy === "enable"}
                disabled={!!busy}
                onClick={handleEnable}
              >
                Enable
              </Button>
            )
          )}
          <Button
            size="sm"
            variant="outline"
            icon={soundEnabled ? Volume2 : VolumeX}
            aria-pressed={soundEnabled}
            title="In-app alert sound on this device"
            onClick={() => setSoundEnabled(!soundEnabled)}
          >
            Sound {soundEnabled ? "on" : "off"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default DeviceAlertsCard;
