import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Bell, ChevronsUpDown, FileText, LogOut, Menu, UserRound, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { useNotifications } from "../../context/NotificationContext";
import { useProduct } from "../../context/ProductContext";
import { useSocketEvent } from "../../lib/useSocketEvent";
import { Avatar, CountBadge, IconButton, Logo, ScanBars, StatusDot } from "../ui";
import { cn } from "../../lib/cn";
import { MOBILE_NAV, NAV_GROUPS, isNavActive } from "./nav";
import { ThemeSwitch } from "./ThemeSwitch";

function useCartCount() {
  const { cart } = useProduct() ?? {};
  const items = cart?.items ?? [];
  return items.reduce((sum, i) => sum + (i.quantity || 0), 0);
}

function AccountMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    navigate("/login", { replace: true });
  };

  const go = (path) => {
    setOpen(false);
    navigate(path);
  };

  const name = user?.profile?.name || user?.username;

  return (
    <div ref={ref} className="relative">
      {open && (
        <div
          role="menu"
          className="absolute right-0 bottom-full left-0 z-50 mb-1 border border-border-strong bg-popover p-1 shadow-float animate-slide-up"
        >
          <p className="eyebrow px-2.5 py-1.5 text-faint">Account</p>
          <button role="menuitem" type="button" onClick={() => go("/profile/me")} className={menuItem}>
            <UserRound /> Profile
          </button>
          <button role="menuitem" type="button" onClick={() => go("/myposts")} className={menuItem}>
            <FileText /> My posts
          </button>
          <div className="-mx-1 my-1 h-px bg-border" />
          <button
            role="menuitem"
            type="button"
            onClick={handleLogout}
            className={cn(menuItem, "text-destructive hover:border-destructive/30 hover:bg-destructive/10 [&_svg]:text-destructive")}
          >
            <LogOut /> Log out
          </button>
        </div>
      )}
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center gap-3 border p-2 text-left transition-colors hover:border-border hover:bg-accent",
          open ? "border-border bg-accent" : "border-transparent",
        )}
      >
        <Avatar src={user?.profile?.profileImage} name={name} size="sm" online />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-bold text-foreground">{name}</span>
          <span className="block truncate text-[11px] text-faint">@{user?.username}</span>
        </span>
        <ChevronsUpDown className="size-4 text-faint" aria-hidden="true" />
      </button>
    </div>
  );
}

const menuItem =
  "relative flex w-full items-center gap-2.5 border border-transparent px-2.5 py-2 text-left text-xs font-medium outline-none select-none hover:border-border hover:bg-accent [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground";

function SidebarNav({ onNavigate }) {
  const { pathname } = useLocation();
  const { unreadCount } = useNotifications();
  const cartCount = useCartCount();
  let n = 0;

  return (
    <nav aria-label="Main" className="flex flex-1 flex-col overflow-y-auto scrollbar-none">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="pb-2">
          <p className="eyebrow px-5 pt-5 pb-3 text-primary">{group.label}</p>
          <div className="flex flex-col gap-px">
            {group.items.map((item) => {
              n += 1;
              const active = isNavActive(item, pathname);
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.id}
                  to={item.path}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex items-center gap-3 border-l-2 py-2.5 pr-4 pl-[18px] text-[13px] font-bold transition-colors",
                    active
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-transparent text-muted-foreground hover:border-border-strong hover:bg-accent hover:text-foreground",
                  )}
                >
                  <span className={cn("w-5 text-[10px] tabular-nums", active ? "text-primary" : "text-faint")}>
                    {String(n).padStart(2, "0")}
                  </span>
                  <Icon
                    className={cn("size-4", active ? "text-primary" : "text-faint group-hover:text-foreground")}
                    aria-hidden="true"
                  />
                  <span className="flex-1">{item.label}</span>
                  {item.showUnread && <CountBadge count={unreadCount} />}
                  {item.showCart && <CountBadge count={cartCount} className="bg-primary text-primary-foreground" />}
                </NavLink>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function Sidebar({ className, onNavigate }) {
  return (
    <aside className={cn("w-60 shrink-0 flex-col border-r border-border bg-sidebar", className)}>
      <div className="border-b border-border px-5 py-5">
        <Logo subtitle="Gaming community" />
      </div>
      <SidebarNav onNavigate={onNavigate} />
      <div className="flex items-center justify-between border-t border-border px-5 py-3">
        <span className="eyebrow text-faint">Theme</span>
        <ThemeSwitch />
      </div>
      <div className="border-t border-border p-2">
        <AccountMenu />
      </div>
    </aside>
  );
}

function StatusBar({ className }) {
  const { isConnected } = useSocket();
  const { user } = useAuth();
  return (
    <footer
      className={cn(
        "h-8 shrink-0 items-center justify-between gap-6 border-t border-border bg-sidebar px-5 text-[10px] font-bold tracking-[0.14em] text-faint uppercase",
        className,
      )}
    >
      <div className="flex items-center gap-5">
        <span className="flex items-center gap-2" role="status">
          <StatusDot tone={isConnected ? "success" : "danger"} pulse={!isConnected} />
          {isConnected ? "Link.Online" : "Link.Reconnecting"}
        </span>
        <ScanBars active={isConnected} />
        <span className="hidden items-center gap-2 lg:flex">
          <StatusDot tone="info" />
          Session: @{user?.username}
        </span>
      </div>
      <span>Spawnpoint · v2.0</span>
    </footer>
  );
}

function MobileTopBar({ onMenu }) {
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-sidebar/95 px-3 backdrop-blur-md md:hidden">
      <NavLink to="/dashboard" aria-label="Spawnpoint home">
        <Logo size="sm" />
      </NavLink>
      <div className="flex items-center gap-1">
        <IconButton icon={Bell} label="Notifications" size="sm" badge={unreadCount} onClick={() => navigate("/notification")} />
        <IconButton icon={Menu} label="Open menu" size="sm" onClick={onMenu} />
      </div>
    </header>
  );
}

function MobileBottomNav() {
  const { pathname } = useLocation();
  const { unreadCount } = useNotifications();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-sidebar/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <div className="grid h-14 grid-cols-6">
        {MOBILE_NAV.map((item) => {
          const active = isNavActive(item, pathname);
          const Icon = item.icon;
          return (
            <NavLink
              key={item.id}
              to={item.path}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 border-t-2 transition-colors",
                active ? "border-primary bg-primary/[0.06] text-primary" : "border-transparent text-faint hover:text-foreground",
              )}
            >
              <span className="relative">
                <Icon className="size-5" strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
                {item.showUnread && (
                  <CountBadge count={unreadCount} className="absolute -top-1.5 -right-3 h-4 min-w-4 px-0.5 text-[9px]" />
                )}
              </span>
              <span className="text-[9px] font-bold tracking-[0.12em] uppercase">{item.short ?? item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

// Routes that manage their own scrolling and fill the viewport (e.g. chat)
const FULL_HEIGHT = ["/chat"];

/** Keep the signed-in user's own followers/following fresh when a follow involves them. */
function useLiveSelfSync() {
  const { user, refreshUser } = useAuth();
  const me = user?._id ? String(user._id) : null;
  useSocketEvent("follow:updated", (e) => {
    if (me && (e.targetId === me || e.followerId === me)) refreshUser();
  });
}

/** Signed-in workspace: sidebar + scrolling main + status bar (+ mobile bars). */
export default function AppShell() {
  useLiveSelfSync();
  const { pathname } = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const fullHeight = FULL_HEIGHT.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const mainRef = useRef(null);

  useEffect(() => {
    setDrawerOpen(false);
    mainRef.current?.scrollTo?.(0, 0);
  }, [pathname]);

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      <Sidebar className="hidden md:flex" />

      {drawerOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <div className="absolute inset-0 bg-overlay" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
          <div className="absolute inset-y-0 left-0 flex animate-fade-in-right">
            <Sidebar className="flex h-full w-72" onNavigate={() => setDrawerOpen(false)} />
            <IconButton
              icon={X}
              label="Close menu"
              variant="secondary"
              size="sm"
              className="m-2"
              onClick={() => setDrawerOpen(false)}
            />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar onMenu={() => setDrawerOpen(true)} />
        <main
          id="main"
          ref={mainRef}
          className={cn(
            "min-h-0 min-w-0 flex-1",
            fullHeight
              ? "overflow-hidden pb-mobile-nav md:pb-0"
              : "overflow-y-auto bg-grid pb-mobile-nav md:pb-0",
          )}
        >
          <Outlet />
        </main>
        <StatusBar className="hidden md:flex" />
      </div>

      <MobileBottomNav />
    </div>
  );
}
