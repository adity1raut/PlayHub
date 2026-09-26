import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { cn } from "../../lib/cn";

const OPTIONS = [
  { value: "dark", label: "Dark", icon: Moon },
  { value: "light", label: "Light", icon: Sun },
  { value: "system", label: "System", icon: Monitor },
];

/** Three-way dark / light / system segmented control. */
export function ThemeSwitch({ className }) {
  const { themeMode, setThemeMode } = useTheme();
  return (
    <div role="radiogroup" aria-label="Theme" className={cn("flex border border-border", className)}>
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = themeMode === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setThemeMode(value)}
            className={cn(
              "flex size-7 items-center justify-center transition-colors",
              active ? "bg-primary/15 text-primary" : "text-faint hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
