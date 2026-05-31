import type { ReactNode } from "react";
export function Button({ children, onClick, variant = "primary" }:
  { children: ReactNode; onClick?: () => void; variant?: "primary" | "ghost" }) {
  const base = "font-display font-extrabold rounded-xl px-4 py-3 cursor-pointer border-0";
  const styles = variant === "primary"
    ? { background: "var(--wl-accent)", color: "var(--wl-bg)" }
    : { background: "transparent", color: "var(--wl-text)", border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)" };
  return <button className={base} style={styles} onClick={onClick}>{children}</button>;
}
