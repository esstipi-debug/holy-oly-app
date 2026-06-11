import { useState, type CSSProperties } from "react";
import { DiscRow } from "../../../ui/Disc";

export interface SetRow { kg?: number; reps?: number; done: boolean; }

const num: CSSProperties = { width: 64, boxSizing: "border-box", padding: "6px 7px", borderRadius: "var(--wl-radius)", textAlign: "center", border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", background: "var(--wl-bg)", color: "var(--wl-text)", fontFamily: "var(--wl-display)", fontSize: 14 };
const chip: CSSProperties = { border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", borderRadius: 999, background: "var(--wl-bg)", color: "var(--wl-text)", fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 12.5, padding: "6px 11px", cursor: "pointer" };

/** Series de trabajo: cada serie nace hecha al target (adherencia por defecto). ✎ modifica esa serie
 *  (kg/reps o "no la hice"), independiente de las demás. Discos por serie. */
export function WorkSetsSection({
  series, barKg, onPatchSet,
}: {
  series: SetRow[]; barKg: number;
  onPatchSet: (i: number, p: Partial<SetRow>) => void;
}) {
  const [openSet, setOpenSet] = useState<number | null>(null);
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontFamily: "var(--wl-display)", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--wl-muted)" }}>Series de trabajo</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
        {series.map((s, i) => {
          const open = openSet === i;
          return (
            <div key={i} style={{ background: "var(--wl-surface)", borderRadius: "var(--wl-radius)", padding: "9px 11px", opacity: s.done ? 1 : 0.55 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontFamily: "var(--wl-display)", fontSize: 12, color: "var(--wl-muted)" }}>Serie {i + 1}/{series.length}</span>
                <span style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 18, color: "var(--wl-text)" }}>{s.kg != null ? s.kg : "—"}<span style={{ fontSize: 11, color: "var(--wl-muted)", fontWeight: 600 }}> kg</span></span>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 6 }}>
                {s.kg != null ? <DiscRow kg={s.kg} barKg={barKg} /> : <span />}
                <span style={{ fontFamily: "var(--wl-display)", fontSize: 13, color: "var(--wl-muted)" }}>{s.done ? `${s.reps ?? "—"} reps` : "no la hice"}</span>
              </div>
              {!open ? (
                <button type="button" onClick={() => setOpenSet(i)} aria-label={`modificar serie ${i + 1}`} style={{ marginTop: 8, border: 0, background: "transparent", color: "var(--wl-accent)", fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13, cursor: "pointer", padding: 0 }}>✎ modificar</button>
              ) : (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <input style={num} type="number" inputMode="decimal" aria-label={`kg serie ${i + 1}`} value={s.kg ?? ""} onChange={(e) => onPatchSet(i, { kg: e.target.value ? Number(e.target.value) : undefined })} /><span style={{ color: "var(--wl-muted)", fontSize: 12 }}>kg</span>
                    <input style={num} type="number" inputMode="numeric" aria-label={`reps serie ${i + 1}`} value={s.reps ?? ""} onChange={(e) => onPatchSet(i, { reps: e.target.value === "" ? undefined : Number(e.target.value) })} /><span style={{ color: "var(--wl-muted)", fontSize: 12 }}>reps</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    <button type="button" style={chip} onClick={() => onPatchSet(i, { done: !s.done })}>{s.done ? "no la hice" : "sí la hice"}</button>
                    <button type="button" aria-label={`listo serie ${i + 1}`} style={chip} onClick={() => setOpenSet(null)}>✓ listo</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
