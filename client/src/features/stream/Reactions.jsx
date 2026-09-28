import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "../../lib/cn";
import { REACTIONS } from "./useStreamReactions";

/** Emoji rising over the player. Sits inside a positioned container; never takes clicks. */
export function ReactionsOverlay({ floating }) {
  const ref = useRef(null);
  const [rise, setRise] = useState(200);

  // Travel ~70% of the player's height, whatever its size
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => setRise(Math.round(el.clientHeight * 0.7));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 bottom-12 overflow-hidden">
      {floating.map((r) => (
        <span
          key={r.id}
          className="absolute bottom-2 text-2xl motion-safe:animate-float-up sm:text-3xl"
          style={{ left: `${r.x}%`, "--drift": `${r.drift}px`, "--rise": `-${rise}px` }}
        >
          {r.emoji}
        </span>
      ))}
    </div>
  );
}

/** Row of reaction buttons under the player. */
export function ReactionBar({ onReact, disabled = false, className }) {
  return (
    <div role="group" aria-label="Send a reaction" className={cn("flex flex-wrap items-center gap-1", className)}>
      {REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onReact(emoji)}
          disabled={disabled}
          aria-label={`React ${emoji}`}
          className="flex size-9 items-center justify-center border border-border bg-card text-lg transition-[transform,border-color,background-color] hover:border-primary/50 hover:bg-accent active:scale-90 disabled:opacity-40"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
