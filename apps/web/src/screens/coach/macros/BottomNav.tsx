import type { CSSProperties, ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

type TabKey = "atletas" | "macros" | "cuenta";

/** Which tab owns the current path (Atletas owns the roster + drill-down; Cuenta owns invitaciones). */
function activeTab(pathname: string): TabKey {
  if (pathname.startsWith("/coach/macros")) return "macros";
  if (pathname.startsWith("/coach/cuenta") || pathname.startsWith("/coach/invitaciones")) return "cuenta";
  return "atletas";
}

const ICON: Record<TabKey, ReactNode> = {
  atletas: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5" /><path d="M16 5.5a3 3 0 0 1 0 5.5M18 20c0-2.5-1-4-2.5-4.7" />
    </svg>
  ),
  macros: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="11" width="4" height="9" rx="1" /><rect x="10" y="6" width="4" height="14" rx="1" /><rect x="17" y="9" width="4" height="11" rx="1" />
    </svg>
  ),
  cuenta: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="8" r="3.4" /><path d="M5 20c0-3.6 3-6 7-6s7 2.4 7 6" />
    </svg>
  ),
};

const TABS: { key: TabKey; to: string; label: string }[] = [
  { key: "atletas", to: "/coach", label: "Atletas" },
  { key: "macros", to: "/coach/macros", label: "Macrociclos" },
  { key: "cuenta", to: "/coach/cuenta", label: "Cuenta" },
];

const bar: CSSProperties = {
  position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 20,
  maxWidth: 390, margin: "0 auto",
  display: "flex", justifyContent: "space-around", alignItems: "stretch",
  background: "color-mix(in srgb,var(--wl-bg) 92%,transparent)",
  borderTop: "1px solid color-mix(in srgb,var(--wl-text) 10%,transparent)",
  backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
};
const item = (active: boolean): CSSProperties => ({
  flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
  padding: "9px 0 calc(9px + env(safe-area-inset-bottom,0px))", textDecoration: "none",
  color: active ? "var(--wl-accent)" : "var(--wl-muted)",
  fontFamily: "var(--mono)", fontSize: 9.5, letterSpacing: ".06em",
});

export function BottomNav() {
  const active = activeTab(useLocation().pathname);
  return (
    <nav style={bar} aria-label="Navegación del coach">
      {TABS.map((t) => {
        const on = t.key === active;
        return (
          <Link key={t.key} to={t.to} style={item(on)} aria-current={on ? "page" : undefined}>
            {ICON[t.key]}
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
