import { DiscRow } from "../Disc";

const GOLD = "var(--gold)";

export interface DayDetailExercise { name: string; sets: number; reps: number; pct?: number; kg?: number }
export type DayEstado = "done" | "missed" | "today" | "pending";

const ESTADO_LABEL: Record<DayEstado, { text: string; color: string }> = {
  done: { text: "Hecha ✓", color: "var(--wl-muted)" },
  missed: { text: "No se hizo ✗", color: "var(--wl-muted)" },
  today: { text: "HOY", color: "var(--wl-accent)" },
  pending: { text: "Programada", color: "var(--wl-muted)" },
};

/**
 * Desglose de un día del calendario-mapa: el entrenamiento, qué tipo de fase es y su objetivo.
 * Presentacional puro y compartido coach/atleta. Regla intocable: cada fila lleva kg + discos
 * vía `DiscRow` oficial; sin kg → «—» y SIN discos (jamás un 0 inventado). Sin RPE.
 */
export function PlanDayDetail({ title, sub, phaseName, phaseTint, focus, estado, compName, isRest, exercises, barKg, contextLine }: {
  title: string;
  sub?: string;
  phaseName: string;
  /** Color de la fase (phaseColor del índice en el perfil). */
  phaseTint: string;
  /** Objetivo de la fase — el `focus` del catálogo. */
  focus: string;
  estado?: DayEstado;
  /** Nombre de la competencia cuando el día seleccionado es el de la compe. */
  compName?: string;
  isRest?: boolean;
  exercises: DayDetailExercise[];
  barKg: number;
  /** Línea de contexto muted (p.ej. ventana del ciclo, SOLO en la vista de la atleta). */
  contextLine?: string;
}) {
  const est = estado ? ESTADO_LABEL[estado] : undefined;
  return (
    // wl-daydetail-in: entrada opacity+translateY (compositor-only, guard reduced-motion en theme.css);
    // los callers re-montan con key=semana-día para que el cambio de día también la dispare.
    <div className="wl-daydetail-in" style={{ marginTop: 10, background: "var(--wl-surface)", borderRadius: 12, padding: "12px 12px 10px", border: "1px solid color-mix(in srgb,var(--wl-text) 8%,transparent)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 13.5, color: "var(--wl-text)" }}>{title}</span>
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700, color: "#0b0b11", background: phaseTint, borderRadius: 5, padding: "2px 7px", whiteSpace: "nowrap" }}>{phaseName}</span>
      </div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)", marginTop: 5, lineHeight: 1.45 }}>
        <span style={{ color: "var(--wl-text)", fontWeight: 700 }}>Objetivo: </span>{focus}
      </div>

      {compName != null && (
        <div style={{ marginTop: 9, border: `1.5px solid ${GOLD}`, borderRadius: 9, padding: "8px 10px", color: GOLD, fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 12 }}>
          Día de competencia — {compName}
        </div>
      )}

      {compName == null && isRest && (
        <div style={{ marginTop: 9, fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--wl-muted)" }}>
          Descanso — sin sesión programada. La recuperación es la mitad del trabajo.
        </div>
      )}

      {compName == null && !isRest && (
        <>
          {(sub != null || est != null) && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 8, fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)" }}>
              <span>{sub}</span>
              {est && <span style={{ color: est.color, fontWeight: 700 }}>{est.text}</span>}
            </div>
          )}
          <div style={{ marginTop: 4 }}>
            {exercises.length === 0 && (
              <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--wl-muted)", padding: "6px 0" }}>
                Sin ejercicios prescritos para este día.
              </div>
            )}
            {exercises.map((ex, i) => (
              <div key={`${ex.name}-${i}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderTop: i === 0 ? "none" : "1px solid color-mix(in srgb,var(--wl-text) 6%,transparent)" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 12.5, color: "var(--wl-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ex.name}</div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--wl-muted)", marginTop: 1 }}>
                    {ex.sets}×{ex.reps}{ex.pct != null ? ` @ ${ex.pct}%` : ""}
                  </div>
                </div>
                <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                  <span style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 14, color: "var(--wl-text)", fontVariantNumeric: "tabular-nums" }}>
                    {ex.kg != null ? `${ex.kg} kg` : "—"}
                  </span>
                  {ex.kg != null && <DiscRow kg={ex.kg} barKg={barKg} />}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {contextLine != null && (
        <div style={{ marginTop: 8, fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--wl-muted)", lineHeight: 1.45 }}>
          {contextLine}
        </div>
      )}
    </div>
  );
}
