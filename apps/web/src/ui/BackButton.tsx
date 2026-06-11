import type { CSSProperties } from "react";

/**
 * Botón «volver» compartido — el cuadrado 34px del drill-down del coach, ahora único para
 * todas las superficies (Drilldown, MacroDetail, Invitaciones, Suscripción). El hit-area
 * táctil llega a 44px vía padding transparente; el margen negativo lo cancela en el layout,
 * así el cuadrado visible queda exactamente donde estaba el botón de 34px.
 */
export function BackButton({ onClick, ariaLabel = "Volver", style }: {
  onClick: () => void;
  ariaLabel?: string;
  /** Ajustes de layout del caller (p.ej. marginBottom); se mergea sobre el margen -5 base. */
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      style={{
        width: 44, height: 44, padding: 5, margin: -5, border: 0, background: "transparent",
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        flex: "0 0 auto", ...style,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 34, height: 34, borderRadius: 10,
          border: "1px solid color-mix(in srgb,var(--wl-text) 15%,transparent)",
          background: "var(--wl-surface)", color: "var(--wl-text)", fontSize: 19, lineHeight: 1,
          display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box",
        }}
      >
        ‹
      </span>
    </button>
  );
}
