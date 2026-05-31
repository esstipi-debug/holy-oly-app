import type { ReactNode } from "react";

export function Card({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: "var(--wl-surface)",
        border: "1px solid color-mix(in srgb,var(--wl-text) 8%,transparent)",
        borderRadius: "var(--wl-radius)",
        padding: "13px 12px 14px",
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}
