/**
 * Anillo de progreso — el motivo central de la dirección «Pulse» del handoff (jo), adaptado a
 * NUESTROS tokens (acento + texto, jamás los colores hardcodeados del prototipo). Presentacional;
 * `frac` se clampa a [0,1]. `big` al centro, `small` debajo. Reutilizable: cumplimiento, sesiones.
 */
export function ProgressRing({ frac, size = 76, stroke = 7, color = "var(--wl-accent)", big, small }: {
  frac: number;
  size?: number;
  stroke?: number;
  color?: string;
  big: string;
  small?: string;
}) {
  const f = Math.max(0, Math.min(1, frac));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }} role="img" aria-label={small ? `${big} ${small}` : big}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r}
          style={{ stroke: "color-mix(in srgb, var(--wl-text) 10%, transparent)", strokeWidth: stroke, fill: "none" }} />
        <circle cx={size / 2} cy={size / 2} r={r} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ stroke: color, strokeWidth: stroke, fill: "none", strokeDasharray: c, strokeDashoffset: c * (1 - f), transition: "stroke-dashoffset .3s ease" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: size > 80 ? 20 : 16, color: "var(--wl-text)", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{big}</span>
        {small && <span style={{ fontFamily: "var(--mono)", fontSize: 8, color: "var(--wl-muted)", marginTop: 2 }}>{small}</span>}
      </div>
    </div>
  );
}
