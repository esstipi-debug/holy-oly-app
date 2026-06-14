import { DiscRow } from "../../../ui/Disc";

export interface ResumenRow { movementName: string; sets: number; reps: number; kg?: number; pct?: number; }

/** Entrada del Entreno guiado: la lista del día + "▶ Iniciar entrenamiento". `fecha`/`onFechaTap`
 *  (spec 2026-06-12 D12) muestran «Entreno del … ▾» tocable para reabrir el selector de fecha.
 *  SIEMPRE kg + discos; el % va junto al kg, jamás con las series (regla intocable del atleta). */
export function ResumenDia({
  rows,
  barKg,
  fecha,
  onFechaTap,
  onStart,
  onAnular,
}: {
  rows: ResumenRow[];
  barKg: number;
  fecha?: string;
  onFechaTap?: () => void;
  onStart: () => void;
  /** Secuencia de días (2026-06-13): anular el entreno (falló/canceló). Ausente → sin botón. */
  onAnular?: () => void;
}) {
  const setDot = { width: 5, height: 14, borderRadius: 3, background: "color-mix(in srgb,var(--wl-text) 15%,transparent)" };
  return (
    <div>
      {fecha && onFechaTap && (
        <button
          type="button"
          onClick={onFechaTap}
          style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)", padding: "0 0 10px", display: "block" }}
        >
          Entreno del {fecha} <span aria-hidden>▾</span>
        </button>
      )}
      <button type="button" className="wl-btn wl-btn--primary" onClick={onStart} style={{ width: "100%" }}>▶ Iniciar entrenamiento</button>
      {onAnular && (
        <button
          type="button"
          onClick={onAnular}
          style={{ width: "100%", marginTop: 8, background: "none", border: "1px solid color-mix(in srgb,var(--wl-text) 14%,transparent)", borderRadius: "var(--wl-radius)", padding: "9px 0", cursor: "pointer", fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)" }}
        >
          Anular este entreno
        </button>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ background: "var(--wl-surface)", borderRadius: 16, padding: "13px 15px", border: "1px solid color-mix(in srgb,var(--wl-text) 7%,transparent)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 16, color: "var(--wl-text)" }}>{r.movementName}</span>
              <span style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 20, color: "var(--wl-text)" }}>{r.kg != null ? r.kg : "—"}<span style={{ fontSize: 11, color: "var(--wl-muted)", fontWeight: 600 }}> kg</span>{r.pct != null && <span style={{ fontSize: 12, color: "var(--wl-accent)", fontWeight: 700, marginLeft: 5 }}>{r.pct}%</span>}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 11 }}>
              {r.kg != null ? <DiscRow kg={r.kg} barKg={barKg} /> : <span />}
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <div style={{ display: "flex", gap: 3 }} aria-hidden>
                  {Array.from({ length: Math.min(r.sets, 8) }, (_, j) => <span key={j} style={setDot} />)}
                </div>
                <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)", fontVariantNumeric: "tabular-nums" }}>{r.sets}×{r.reps}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
