import { useState } from "react";
import { BellRing } from "lucide-react";
import { useNotifications } from "../../context/NotificationContext";
import { toast } from "../../lib/toast";
import { Alert, Button } from "../../components/ui";

const DISMISS_KEY = "playhub:alerts-banner-dismissed";

function readDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/** Compact dashboard prompt to turn on push alerts (hidden once enabled or dismissed). */
function DeviceAlertsBanner({ className }) {
  const { pushStatus, enableDeviceAlerts } = useNotifications();
  const [dismissed, setDismissed] = useState(readDismissed);
  const [busy, setBusy] = useState(false);

  if (dismissed || (pushStatus !== "disabled" && pushStatus !== "ios-needs-install")) return null;
  const ios = pushStatus === "ios-needs-install";

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const enable = () => {
    setBusy(true);
    enableDeviceAlerts()
      .then(() => toast.success("Device alerts are on"))
      .catch((err) => toast.error(err?.response?.data?.message || err?.message || "Couldn't turn on alerts"))
      .finally(() => setBusy(false));
  };

  return (
    <Alert
      variant="info"
      role="status"
      title={ios ? "Get alerts on your iPhone" : "Turn on device alerts"}
      className={className}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p>
          {ios
            ? "Tap Share → Add to Home Screen, then open PlayHub from the icon to get message and live-stream alerts."
            : "Ring and vibrate this device for new messages, follows and live streams, even when PlayHub is closed."}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {!ios && (
            <Button size="sm" variant="solid" icon={BellRing} loading={busy} onClick={enable}>
              Enable
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={dismiss}>
            {ios ? "Got it" : "Not now"}
          </Button>
        </div>
      </div>
    </Alert>
  );
}

export default DeviceAlertsBanner;
