import { useEffect, useRef } from "react";
import { cn } from "../../lib/cn";

/**
 * One box per digit. Typing moves forward, Backspace moves back, and pasting or
 * autofilling ("one-time-code" on iOS/Android) spreads the code across the boxes.
 * Calls `onComplete(code)` as soon as every box is filled.
 */
export function OtpInput({
  value = "",
  onChange,
  onComplete,
  length = 6,
  disabled = false,
  invalid = false,
  autoFocus = false,
  label = "Verification code",
  className,
}) {
  const refs = useRef([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  useEffect(() => {
    if (autoFocus && !disabled) refs.current[Math.min(value.length, length - 1)]?.focus();
    // focus once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refocus the first box after the code is cleared (e.g. "Resend")
  useEffect(() => {
    if (value === "" && document.activeElement && refs.current.includes(document.activeElement)) {
      refs.current[0]?.focus();
    }
  }, [value]);

  const commit = (next) => {
    const clean = next.replace(/\D/g, "").slice(0, length);
    onChange?.(clean);
    if (clean.length === length) onComplete?.(clean);
    return clean;
  };

  const focusBox = (i) => {
    const el = refs.current[Math.max(0, Math.min(i, length - 1))];
    el?.focus();
    el?.select?.();
  };

  const handleInput = (i, raw) => {
    let typed = raw.replace(/\D/g, "");
    if (!typed) return;
    // Typing into a filled box (caret not selected) arrives as "old+new": keep the new digit
    if (digits[i] && typed.length === 2) typed = typed.startsWith(digits[i]) ? typed.slice(1) : typed.slice(0, 1);
    // No gaps: an empty box further along fills the first empty one instead.
    // Several digits at once (paste / autofill) overwrite from here onwards.
    const start = Math.min(i, value.length);
    const clean = commit(value.slice(0, start) + typed + value.slice(start + typed.length));
    focusBox(Math.min(start + typed.length, length - 1, clean.length));
  };

  const handleKeyDown = (i, e) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[i]) {
        commit(value.slice(0, i) + value.slice(i + 1));
        focusBox(i);
      } else {
        // Empty box: delete the last digit entered (boxes after it are empty too)
        const target = Math.min(i, value.length) - 1;
        if (target >= 0) {
          commit(value.slice(0, target) + value.slice(target + 1));
          focusBox(target);
        }
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusBox(i - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      focusBox(i + 1);
    }
  };

  const handlePaste = (i, e) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "");
    if (!pasted) return;
    e.preventDefault();
    handleInput(pasted.length >= length ? 0 : i, pasted);
  };

  return (
    <div
      role="group"
      aria-label={label}
      className={cn("flex justify-between gap-1.5 sm:gap-2", invalid && "animate-shake", className)}
    >
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          value={d}
          onChange={(e) => handleInput(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={(e) => handlePaste(i, e)}
          onFocus={(e) => e.target.select()}
          disabled={disabled}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={length}
          aria-label={`Digit ${i + 1} of ${length}`}
          aria-invalid={invalid || undefined}
          className={cn(
            "h-13 w-full min-w-0 border bg-background/60 text-center text-2xl font-extrabold tabular-nums caret-primary transition-[border-color,box-shadow,background-color] outline-none sm:h-14",
            "focus:border-primary focus:shadow-[0_0_0_1px_var(--primary)] disabled:opacity-50",
            invalid
              ? "border-destructive/70 text-destructive"
              : d
                ? "border-primary/60 bg-primary/[0.07] text-primary"
                : "border-input text-foreground",
          )}
        />
      ))}
    </div>
  );
}
