import type { CSSProperties, ReactNode } from "react";
import { useTranslation } from "react-i18next";

/**
 * Estado de carga compartido — la línea «Cargando…» (muted) que estaba inline en 16 superficies
 * (coach + atleta + auth). Presentacional puro: aporta `role="status"` + `aria-busy` y el color
 * muted de forma consistente; el caller pasa el mensaje (children) o, si no, se usa la clave i18n
 * `common:loading`; el layout (padding/fontSize/marginTop/fuente) va por `style`.
 */
export function Loading({ children, style }: {
  children?: ReactNode;
  /** Layout del caller (padding/fontSize/marginTop/fontFamily); se mergea sobre el color muted. */
  style?: CSSProperties;
}) {
  const { t } = useTranslation();
  return (
    <div role="status" aria-busy="true" style={{ color: "var(--wl-muted)", ...style }}>
      {children ?? t("loading")}
    </div>
  );
}
