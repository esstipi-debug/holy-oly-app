import type { CellState } from "@holy-oly/core";

/** estado → color. Single source for status color across the new charts. */
export const STATUS: Record<CellState, string> = {
  ok: "#1bc98a",
  warn: "#ffab2e",
  alert: "#ff3b46",
  none: "var(--wl-muted)",
};
