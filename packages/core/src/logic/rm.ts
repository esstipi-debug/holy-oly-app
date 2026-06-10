/**
 * SP5 — autorregulación del RM. Puro y determinista (el caller pasa "today").
 * PR = set HECHO cuyo kg SUPERA (estricto) el RM vigente del lift del movimiento (rmRef):
 * estricto para que confirmar el PR (subir el RM a ese kg) lo auto-resuelva — igualar el
 * RM no es un récord. La variante cuenta contra su lift base; el coach juzga y entra el
 * valor final (acá no se auto-calcula 1RM por reps, jamás).
 */
import type { PrCandidate, RM, RmLift, RmUpdate, RmVigencia, SessionActual } from "../types";
import { getMovement } from "./movements";

/** Orden canónico de lifts (= orden de la planilla del coach). */
export const RM_LIFTS: readonly RmLift[] = ["arranque", "envion", "sentadilla", "frente"];

const DAY = 86_400_000;
const ms = (iso: string): number => new Date(`${iso}T00:00:00Z`).getTime();

/** Por lift, el candidato de mayor kg (empate → el más reciente). ≤4, orden RM_LIFTS. */
export function prCandidates(actuals: SessionActual[], rms: RM): PrCandidate[] {
  const best = new Map<RmLift, PrCandidate>();
  for (const a of actuals) {
    if (!a.done || a.actualKg == null) continue;
    const mv = getMovement(a.movementId);
    if (!mv || mv.rmRef === "none") continue;
    const lift = mv.rmRef;
    if (a.actualKg <= rms[lift]) continue;
    const cur = best.get(lift);
    if (!cur || a.actualKg > cur.kg || (a.actualKg === cur.kg && a.week > cur.week)) {
      best.set(lift, { lift, movementId: mv.id, movementName: mv.name, kg: a.actualKg, week: a.week, sessionIdx: a.sessionIdx, doneAt: a.doneAt });
    }
  }
  return RM_LIFTS.flatMap((l) => { const c = best.get(l); return c ? [c] : []; });
}

/** Por lift: el `setAt` de la última RmUpdate; sin historial cae a `fallbackDate`
 *  (= plan.startDate, "fijado al asignar"); sin nada → {}. weeksAgo = floor(días/7), ≥0. */
export function rmVigencia(history: RmUpdate[], fallbackDate: string | undefined, today: string): RmVigencia {
  const out = {} as RmVigencia;
  for (const lift of RM_LIFTS) {
    let last: string | undefined;
    for (const h of history) if (h.lift === lift && (last == null || h.setAt > last)) last = h.setAt;
    const setAt = last ?? fallbackDate;
    out[lift] = setAt == null ? {} : { setAt, weeksAgo: Math.max(0, Math.floor((ms(today) - ms(setAt)) / DAY / 7)) };
  }
  return out;
}
