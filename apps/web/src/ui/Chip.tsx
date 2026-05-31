import type { ReactNode } from "react";

export function Chip({
  children,
  selected = false,
  onClick,
}: {
  children: ReactNode;
  selected?: boolean;
  onClick?: () => void;
}) {
  const on: React.CSSProperties = selected
    ? {
        background: "var(--wl-accent)",
        color: "var(--wl-bg)",
        borderColor: "var(--wl-accent)",
        fontWeight: 700,
      }
    : {
        background: "transparent",
        color: "var(--wl-muted)",
        borderColor: "color-mix(in srgb,var(--wl-text) 12%,transparent)",
      };

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flexShrink: 0,
        fontFamily: "var(--mono)",
        fontSize: 10,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        padding: "7px 12px",
        borderRadius: 99,
        border: "1px solid",
        cursor: "pointer",
        whiteSpace: "nowrap",
        ...on,
      }}
    >
      {children}
    </button>
  );
}
