import type { AdherenceStatus, PlannedSession, ReconciledSession, SessionActual, SessionMark } from "../types";

/** Deriva el estado de UNA sesión a partir de los actuals del atleta de esa sesión.
 *  `null` cuando el atleta no registró nada (→ el caller cae al mark del coach). */
function fromActuals(rows: SessionActual[]): AdherenceStatus | null {
  if (rows.length === 0) return null;
  const doneCount = rows.filter((r) => r.done).length;
  if (doneCount === rows.length) return "done";
  if (doneCount === 0) return "skipped";
  return "partial";
}

/** Mapea el toggle manual del coach (SessionMark) al estado reconciliado. */
function fromMark(status: SessionMark["status"]): AdherenceStatus {
  return status === "done" ? "done" : "skipped";
}

/**
 * Reconcilia, por sesión planificada, el estado de adherencia priorizando la VERDAD del atleta:
 *
 *   1. Actuals reales de la atleta (si registró la sesión) → done/partial/skipped, source "athlete".
 *   2. Si no hay actuals, el mark manual del coach (SessionMark) → done/skipped, source "coach".
 *   3. Si no hay nada → none, source "none" (jamás inventar).
 *
 * Función pura: no lee fechas ni globals; el caller le pasa las 3 colecciones ya cargadas.
 * Mantiene el orden y la cardinalidad de `sessions` (mapeo 1:1).
 */
export function reconcileAdherence(
  sessions: ReadonlyArray<PlannedSession>,
  actuals: ReadonlyArray<SessionActual>,
  marks: ReadonlyArray<SessionMark>,
): ReconciledSession[] {
  return sessions.map(({ week, idx }) => {
    const sessionActuals = actuals.filter((a) => a.week === week && a.sessionIdx === idx);
    const athleteStatus = fromActuals(sessionActuals);
    if (athleteStatus != null) {
      return { week, idx, status: athleteStatus, source: "athlete" };
    }
    const mark = marks.find((m) => m.week === week && m.idx === idx);
    if (mark) {
      return { week, idx, status: fromMark(mark.status), source: "coach" };
    }
    return { week, idx, status: "none", source: "none" };
  });
}
