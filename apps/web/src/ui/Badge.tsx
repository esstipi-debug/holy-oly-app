import type { ReactNode } from "react";
import { STATUS } from "./status";
export function Badge({ children, tone }: { children: ReactNode; tone?: "ok" | "warn" | "alert" }) {
  const c = tone ? STATUS[tone] : "var(--wl-accent)";
  return <span style={{ color: c, border: `1px solid ${c}55`, background: `${c}1f`,
    fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 99 }}>{children}</span>;
}
