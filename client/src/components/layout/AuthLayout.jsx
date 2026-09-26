import SiteHeader from "./SiteHeader";
import { Card, Corners, StatusDot } from "../ui";

const COVERAGE = [
  { label: "Realtime", tone: "text-info", text: "Chat, notifications and stream chat over a single live Socket.IO link." },
  { label: "Creator-first", tone: "text-primary", text: "Go live, post clips and grow followers from one profile." },
  { label: "Marketplace", tone: "text-warning", text: "Open a store, list gear and take payments with Razorpay." },
];

/** Split layout for sign-in / sign-up / reset: pitch on the left, form card on the right. */
export default function AuthLayout({ title, subtitle, children, footer, status = "Secure" }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background bg-grid text-foreground">
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-4 pt-24 pb-12 sm:px-6">
        <div className="grid w-full max-w-6xl grid-cols-1 items-start gap-12 lg:grid-cols-[1fr_28rem]">
          <section className="hidden lg:block" aria-label="Why PlayHub">
            <div className="border-l border-dashed border-border-strong pl-6">
              <p className="eyebrow text-faint">Player workspace</p>
              <h2 className="mt-5 text-5xl leading-[1.1] font-extrabold tracking-[0.06em] uppercase">
                Press start
                <br />
                on your <span className="text-primary">squad.</span>
              </h2>
              <p className="mt-6 max-w-md text-sm leading-7 text-muted-foreground">
                Messages, live streams, posts and a creator marketplace in one place — built for people who play
                together.
              </p>
            </div>
            <div className="mt-12 max-w-md border border-border bg-card/60 p-6">
              <p className="eyebrow text-faint">System coverage</p>
              <ul className="mt-2 divide-y divide-border">
                {COVERAGE.map(({ label, tone, text }) => (
                  <li key={label} className="py-4">
                    <p className={`text-xs font-bold uppercase ${tone}`}>{label}</p>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{text}</p>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <Card className="w-full bg-card/95 shadow-panel lg:mt-10">
            <Corners />
            <div className="flex items-center justify-between border-b border-border px-6 py-3">
              <span className="eyebrow text-muted-foreground">Authentication</span>
              <span className="eyebrow flex items-center gap-2 text-primary">
                <StatusDot /> {status}
              </span>
            </div>
            <div className="p-6 sm:p-8">
              <h1 className="text-xl font-extrabold tracking-[0.08em] uppercase">{title}</h1>
              {subtitle && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{subtitle}</p>}
              <div className="mt-7">{children}</div>
            </div>
            {footer && (
              <div className="border-t border-border px-6 py-4 text-center text-xs text-muted-foreground">{footer}</div>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}
