/**
 * Minimal className combiner. Filters out falsy values and joins with a space.
 * Kept dependency-free so the UI package stays light.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
