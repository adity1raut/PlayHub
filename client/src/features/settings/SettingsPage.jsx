import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { AtSign, Globe, Handshake, KeyRound, Monitor, Moon, RefreshCw, Save, Sun, UserRound } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { API_URL } from "../../lib/config";
import { cn } from "../../lib/cn";
import { toast } from "../../lib/toast";
import { useSocketEvent } from "../../lib/useSocketEvent";
import {
  Alert,
  Avatar,
  Button,
  Card,
  CardBar,
  Input,
  LoadingBlock,
  Page,
  PageHeader,
  PasswordInput,
  Switch,
  Textarea,
} from "../../components/ui";
import DeviceAlertsCard from "../notifications/DeviceAlertsCard";

const BIO_MAX = 200;
const MIN_PASSWORD = 6; // same rule as sign-up

const MESSAGE_OPTIONS = [
  {
    value: "friends",
    label: "Friends only",
    icon: Handshake,
    description: "Only friends — players you follow who follow you back — can message you.",
  },
  {
    value: "everyone",
    label: "Everyone",
    icon: Globe,
    description: "Players who aren't your friends can message you too, if they also allow everyone.",
  },
];

// Keys match settings.notifications on the server (backend/src/modules/auth/settings.js)
const NOTIFICATION_OPTIONS = [
  { key: "messages", label: "Messages", description: "New chat messages, photos, videos and files" },
  { key: "follows", label: "Followers", description: "Someone follows you, or follows you back and becomes a friend" },
  { key: "likes", label: "Likes", description: "Someone likes your post" },
  { key: "comments", label: "Comments", description: "Someone comments on your post" },
  { key: "live", label: "Live streams", description: "A player you follow goes live" },
  { key: "store", label: "Store activity", description: "New store followers, orders and product reviews" },
];

const THEME_OPTIONS = [
  { value: "dark", label: "Dark", icon: Moon },
  { value: "light", label: "Light", icon: Sun },
  { value: "system", label: "System", icon: Monitor },
];

// Layout (direction, alignment, padding) is left to each use: cn() doesn't resolve conflicting utilities
const radioClass = (active) =>
  cn(
    "flex border text-left transition-colors focus-visible:outline-1 focus-visible:outline-ring",
    active
      ? "border-primary/60 bg-primary/10 shadow-[inset_0_-2px_0_var(--primary)]"
      : "border-border bg-card/60 hover:border-border-strong hover:bg-accent",
  );

function SaveStatus({ status }) {
  if (!status) return null;
  return (
    <span role="status" className="text-[10px] font-bold tracking-[0.12em] text-faint uppercase">
      {status === "saving" ? "Saving…" : <span className="text-success">Saved</span>}
    </span>
  );
}

/**
 * GET/PUT /api/auth/settings. Changes apply instantly (optimistic) and are sent as small patches;
 * if the server refuses one, the page reloads the saved settings.
 */
function useSettings() {
  const { setUser } = useAuth();
  const [settings, setSettings] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [status, setStatus] = useState({}); // section → "saving" | "saved"
  const inFlight = useRef({}); // section → requests in flight

  const load = useCallback(async () => {
    try {
      setLoadError("");
      const res = await axios.get(`${API_URL}/api/auth/settings`);
      if (res.data.success) setSettings(res.data.data);
      else setLoadError(res.data.message || "Couldn't load your settings");
    } catch (error) {
      setLoadError(error.response?.data?.message || "Couldn't load your settings");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Saved in another tab: show it — unless this tab is mid-save, where its own optimistic
  // state leads and the last response settles it
  useSocketEvent(
    "settings:updated",
    (saved) => {
      if (saved && !Object.values(inFlight.current).some(Boolean)) setSettings(saved);
    },
    { onReconnect: load },
  );

  const save = async (section, patch) => {
    setSettings((s) => ({
      privacy: { ...s.privacy, ...patch.privacy },
      notifications: { ...s.notifications, ...patch.notifications },
    }));
    inFlight.current[section] = (inFlight.current[section] || 0) + 1;
    setStatus((s) => ({ ...s, [section]: "saving" }));
    let ok = false;
    try {
      const res = await axios.put(`${API_URL}/api/auth/settings`, patch);
      ok = Boolean(res.data.success);
      if (ok) setUser?.((u) => (u ? { ...u, settings: res.data.data } : u));
    } catch (error) {
      toast.error(error.response?.data?.message || "Couldn't save that setting");
    }
    if (!ok) load();
    // Only the last request of a burst decides what the section shows
    inFlight.current[section] -= 1;
    if (inFlight.current[section] === 0) setStatus((s) => ({ ...s, [section]: ok ? "saved" : undefined }));
  };

  return { settings, loadError, reload: load, save, status };
}

function ProfileSection() {
  const { user, updateProfile } = useAuth();
  const [form, setForm] = useState({
    name: user?.profile?.name || "",
    email: user?.email || "",
    bio: user?.profile?.bio || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const trimmed = { name: form.name.trim(), email: form.email.trim(), bio: form.bio.trim() };
  const dirty =
    trimmed.name !== (user?.profile?.name || "") ||
    trimmed.email !== (user?.email || "") ||
    trimmed.bio !== (user?.profile?.bio || "");

  const submit = async (e) => {
    e.preventDefault();
    if (trimmed.email && !/^\S+@\S+\.\S+$/.test(trimmed.email)) {
      setError("Please enter a valid email address");
      return;
    }
    setSaving(true);
    setError("");
    const res = await updateProfile(trimmed);
    setSaving(false);
    if (res?.success) toast.success("Profile saved");
    else setError(res?.message || "Couldn't save your profile");
  };

  const name = user?.profile?.name || user?.username;

  return (
    <Card as="section" aria-labelledby="settings-profile">
      <CardBar title={<span id="settings-profile">Profile</span>} />
      <form onSubmit={submit} className="space-y-4 p-5" noValidate>
        <div className="flex flex-wrap items-center gap-4">
          <Avatar src={user?.profile?.profileImage} name={name} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{name}</p>
            <p className="truncate text-[11px] text-faint">@{user?.username}</p>
          </div>
          <Button as={Link} to="/profile/me" variant="outline" size="sm">
            Photo &amp; cover
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Name"
            icon={UserRound}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            autoComplete="name"
            disabled={saving}
          />
          <Input
            label="Email"
            type="email"
            icon={AtSign}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            autoComplete="email"
            disabled={saving}
          />
        </div>
        <Textarea
          label="Bio"
          rows={3}
          maxLength={BIO_MAX}
          value={form.bio}
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
          hint={`${form.bio.length}/${BIO_MAX} characters`}
          disabled={saving}
        />

        {error && <Alert variant="destructive">{error}</Alert>}

        <div className="flex justify-end">
          <Button type="submit" variant="solid" icon={Save} loading={saving} disabled={!dirty}>
            Save profile
          </Button>
        </div>
      </form>
    </Card>
  );
}

function MessagesSection({ value, onChange, status }) {
  return (
    <Card as="section" aria-labelledby="settings-messages">
      <CardBar title={<span id="settings-messages">Messages &amp; privacy</span>} right={<SaveStatus status={status} />} />
      <div className="space-y-4 p-5">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Friends are players who follow each other. Your friends list is shown on your profile, and friends can
          always chat — including photos, videos and files.
        </p>
        <div role="radiogroup" aria-label="Who can message you" className="grid gap-3 sm:grid-cols-2">
          {MESSAGE_OPTIONS.map(({ value: v, label, icon: Icon, description }) => {
            const active = value === v;
            return (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => !active && onChange(v)}
                className={cn(radioClass(active), "items-start gap-3 p-4")}
              >
                <Icon className={cn("mt-0.5 size-4 shrink-0", active ? "text-primary" : "text-faint")} aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-xs font-bold tracking-[0.08em] text-foreground uppercase">{label}</span>
                  <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">{description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

function NotificationRow({ option, checked, onChange }) {
  const id = useId();
  return (
    <li className="flex items-center justify-between gap-4 px-5 py-3.5">
      <div className="min-w-0">
        <p id={`${id}-label`} className="text-xs font-bold text-foreground">
          {option.label}
        </p>
        <p id={`${id}-desc`} className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
          {option.description}
        </p>
      </div>
      <Switch
        checked={checked}
        onChange={onChange}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-desc`}
      />
    </li>
  );
}

function NotificationsSection({ values, onChange, status }) {
  return (
    <Card as="section" aria-labelledby="settings-notifications">
      <CardBar
        title={<span id="settings-notifications">Notifications</span>}
        right={<SaveStatus status={status} />}
      />
      <p className="border-b border-border px-5 py-3 text-[11px] leading-relaxed text-faint">
        Turned-off alerts aren&apos;t shown in the app or pushed to your devices.
      </p>
      <ul className="divide-y divide-border">
        {NOTIFICATION_OPTIONS.map((option) => (
          <NotificationRow
            key={option.key}
            option={option}
            checked={values[option.key]}
            onChange={(on) => onChange(option.key, on)}
          />
        ))}
      </ul>
    </Card>
  );
}

function AppearanceSection() {
  const { themeMode, setThemeMode } = useTheme();
  return (
    <Card as="section" aria-labelledby="settings-appearance">
      <CardBar title={<span id="settings-appearance">Appearance</span>} />
      <div className="p-5">
        <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-3">
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
            const active = themeMode === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setThemeMode(value)}
                className={cn(radioClass(active), "flex-col items-center justify-center gap-2 px-4 py-5")}
              >
                <Icon className={cn("size-5", active ? "text-primary" : "text-faint")} aria-hidden="true" />
                <span className="text-[11px] font-bold tracking-[0.12em] uppercase">{label}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-[11px] text-faint">Saved on this device.</p>
      </div>
    </Card>
  );
}

function PasswordSection() {
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const mismatch = form.confirm && form.next !== form.confirm;
  const canSubmit = form.current && form.next.length >= MIN_PASSWORD && form.next === form.confirm;

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError("");
    try {
      const res = await axios.put(`${API_URL}/api/auth/password`, {
        currentPassword: form.current,
        newPassword: form.next,
      });
      if (res.data.success) {
        setForm({ current: "", next: "", confirm: "" });
        toast.success("Password changed");
      } else setError(res.data.message || "Couldn't change your password");
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't change your password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card as="section" aria-labelledby="settings-password">
      <CardBar title={<span id="settings-password">Password</span>} />
      <form onSubmit={submit} className="space-y-4 p-5">
        <PasswordInput
          label="Current password"
          icon={KeyRound}
          value={form.current}
          onChange={(e) => setForm({ ...form, current: e.target.value })}
          autoComplete="current-password"
          disabled={saving}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <PasswordInput
            label="New password"
            value={form.next}
            onChange={(e) => setForm({ ...form, next: e.target.value })}
            autoComplete="new-password"
            hint={`At least ${MIN_PASSWORD} characters`}
            disabled={saving}
          />
          <PasswordInput
            label="Confirm new password"
            value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
            autoComplete="new-password"
            error={mismatch ? "Passwords don't match" : undefined}
            disabled={saving}
          />
        </div>
        {error && <Alert variant="destructive">{error}</Alert>}
        <div className="flex justify-end">
          <Button type="submit" variant="solid" icon={KeyRound} loading={saving} disabled={!canSubmit}>
            Change password
          </Button>
        </div>
      </form>
    </Card>
  );
}

export default function SettingsPage() {
  const { settings, loadError, reload, save, status } = useSettings();

  return (
    <Page>
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          eyebrow="Workspace / Settings"
          title="Settings"
          description="Your profile, who can message you, which alerts you get, and how Spawnpoint looks."
        />

        <ProfileSection />

        {loadError && !settings ? (
          <Alert variant="destructive" title="Couldn't load your settings">
            <p>{loadError}</p>
            <Button variant="outline" size="sm" icon={RefreshCw} className="mt-3" onClick={reload}>
              Try again
            </Button>
          </Alert>
        ) : !settings ? (
          <LoadingBlock label="Loading settings" />
        ) : (
          <>
            <MessagesSection
              value={settings.privacy.messages}
              status={status.privacy}
              onChange={(messages) => save("privacy", { privacy: { messages } })}
            />
            <NotificationsSection
              values={settings.notifications}
              status={status.notifications}
              onChange={(key, on) => save("notifications", { notifications: { [key]: on } })}
            />
          </>
        )}

        <DeviceAlertsCard />
        <AppearanceSection />
        <PasswordSection />
      </div>
    </Page>
  );
}
