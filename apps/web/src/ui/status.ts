import type { CellState } from "@holy-oly/core";

/** estado → color. Single source for status color across the new charts. */
export const STATUS: Record<CellState, string> = {
  ok: "#1bc98a",
  warn: "#ffab2e",
  alert: "#ff3b46",
  none: "var(--wl-muted)",
};

/** Mockup compat: 0=ok, 1=warn, 2=alert (history arrays were ints). */
export function intToState(n: number): CellState {
  return n === 2 ? "alert" : n === 1 ? "warn" : "ok";
}
export function stateToInt(s: CellState): number {
  return s === "alert" ? 2 : s === "warn" ? 1 : 0;
}
