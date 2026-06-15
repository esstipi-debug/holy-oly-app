import { useEffect, useState } from "react";
import { getMovement, type WarmupSet } from "@holy-oly/core";
import { ExerciseHero } from "./ExerciseHero";
import { WarmupSection } from "./WarmupSection";
import { WorkSetsSection, type SetRow } from "./WorkSetsSection";
import { FinishButton } from "./FinishButton";
import "./entreno.css";

export interface PlayerRow {
  movementId: string; movementName: string; prescribedMovementId: string;
  sets: number; reps: number; targetKg?: number; pct?: number; notes?: string;
  warmup: WarmupSet[]; series: SetRow[];
}

const isComplete = (r: PlayerRow): boolean => r.series.length > 0 && r.series.every((s) => s.done);

/**
 * Entreno activo (rediseño 0110) — acordeón guiado: cada ejercicio es una card; la abierta muestra el
 * HERO líquido (nombre + kg + intensidad %1RM + discos), la nota del coach, el CALENTAMIENTO bloqueante
 * (las series de trabajo quedan tras un candado hasta calentar) y las series como filas tocables con
 * discos que se ocultan al completarse. Glow "spotlight" en la próxima acción + AUTO-AVANCE al
 * siguiente movimiento. Botón Terminar glitch. Reusa los handlers del caller (patchSet/sustituir/
 * no-la-hice) → misma semántica de guardado. Discos SIEMPRE vía Disc.tsx (intocable). Sin RPE.
 */
function ExerciseCard({
  r, idx, isOpen, onOpen, barKg, onPatchSet, onSubstitute, onMovementNotDone,
}: {
  r: PlayerRow; idx: number; isOpen: boolean; onOpen: (i: number) => void; barKg: number;
  onPatchSet: (setIdx: number, p: Partial<SetRow>) => void;
  onSubstitute: () => void; onMovementNotDone: () => void;
}) {
  const nDone = r.series.filter((s) => s.done).length;
  const all = isComplete(r);
  const substituted = r.movementId !== r.prescribedMovementId;
  // El calentamiento es del movimiento prescripto; sustituido → sin gate (las pcts no aplican).
  const hasWarmup = !substituted && r.warmup.length > 0;
  const [warmSet, setWarmSet] = useState<Set<number>>(() => new Set());
  const [skipWarm, setSkipWarm] = useState(false);
  const warmupAllDone = hasWarmup && warmSet.size === r.warmup.length;
  const workOpen = !hasWarmup || warmupAllDone || skipWarm;
  const toggleWarm = (i: number): void =>
    setWarmSet((prev) => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });

  return (
    <div className={"et-ex" + (isOpen ? " is-open" : "") + (all ? " is-complete" : "")}>
      {!isOpen && (
        <button type="button" className="et-ex__head" onClick={() => onOpen(idx)} aria-expanded={isOpen}>
          <span className={"et-ex__badge" + (all ? " is-all" : "")} aria-hidden>{all ? "✓" : `${nDone}/${r.series.length}`}</span>
          <span className="et-ex__titles">
            <span className="et-ex__name">{r.movementName}</span>
            <span className="et-ex__meta">{r.sets}×{r.reps}{r.pct != null ? ` · ${r.pct}%` : ""}{r.targetKg != null ? ` · ${r.targetKg} kg` : ""}</span>
          </span>
          <span className="et-ex__segs" aria-hidden>
            {r.series.map((s, j) => <span key={j} className={"et-ex__seg" + (s.done ? " is-on" : "")} />)}
          </span>
        </button>
      )}

      {isOpen && (
        <div className="et-ex__body">
          <ExerciseHero
            movementName={r.movementName} targetKg={r.targetKg} pct={r.pct}
            sets={r.sets} reps={r.reps} barKg={barKg} nDone={nDone} total={r.series.length}
            onCollapse={() => onOpen(-1)}
          />

          {substituted && <div className="et-ex__prescr">prescripto: {getMovement(r.prescribedMovementId)?.name ?? r.prescribedMovementId}</div>}
          {r.notes && !substituted && <div className="et-coach"><span className="et-coach__tag">Coach</span>{r.notes}</div>}

          {hasWarmup && <WarmupSection sets={r.warmup} barKg={barKg} doneSet={warmSet} onToggle={toggleWarm} />}

          {workOpen ? (
            <WorkSetsSection series={r.series} barKg={barKg} onPatchSet={onPatchSet} />
          ) : (
            <div className="et-locked">
              <div className="et-locked__row">
                <span className="et-locked__ic" aria-hidden>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="4.5" y="11" width="15" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
                </span>
                <div className="et-locked__txt">
                  <div className="et-locked__t">Series de trabajo</div>
                  <div className="et-locked__s">Calentá primero — prepará el cuerpo para el peso fuerte.</div>
                </div>
                <span className="et-locked__count">{warmSet.size}/{r.warmup.length}</span>
              </div>
              <button type="button" className="et-locked__skip" onClick={() => setSkipWarm(true)}>saltar calentamiento</button>
            </div>
          )}

          <div className="et-ex__actions">
            <button type="button" className="et-action" onClick={onSubstitute} aria-label={`cambiar movimiento de ${r.movementName}`}>⇄ cambiar</button>
            <button type="button" className="et-action" onClick={onMovementNotDone}>no la hice (todo)</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function SessionAccordion({
  rows, open, onOpen, barKg, busy, onPatchSet, onSubstitute, onMovementNotDone, onFinish,
}: {
  rows: PlayerRow[]; open: number; onOpen: (i: number) => void; barKg: number; busy: boolean;
  onPatchSet: (setIdx: number, p: Partial<SetRow>) => void;
  onSubstitute: () => void; onMovementNotDone: () => void; onFinish: () => void;
}) {
  const exDone = rows.filter(isComplete).length;
  const totalDone = rows.reduce((a, r) => a + r.series.filter((s) => s.done).length, 0);
  const totalSets = rows.reduce((a, r) => a + r.series.length, 0);
  const nextIdx = rows.findIndex((r) => !isComplete(r)); // -1 = todos hechos → glow al CTA

  // Auto-avance: al completar el ejercicio abierto, abrir el siguiente incompleto (en su calentamiento).
  const openRow = rows[open];
  const openComplete = !!openRow && isComplete(openRow);
  useEffect(() => {
    if (!openComplete || nextIdx === -1 || nextIdx === open) return;
    const t = setTimeout(() => onOpen(nextIdx), 480);
    return () => clearTimeout(t);
  }, [openComplete, nextIdx, open, onOpen]);

  return (
    <div>
      <div className="et-sublead">Tocá una serie para marcarla · ajustá con ✎</div>
      <div className="et-ex-list">
        {rows.map((r, i) => (
          <ExerciseCard
            key={i} r={r} idx={i} isOpen={i === open} onOpen={onOpen} barKg={barKg}
            onPatchSet={onPatchSet} onSubstitute={onSubstitute} onMovementNotDone={onMovementNotDone}
          />
        ))}
      </div>
      <FinishButton onFinish={onFinish} busy={busy} glowing={nextIdx === -1} />
      <div className="et-finish__meta">{exDone}/{rows.length} ejercicios · {totalDone}/{totalSets} series hechas</div>
    </div>
  );
}
