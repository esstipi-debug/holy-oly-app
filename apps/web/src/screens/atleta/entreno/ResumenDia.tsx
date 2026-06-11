import { DiscRow } from "../../../ui/Disc";

export interface ResumenRow { movementName: string; sets: number; reps: number; kg?: number; }

/** Entrada del Entreno guiado: la lista del día + "▶ Iniciar entrenamiento". */
export function ResumenDia({ rows, barKg, onStart }: { rows: ResumenRow[]; barKg: number; onStart: () => void }) {
  return (
    <div>
      <button type="button" className="wl-btn wl-btn--primary" onClick={onStart} style={{ width: "100%" }}>▶ Iniciar entrenamiento</button>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ background: "var(--wl-surface)", borderRadius: "var(--wl-radius)", padding: "11px 13px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 16, color: "var(--wl-text)" }}>{r.movementName}</span>
              <span style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 20, color: "var(--wl-text)" }}>{r.kg != null ? r.kg : "—"}<span style={{ fontSize: 11, color: "var(--wl-muted)", fontWeight: 600 }}> kg</span></span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 8 }}>
              {r.kg != null ? <DiscRow kg={r.kg} barKg={barKg} /> : <span />}
              <span style={{ fontFamily: "var(--wl-display)", fontSize: 13, color: "var(--wl-muted)" }}>{r.sets} series × {r.reps} repeticiones</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
