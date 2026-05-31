import type { ReactNode } from "react";
const TONES: Record<string, string> = { ok: "#1bc98a", warn: "#ffab2e", alert: "#ff3b46" };
export function Badge({ children, tone }: { children: ReactNode; tone?: "ok" | "warn" | "alert" }) {
  const c = tone ? TONES[tone] : "var(--wl-accent)";
  return <span style={{ color: c, border: `1px solid ${c}55`, background: `${c}1f`,
    fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 99 }}>{children}</span>;
}
