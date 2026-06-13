/**
 * Enlace «Reintentar» compartido — el botón-link subrayado que acompaña a los estados de error
 * (patrón D5: `role="alert"` + mensaje + Reintentar). Antes vivía inline y duplicado en ~14
 * superficies (coach y atleta) con el mismo recipe salvo el tamaño. Presentacional puro: el
 * caller pasa el handler y, si hace falta, el `fontSize` para calzar con el copy que lo rodea.
 */
export function RetryButton({ onClick, fontSize = 11 }: {
  onClick: () => void;
  /** Calza con el font-size del bloque de error que lo envuelve (10.5 / 11 / 12). */
  fontSize?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: 0,
        background: "transparent",
        color: "var(--wl-accent)",
        fontFamily: "var(--mono)",
        fontSize,
        cursor: "pointer",
        textDecoration: "underline",
        padding: 0,
      }}
    >
      Reintentar
    </button>
  );
}
