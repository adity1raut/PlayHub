import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Menu, Moon, Sun } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { Button, IconButton, Logo } from "../ui";

const LINKS = [
  { label: "Features", href: "/#features" },
  { label: "Live", href: "/#live" },
  { label: "Marketplace", href: "/#marketplace" },
];

/** Floating top bar for public pages (landing + auth). */
export default function SiteHeader() {
  const { isAuthenticated } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = (e) => menuRef.current && !menuRef.current.contains(e.target) && setMenuOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-2 pt-2 sm:px-4">
      <div className="mx-auto flex h-12 max-w-6xl items-center justify-between gap-3 border border-primary/25 bg-background/90 pr-2 pl-4 shadow-float backdrop-blur-sm sm:pl-7">
        <Link to="/" aria-label="Spawnpoint home">
          <Logo size="sm" />
        </Link>

        <nav aria-label="Site" className="hidden items-center gap-1 lg:flex">
          {LINKS.map(({ label, href }) => (
            <a
              key={href}
              href={href}
              className="border border-transparent px-2.5 py-1.5 text-[10px] font-bold tracking-[0.13em] text-muted-foreground uppercase transition-colors hover:border-primary/35 hover:bg-primary/[0.055] hover:text-foreground"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <IconButton
            size="sm"
            icon={isDark ? Sun : Moon}
            label={isDark ? "Light theme" : "Dark theme"}
            onClick={toggleTheme}
          />
          {/* Wrapper does the hiding: Button's own inline-flex would override a `hidden` class */}
          {!isAuthenticated && (
            <span className="hidden sm:inline-flex">
              <Button as={Link} to="/login" variant="ghost" size="sm">
                Sign in
              </Button>
            </span>
          )}
          <Button as={Link} to={isAuthenticated ? "/dashboard" : "/signup"} size="sm">
            <span className="sm:hidden">{isAuthenticated ? "Open" : "Join"}</span>
            <span className="hidden sm:inline">{isAuthenticated ? "Open workspace" : "Get started"}</span>
          </Button>
          <div ref={menuRef} className="relative lg:hidden">
            <IconButton size="sm" icon={Menu} label="Menu" onClick={() => setMenuOpen((o) => !o)} />
            {menuOpen && (
              <div className="absolute top-full right-0 mt-2 min-w-48 border border-border-strong bg-popover p-1 shadow-float animate-slide-up">
                {LINKS.map(({ label, href }) => (
                  <a
                    key={href}
                    href={href}
                    onClick={() => setMenuOpen(false)}
                    className="block border border-transparent px-2.5 py-2 text-xs font-medium hover:border-border hover:bg-accent"
                  >
                    {label}
                  </a>
                ))}
                {!isAuthenticated && (
                  <>
                    <div className="-mx-1 my-1 h-px bg-border" />
                    <Link
                      to="/login"
                      onClick={() => setMenuOpen(false)}
                      className="block border border-transparent px-2.5 py-2 text-xs font-medium hover:border-border hover:bg-accent"
                    >
                      Sign in
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
