import { useState, type CSSProperties } from "react";
import { getMovement, type WarmupSet } from "@holy-oly/core";
import { DiscRow } from "../../../ui/Disc";
import { WarmupSection } from "./WarmupSection";
import { WorkSetsSection, type SetRow } from "./WorkSetsSection";
import { SetChips } from "./SetChips";

export interface PlayerRow {
  movementId: string; movementName: string; prescribedMovementId: string;
  sets: number; reps: number; targetKg?: number; pct?: number; notes?: string;
  warmup: WarmupSet[]; series: SetRow[];
}

const chip: CSSProperties = { border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", borderRadius: 999, background: "var(--wl-bg)", color: "var(--wl-text)", fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 12.5, padding: "6px 11px", cursor: "pointer" };
const label: CSSProperties = { fontFamily: "var(--wl-display)", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--wl-muted)" };

/**
 * Entreno activo en una sola pantalla — dirección «Pulse» del handoff sobre nuestro sistema:
 * todos los ejercicios apilados como cards (acordeón), la abierta muestra discos + calentamiento +
 * las series como CHIPS tocables (marcar de un tap) + «ajustar» para editar kg/reps (reusa el editor
 * existente, con sus discos por serie). La card abierta es el `cur` del caller, así que reusa sus
 * handlers (patchSet/sustituir/no-la-hice) sin cambiar la semántica del guardado. Discos en cada
 * ejercicio (regla intocable). Sin RPE. El back-arrow de la pantalla vuelve al resumen.
 */
export function SessionAccordion({
  rows, open, onOpen, barKg, busy, onPatchSet, onSubstitute, onMovementNotDone, onFinish,
}: {
  rows: PlayerRow[]; open: number; onOpen: (i: number) => void;
  barKg: number; busy: boolean;
  onPatchSet: (setIdx: number, p: Partial<SetRow>) => void;
  onSubstitute: () => void; onMovementNotDone: () => void;
  onFinish: () => void;
}) {
  const [adjust, setAdjust] = useState(false);
  const doneOf = (r: PlayerRow): number => r.series.filter((s) => s.done).length;

  return (
    <div>
      <div style={{ ...label, marginBottom: 8 }}>Series · tocá un chip para marcarla</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map((r, i) => {
          const isOpen = i === open;
          const nDone = doneOf(r);
          const all = r.series.length > 0 && nDone === r.series.length;
          const substituted = r.movementId !== r.prescribedMovementId;
          return (
            <div key={i} style={{ background: "var(--wl-surface)", border: `1px solid ${all ? "color-mix(in srgb,var(--wl-accent) 28%,transparent)" : "color-mix(in srgb,var(--wl-text) 8%,transparent)"}`, borderRadius: 16, overflow: "hidden" }}>
              <button type="button" onClick={() => onOpen(i)} aria-expanded={isOpen}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", background: "none", border: 0, cursor: "pointer", textAlign: "left" }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, background: all ? "color-mix(in srgb,var(--wl-accent) 16%,transparent)" : "color-mix(in srgb,var(--wl-text) 6%,transparent)", color: all ? "var(--wl-accent)" : "var(--wl-muted)" }}>
                  {all ? "✓" : `${nDone}/${r.series.length}`}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 16, color: "var(--wl-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.movementName}</div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)", marginTop: 2 }}>{r.sets}×{r.reps}{r.pct != null ? ` · ${r.pct}%` : ""}{r.targetKg != null ? ` · ${r.targetKg} kg` : ""}</div>
                </div>
                <div style={{ display: "flex", gap: 3, alignItems: "center", flexShrink: 0 }} aria-hidden>
                  {r.series.map((s, j) => (
                    <span key={j} style={{ width: 5, height: 14, borderRadius: 3, background: s.done ? "var(--wl-accent)" : "color-mix(in srgb,var(--wl-text) 14%,transparent)" }} />
                  ))}
                </div>
              </button>

              {isOpen && (
                <div style={{ padding: "2px 14px 14px" }}>
                  {substituted && <div style={{ fontFamily: "var(--wl-display)", fontSize: 11, color: "var(--wl-muted)" }}>prescripto: {getMovement(r.prescribedMovementId)?.name ?? r.prescribedMovementId}</div>}
                  {r.notes && !substituted && (
                    <div style={{ fontFamily: "var(--wl-display)", fontSize: 12.5, color: "var(--wl-text)", marginTop: 6, padding: "8px 10px", background: "var(--wl-bg)", borderRadius: "var(--wl-radius)" }}>
                      <span style={{ color: "var(--wl-accent)", fontWeight: 700 }}>Coach:</span> {r.notes}
                    </div>
                  )}
                  {/* discos del ejercicio (regla intocable: kg + discos en toda fila del atleta) */}
                  {r.targetKg != null && <div style={{ marginTop: 10 }}><DiscRow kg={r.targetKg} barKg={barKg} /></div>}
                  {!substituted && <WarmupSection sets={r.warmup} barKg={barKg} />}

                  <SetChips series={r.series} onToggle={(k) => onPatchSet(k, { done: !r.series[k]!.done })} />

                  <button type="button" onClick={() => setAdjust((a) => !a)}
                    style={{ marginTop: 10, border: 0, background: "transparent", color: "var(--wl-accent)", fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13, cursor: "pointer", padding: 0 }}>
                    ✎ ajustar kg/reps {adjust ? "▴" : "▾"}
                  </button>
                  {adjust && <WorkSetsSection series={r.series} barKg={barKg} onPatchSet={onPatchSet} />}

                  <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                    <button type="button" style={chip} onClick={onSubstitute} aria-label={`cambiar movimiento de ${r.movementName}`}>⇄ cambiar</button>
                    <button type="button" style={chip} onClick={onMovementNotDone}>no la hice (todo)</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button type="button" className="wl-btn wl-btn--primary" disabled={busy} onClick={onFinish} aria-label="guardar entreno"
        style={{ width: "100%", marginTop: 14, opacity: busy ? 0.6 : 1 }}>{busy ? "Guardando…" : "Terminar · guardar entreno"}</button>
    </div>
  );
}
