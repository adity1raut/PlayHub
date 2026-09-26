// Join class names, skipping falsy values.
export function cn(...classes) {
  return classes.flat(Infinity).filter(Boolean).join(" ");
}
