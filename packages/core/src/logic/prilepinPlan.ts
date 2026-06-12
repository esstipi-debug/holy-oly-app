/**
 * Mapper PURO: datos reales del atleta → `EngineInput` → `EngineWeek` del motor Prilepin.
 * Es el cableado que vuelve VIVO el motor dormant (`prilepin.ts`) como PREVIEW coach-only:
 * read-only, no persiste, no reemplaza el plan basado en recetas.
 *
 * Spec del motor: `docs/superpowers/specs/2026-06-10-motor-prilepin-design.md` (D1–D14).
 * Cumple las obligaciones de cableado de §9: el countdown se deriva de la fecha de la compe
 * (anclada al calendario, vía la semana-macro de `Competencia`), NUNCA se re-deriva por
 * "distancia" cruda; la posición es estado explícito (`weekIdx`/`waveWeek`); el RM jamás se
 * estima (sin RM suficiente → null honesto, nunca un week fabricado).
 *
 * Mapeo (supuestos documentados — preview funcional, no fidelidad perfecta día uno):
 *  · countdownWeeks = semana-macro de la PRÓXIMA compe (la primera en/después de la semana
 *    pedida). El motor fija el countdown AL ANCLAR con la compe como ÚLTIMA semana (D13); acá
 *    la "semana del countdown fijado" = la semana-macro tal cual (la compe cae en su semana del
 *    catálogo, que el coach ancló por fecha vía `anchorPlanToComp` → `Competencia.week`). Así la
 *    secuencia vivida es `phasePlan(compWeek)[requestedWeek-1]` por construcción, y las semanas
 *    de acumulación tempranas del macro mapean a las primeras del countdown. Decisión: tomamos
 *    la PRÓXIMA compe (no la más lejana) porque el peak lo ordena la competencia inminente.
 *  · weekIdx = requestedWeek − 1 (0-based dentro del countdown).
 *  · Sin compe futura (ninguna en/después de la semana pedida) → modo ola: waveWeek =
 *    requestedWeek (la semana-macro 1-based mapea directo a la posición de la ola de 6 semanas).
 *  · recentACWR / readiness = la ÚLTIMA semana de la serie de monitoreo (la señal más reciente);
 *    sin serie → null (sin ajuste, jamás inventar — D7).
 */
import type { Competencia, EngineInput, EngineWeek, MonitorSeries, RM, RmLift } from "../types";
import { acwr, recoverySeries } from "./monitor";
import { readiness, readinessBand } from "./readiness";
import { generateWeek } from "./prilepin";

export interface PrilepinPreviewArgs {
  /** Lift del RM de la casa a previsualizar. */
  lift: RmLift;
  /** RMs vigentes del plan (el kg se toma de `rms[lift]`; jamás se estima). */
  rms: RM;
  /** Semana del macro a previsualizar (1-based). */
  requestedWeek: number;
  /** Largo total del macro (semanas) — acota la semana pedida. */
  totalWeeks: number;
  /** Competencias del atleta (con `week` derivado de su fecha contra el startDate del plan). */
  comps: readonly Competencia[];
  /** Serie de monitoreo para ACWR + readiness reciente; undefined = sin dato. */
  series: MonitorSeries | undefined;
}

/** ACWR de la última semana de la serie, o null (sin serie / ratio no-finito). */
function recentACWR(series: MonitorSeries | undefined): number | null {
  if (!series || series.weeks <= 0 || series.acute.length === 0) return null;
  const v = acwr(series.acute)[series.acute.length - 1];
  return v != null && Number.isFinite(v) ? v : null;
}

/** Banda de readiness de la última semana (recuperación penalizada por ACWR), o null sin dato. */
function recentReadinessBand(series: MonitorSeries | undefined): ReturnType<typeof readinessBand> {
  if (!series || series.weeks <= 0) return null;
  const i = series.weeks - 1;
  const rec = recoverySeries(series)[i];
  const a = acwr(series.acute)[i];
  return readinessBand(readiness(rec, a));
}

/**
 * `EngineInput` desde los datos reales del atleta, o null si no hay prescripción honesta posible
 * (sin RM del lift, o semana fuera de rango). La validación profunda del input (countdown/ola
 * degenerados) la hace `generateWeek`; acá sólo se construye sin inventar.
 */
export function buildPrilepinInput(args: PrilepinPreviewArgs): EngineInput | null {
  const { lift, rms, requestedWeek, totalWeeks, comps, series } = args;
  const rmKg = rms[lift];
  if (!Number.isFinite(rmKg) || rmKg <= 0) return null; // sin RM vigente → none (jamás estimar)
  if (!Number.isInteger(requestedWeek) || requestedWeek < 1 || requestedWeek > totalWeeks) return null;

  const acwrV = recentACWR(series);
  const readinessV = recentReadinessBand(series);

  // Próxima compe = la de menor semana en/después de la semana pedida (la que ordena el peak).
  const upcoming = comps
    .filter((c) => Number.isInteger(c.week) && c.week >= requestedWeek)
    .reduce<Competencia | null>((best, c) => (best === null || c.week < best.week ? c : best), null);

  if (upcoming) {
    return {
      countdownWeeks: upcoming.week, // la compe = última semana del countdown (D13)
      weekIdx: requestedWeek - 1,
      lift, rmKg, recentACWR: acwrV, readiness: readinessV,
    };
  }
  // Sin compe futura → ola continua de 6 semanas; la posición es la semana-macro 1-based.
  return {
    countdownWeeks: null,
    waveWeek: requestedWeek,
    lift, rmKg, recentACWR: acwrV, readiness: readinessV,
  };
}

/**
 * El `EngineWeek` del preview, o null ("sin datos" honesto). Cara COACH: el caller devuelve el
 * week crudo (pct/zonas/audits) — esto NO es superficie de atleta (HR-1, D12).
 */
export function prilepinPreviewWeek(args: PrilepinPreviewArgs): EngineWeek | null {
  const input = buildPrilepinInput(args);
  return input === null ? null : generateWeek(input);
}
