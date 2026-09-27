import { Link } from "react-router-dom";
import {
  ArrowRight,
  Bell,
  MessagesSquare,
  Newspaper,
  Radio,
  ShoppingCart,
  Store,
  Users,
  Zap,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import SiteHeader from "../../components/layout/SiteHeader";
import { Badge, Button, Corners, Eyebrow, StatusDot } from "../../components/ui";

const FEATURES = [
  {
    icon: MessagesSquare,
    title: "Real-time messaging",
    tag: "Realtime",
    desc: "Direct messages with typing indicators, read receipts and search by username or name.",
  },
  {
    icon: Radio,
    title: "Live streams",
    tag: "Live",
    desc: "Go live in a click, pull viewers into chat and track peak viewers and watch time.",
  },
  {
    icon: Newspaper,
    title: "Posts & clips",
    tag: "Feed",
    desc: "Share screenshots and clips, like and comment, and follow the players you rate.",
  },
  {
    icon: Store,
    title: "Creator stores",
    tag: "Commerce",
    desc: "Open a storefront, list products with images and follow the stores you like.",
  },
  {
    icon: ShoppingCart,
    title: "Cart & checkout",
    tag: "Payments",
    desc: "Wishlist, cart, saved addresses and Razorpay checkout — all from your workspace.",
  },
  {
    icon: Bell,
    title: "Notifications that keep up",
    tag: "Alerts",
    desc: "Likes, comments, follows and messages land instantly, with unread counts everywhere.",
  },
];

const HANDSHAKE = [
  ["socket", "LINK.ONLINE", "OK"],
  ["session", "httpOnly cookie", "OK"],
  ["latency", "24 ms", "LOW"],
];

const PREVIEW = [
  { mine: false, text: "Ranked tonight? We need a **fifth**." },
  { mine: true, text: "I'm in — streaming it too." },
  { mine: false, text: "Drop the link in chat" },
];

const bold = (s) =>
  s.split("**").map((part, i) =>
    i % 2 ? (
      <strong key={i} className="text-foreground">
        {part}
      </strong>
    ) : (
      part
    ),
  );

function SessionPreview() {
  return (
    <div
      aria-hidden="true"
      className="relative w-full max-w-md justify-self-center border border-border-strong bg-card/90 shadow-panel lg:justify-self-end"
    >
      <Corners />
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <span className="eyebrow text-muted-foreground">
          Lobby <span className="text-faint">{"//"}</span> night.raid
        </span>
        <span className="eyebrow flex items-center gap-2 text-primary">
          <StatusDot pulse /> Live
        </span>
      </div>
      <dl className="space-y-1.5 border-b border-dashed border-border px-4 py-3 text-[11px]">
        {HANDSHAKE.map(([k, v, s]) => (
          <div key={k} className="flex items-center gap-2">
            <dt className="text-faint">&gt; {k}</dt>
            <span className="min-w-0 flex-1 overflow-hidden whitespace-nowrap text-faint/50">
              {".".repeat(40)}
            </span>
            <dd className="text-muted-foreground">{v}</dd>
            <dd className="w-12 text-right font-bold text-primary">[{s}]</dd>
          </div>
        ))}
      </dl>
      <div className="space-y-3 px-4 py-4">
        {PREVIEW.map((m, i) => (
          <div key={i} className={m.mine ? "flex justify-end" : "flex"}>
            <p
              className={
                m.mine
                  ? "max-w-[80%] border border-primary/40 bg-primary/10 px-3 py-2 text-xs text-foreground"
                  : "max-w-[80%] border border-border bg-muted px-3 py-2 text-xs text-muted-foreground"
              }
            >
              {bold(m.text)}
              {i === PREVIEW.length - 1 && (
                <span className="ml-0.5 inline-block h-3 w-1.5 translate-y-0.5 animate-blink bg-primary" />
              )}
            </p>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[10px] font-bold tracking-[0.14em] text-faint uppercase">
        <span className="flex items-center gap-1.5">
          <Users className="size-3 text-primary" /> 5 in squad
        </span>
        <span>Frame: ∞</span>
      </div>
    </div>
  );
}

function Hero({ signedIn }) {
  return (
    <section className="relative border-b border-border bg-grid">
      <div className="mx-auto grid min-h-[calc(100dvh-3rem)] max-w-6xl grid-cols-1 items-center gap-14 px-4 pt-28 pb-16 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:pt-24">
        <div>
          <Eyebrow index="001" rule className="max-w-xl">
            Gaming community protocol
          </Eyebrow>
          <h1 className="mt-7 border-l border-dotted border-border-strong pl-4 text-[2rem] leading-[1.08] font-extrabold tracking-[0.08em] uppercase sm:pl-6 sm:text-5xl lg:text-[3.25rem]">
            <span className="block text-foreground">One hub for</span>
            <span className="block text-primary text-glow">your squad</span>
            <span className="mt-2 block text-muted-foreground">Chat · Stream · Trade</span>
          </h1>
          <div aria-hidden="true" className="mt-7 w-72 max-w-full border-t-2 border-dotted border-border-strong" />
          <p className="mt-7 max-w-xl border-l border-border-strong pl-4 text-sm leading-7 text-muted-foreground sm:text-[15px]">
            Real-time chat, live streams, a social feed and creator stores — wired together over one live connection,
            so your notifications, messages and viewers never lag behind.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {["Socket.IO", "Live", "Posts", "Stores"].map((t) => (
              <Badge key={t} variant="secondary">
                {t}
              </Badge>
            ))}
            <Badge>Razorpay</Badge>
          </div>
          <div className="mt-9 flex flex-wrap gap-3">
            <Button as={Link} to={signedIn ? "/dashboard" : "/signup"} size="lg" className="glow" iconRight={ArrowRight}>
              {signedIn ? "Open workspace" : "Start playing"}
            </Button>
            {!signedIn && (
              <Button as={Link} to="/login" size="lg" variant="outline">
                Sign in
              </Button>
            )}
          </div>
          <div className="mt-12 flex max-w-xl items-center gap-3 text-[10px] tracking-[0.14em] text-faint uppercase">
            <span>∞</span>
            <span className="h-px flex-1 bg-border-strong" />
            <span>Spawnpoint sentinel</span>
          </div>
        </div>
        <SessionPreview />
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="scroll-mt-20 border-b border-border py-20 sm:py-24" aria-labelledby="features-title">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-1 items-end gap-8 lg:grid-cols-[1.4fr_1fr]">
          <h2 id="features-title" className="text-3xl leading-tight font-extrabold tracking-[0.02em] sm:text-4xl lg:text-5xl">
            Everything your squad does, in one workspace.
          </h2>
          <p className="text-sm leading-7 text-muted-foreground">
            Messages, streams, posts and stores — each doing one job well, all sharing the same account and the same
            live connection.
          </p>
        </div>
        <ul className="mt-14 grid border-t border-l border-border sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, tag, desc }, i) => (
            <li
              key={title}
              className="group relative min-h-64 border-r border-b border-border bg-card/40 p-6 transition-colors hover:bg-card"
            >
              <span
                aria-hidden="true"
                className="absolute top-5 right-5 size-8 border-t border-r border-border-strong transition-colors group-hover:border-primary/60"
              />
              <p className="text-[10px] text-faint tabular-nums">{String(i + 1).padStart(2, "0")}</p>
              <Icon className="mt-8 size-5 text-primary" aria-hidden="true" />
              <h3 className="mt-4 text-sm font-bold tracking-[0.14em] uppercase">{title}</h3>
              <p className="mt-3 text-xs leading-6 text-muted-foreground">{desc}</p>
              <p className="eyebrow mt-5 text-faint">{tag}</p>
              <span
                aria-hidden="true"
                className="absolute right-5 bottom-5 size-1.5 rounded-full bg-primary/70 shadow-[0_0_8px_var(--glow)]"
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const LIVE_POINTS = [
  { label: "Instant", tone: "text-info", text: "Stream chat, viewer counts and notifications arrive over the socket — no refresh." },
  { label: "Measured", tone: "text-primary", text: "Peak viewers, total views and watch time for every stream you run." },
  { label: "Social", tone: "text-warning", text: "Follow hosts from the player and get pinged when they go live." },
  { label: "Yours", tone: "text-muted-foreground", text: "Your streams, posts and store live on one profile people can follow." },
];

function Live() {
  return (
    <section id="live" className="scroll-mt-20 border-b border-border bg-grid py-20 sm:py-24" aria-labelledby="live-title">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.3fr]">
        <div>
          <p className="eyebrow text-info">What the live link carries</p>
          <h2 id="live-title" className="mt-4 text-3xl leading-tight font-extrabold sm:text-4xl lg:text-5xl">
            Go live. Stay in sync.
          </h2>
          <div aria-hidden="true" className="mt-6 h-px w-44 bg-linear-to-r from-primary to-transparent" />
          <p className="mt-6 max-w-md text-sm leading-7 text-muted-foreground">
            One authenticated socket per session powers chat, stream rooms and alerts. Drop it and the status bar tells
            you — it reconnects on its own.
          </p>
        </div>
        <ul className="grid border-t border-l border-border sm:grid-cols-2">
          {LIVE_POINTS.map(({ label, tone, text }) => (
            <li key={label} className="relative border-r border-b border-border bg-background/70 p-6">
              <span aria-hidden="true" className="absolute top-5 right-5 size-6 border-t border-r border-border-strong" />
              <p className={`eyebrow ${tone}`}>{label}</p>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">{text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const STORE_CONFIG = [
  ["name", '"Pixel Forge"'],
  ["category", '"peripherals"'],
  ["products", "24"],
  ["payments", '"razorpay"'],
  ["shipping", '"IN"'],
  ["followers", "1204"],
];

function Marketplace() {
  return (
    <section id="marketplace" className="scroll-mt-20 border-b border-border py-20 sm:py-24" aria-labelledby="market-title">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
        <div>
          <Eyebrow index="003">Creator marketplace</Eyebrow>
          <h2 id="market-title" className="mt-5 text-3xl leading-tight font-extrabold sm:text-4xl">
            A store that lives next to your stream — not in another tab.
          </h2>
          <p className="mt-6 max-w-lg text-sm leading-7 text-muted-foreground">
            Name it, upload a logo, list products with up to five images and track sales and views. Buyers get a cart,
            wishlist, saved addresses and Razorpay checkout.
          </p>
        </div>
        <figure className="relative border border-border-strong bg-card">
          <Corners />
          <figcaption className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="eyebrow text-muted-foreground">store.config</span>
            <span className="eyebrow text-faint">JSON</span>
          </figcaption>
          <pre className="overflow-x-auto p-5 text-xs leading-7 scrollbar-thin">
            <span className="text-faint">{"{"}</span>
            {"\n"}
            {STORE_CONFIG.map(([k, v], i) => (
              <span key={k}>
                {"  "}
                <span className="text-info">{k}</span>
                <span className="text-faint">: </span>
                <span className="text-primary">{v}</span>
                <span className="text-faint">{i < STORE_CONFIG.length - 1 ? "," : ""}</span>
                {"\n"}
              </span>
            ))}
            <span className="text-faint">{"}"}</span>
          </pre>
        </figure>
      </div>
    </section>
  );
}

function CallToAction({ signedIn }) {
  return (
    <section className="bg-grid py-24" aria-labelledby="cta-title">
      <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
        <p className="eyebrow text-faint">004 / Get started</p>
        <h2 id="cta-title" className="mt-5 text-3xl font-extrabold tracking-[0.08em] uppercase sm:text-5xl">
          Open a <span className="text-primary">new</span> lobby.
        </h2>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Button as={Link} to={signedIn ? "/dashboard" : "/signup"} size="lg" className="glow" iconRight={ArrowRight}>
            {signedIn ? "Open workspace" : "Create a free account"}
          </Button>
          {!signedIn && (
            <Button as={Link} to="/login" size="lg" variant="outline">
              I have an account
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-border bg-sidebar">
      <div className="mx-auto flex h-12 max-w-6xl items-center justify-between gap-4 px-4 text-[10px] font-bold tracking-[0.14em] text-faint uppercase sm:px-6">
        <div className="flex items-center gap-5">
          <span>System.Active</span>
          <span className="hidden sm:inline">v2.0.0</span>
        </div>
        <div className="flex items-center gap-5">
          <span className="flex items-center gap-2">
            <StatusDot pulse /> Online
          </span>
          <span className="hidden items-center gap-1.5 sm:flex">
            <Zap className="size-3 text-primary" /> © {new Date().getFullYear()} Spawnpoint
          </span>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <SiteHeader />
      <main>
        <Hero signedIn={isAuthenticated} />
        <Features />
        <Live />
        <Marketplace />
        <CallToAction signedIn={isAuthenticated} />
      </main>
      <SiteFooter />
    </div>
  );
}
