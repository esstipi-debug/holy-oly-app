import type { CSSProperties, ReactNode } from "react";

/**
 * Estado de carga compartido — la línea «Cargando…» (muted) que estaba inline en 16 superficies
 * (coach + atleta + auth). Presentacional puro: aporta `role="status"` + `aria-busy` y el color
 * muted de forma consistente; el caller pasa el mensaje (children, default «Cargando…») y el
 * layout (padding/fontSize/marginTop/fuente) por `style`.
 */
export function Loading({ children = "Cargando…", style }: {
  children?: ReactNode;
  /** Layout del caller (padding/fontSize/marginTop/fontFamily); se mergea sobre el color muted. */
  style?: CSSProperties;
}) {
  return (
    <div role="status" aria-busy="true" style={{ color: "var(--wl-muted)", ...style }}>
      {children}
    </div>
  );
}
