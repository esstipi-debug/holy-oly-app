import { useEffect, useState, type CSSProperties } from "react";
import { getMovement, type WarmupSet } from "@holy-oly/core";
import { WarmupSection } from "./WarmupSection";
import { WorkSetsSection, type SetRow } from "./WorkSetsSection";

export interface PlayerRow {
  movementId: string; movementName: string; prescribedMovementId: string;
  sets: number; reps: number; targetKg?: number; pct?: number; notes?: string;
  warmup: WarmupSet[]; series: SetRow[];
}

const chip: CSSProperties = { border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", borderRadius: 999, background: "var(--wl-bg)", color: "var(--wl-text)", fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 12.5, padding: "6px 11px", cursor: "pointer" };

function mmss(s: number): string {
  const m = Math.floor(s / 60); const r = s % 60;
  return `${m}:${r < 10 ? "0" : ""}${r}`;
}

/** Reproductor de un movimiento: header (nombre · esquema · % · X/Y) + crono + cue del coach +
 *  calentamiento (oculto si está sustituido) + series de trabajo + navegación. */
export function SessionPlayer({
  row, index, total, barKg, busy,
  onPatchSet, onSubstitute, onMovementNotDone, onPrev, onNext, onFinish,
}: {
  row: PlayerRow; index: number; total: number; barKg: number; busy: boolean;
  onPatchSet: (i: number, p: Partial<SetRow>) => void;
  onSubstitute: () => void; onMovementNotDone: () => void;
  onPrev: () => void; onNext: () => void; onFinish: () => void;
}) {
  const [secs, setSecs] = useState(0);
  useEffect(() => { const id = setInterval(() => setSecs((s) => s + 1), 1000); return () => clearInterval(id); }, []);

  const isFirst = index === 0;
  const isLast = index === total - 1;
  const substituted = row.movementId !== row.prescribedMovementId;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontFamily: "var(--ho-mono)", fontSize: 11, color: "var(--wl-muted)" }}>Movimiento {index + 1}/{total}</span>
        <span style={{ fontFamily: "var(--ho-mono)", fontSize: 12, color: "var(--wl-muted)" }}>{mmss(secs)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginTop: 4 }}>
        <span style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 20, color: "var(--wl-text)" }}>{row.movementName}</span>
        <span style={{ fontFamily: "var(--wl-display)", fontSize: 13, color: "var(--wl-muted)", whiteSpace: "nowrap" }}>{row.sets} series × {row.reps} reps{row.pct != null ? ` · ${row.pct}%` : ""}</span>
      </div>
      {substituted && (
        <div style={{ fontFamily: "var(--wl-display)", fontSize: 11, color: "var(--wl-muted)", marginTop: 4 }}>prescripto: {getMovement(row.prescribedMovementId)?.name ?? row.prescribedMovementId}</div>
      )}
      {row.notes && !substituted && (
        <div style={{ fontFamily: "var(--wl-display)", fontSize: 12.5, color: "var(--wl-text)", marginTop: 8, padding: "8px 10px", background: "var(--wl-surface)", borderRadius: 10 }}>
          <span style={{ color: "var(--wl-accent)", fontWeight: 700 }}>Coach:</span> {row.notes}
        </div>
      )}

      {!substituted && <WarmupSection sets={row.warmup} barKg={barKg} />}
      <WorkSetsSection series={row.series} barKg={barKg} onPatchSet={onPatchSet} />

      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <button type="button" style={chip} onClick={onSubstitute} aria-label={`cambiar movimiento de ${row.movementName}`}>⇄ cambiar</button>
        <button type="button" style={chip} onClick={onMovementNotDone}>no la hice (todo)</button>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button type="button" className="wl-btn" disabled={isFirst} onClick={onPrev} aria-label="movimiento anterior" style={{ flex: "0 0 auto", opacity: isFirst ? 0.4 : 1 }}>‹ Ant</button>
        {isLast ? (
          <button type="button" className="wl-btn wl-btn--primary" disabled={busy} onClick={onFinish} aria-label="guardar entreno" style={{ flex: 1, opacity: busy ? 0.6 : 1 }}>{busy ? "Guardando…" : "Fin · Guardar entreno"}</button>
        ) : (
          <button type="button" className="wl-btn wl-btn--primary" onClick={onNext} aria-label="siguiente movimiento" style={{ flex: 1 }}>Siguiente movimiento ›</button>
        )}
      </div>
    </div>
  );
}
