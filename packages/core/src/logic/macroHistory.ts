/**
 * Historial de macrociclos (slice macro-history 2026-06-14). Puro y determinista.
 *
 * `Plan` es 1:1 con el atleta (un ciclo EN CURSO). Este historial guarda los ciclos CERRADOS —
 * cada uno con su macro, sus fechas y su adherencia (sesiones hechas / prescritas). La adherencia %
 * se DERIVA acá, jamás se almacena (sin-dato honesto: total 0 → 0%, nunca dividir por cero).
 *
 * Coach-visible y atleta-visible: es la constancia del propio atleta. NO es una señal de estado
 * (jamás entra al semáforo / readiness) y NO carga RM/RPE como métrica de juicio.
 */
import type { MacroHistoryEntry, MacroHistoryRow, MacroHistoryView, Macrocycle, Plan, RM } from "../types";
import { MACROCYCLES } from "../data/macrocycles";
import { sessionsPerWeekFor } from "./recipeGen";
import { RM_LIFTS } from "./rm";

/** Adherencia entera: sesiones hechas sobre prescritas. Total 0 → 0 (nunca NaN/Infinity). */
export function adherencePct(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((done / total) * 100);
}

/** Nombre del macro del catálogo; sin match cae al id (jamás inventa un nombre). */
export function macroName(macroId: string): string {
  return MACROCYCLES.find((m) => m.id === macroId)?.name ?? macroId;
}

function toEntry(r: MacroHistoryRow): MacroHistoryEntry {
  return { ...r, macroName: macroName(r.macroId), adherencePct: adherencePct(r.sessionsDone, r.sessionsTotal) };
}

/** Vista para la UI: ciclos cerrados más reciente primero (ordinal desc) + agregados derivados. */
export function macroHistoryView(rows: readonly MacroHistoryRow[]): MacroHistoryView {
  const entries = rows.map(toEntry).sort((a, b) => b.ordinal - a.ordinal);
  const cyclesDone = entries.length;
  const avgAdherencePct =
    cyclesDone === 0 ? 0 : Math.round(entries.reduce((s, e) => s + e.adherencePct, 0) / cyclesDone);
  return { entries, cyclesDone, avgAdherencePct };
}

const DAY_MS = 86_400_000;
function addDaysIso(iso: string, days: number): string {
  return new Date(new Date(`${iso}T00:00:00Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}
function totalWeeksOf(macro: Macrocycle): number {
  return macro.phaseProfile[macro.phaseProfile.length - 1]?.weeks[1] ?? 12;
}

/** Un ciclo a cerrar: qué macro y con qué adherencia se entrenó (rmEnd opcional al cerrar). */
export interface MacroHistoryCycleSpec { macroId: string; adherencePct: number; rmEnd?: RM }

/**
 * Genera filas de ciclos cerrados, encadenadas hacia atrás desde `endBefore`. `cycles` va de más
 * antiguo a más nuevo → ordinal 1..N (1 = el más viejo). El ciclo más nuevo termina en `endBefore`;
 * cada anterior termina `gapDays` antes del inicio del siguiente (descanso entre ciclos). Las
 * sesiones se derivan del macro: total = semanas × días/semana; hechas = round(total × pct/100).
 * Puro y determinista — compartido por el seed del API y el del demo offline (sin drift).
 */
export function buildMacroHistoryRows(
  cycles: readonly MacroHistoryCycleSpec[],
  endBefore: string,
  gapDays = 7,
): MacroHistoryRow[] {
  const rows: MacroHistoryRow[] = [];
  let cursorEnd = endBefore;
  // Recorre de más nuevo a más viejo para encadenar las fechas; asigna ordinal por posición original.
  for (let i = cycles.length - 1; i >= 0; i--) {
    const spec = cycles[i]!;
    const macro = MACROCYCLES.find((m) => m.id === spec.macroId);
    const weeks = macro ? totalWeeksOf(macro) : 12;
    const dpw = macro ? sessionsPerWeekFor(macro) : 5;
    const sessionsTotal = weeks * dpw;
    const sessionsDone = Math.round((sessionsTotal * spec.adherencePct) / 100);
    const endDate = cursorEnd;
    const startDate = addDaysIso(endDate, -(weeks * 7 - 1));
    rows.push({ macroId: spec.macroId, ordinal: i + 1, startDate, endDate, weeks, sessionsDone, sessionsTotal, rmEnd: spec.rmEnd });
    cursorEnd = addDaysIso(startDate, -gapDays);
  }
  return rows.sort((a, b) => a.ordinal - b.ordinal);
}

/** ¿El atleta necesita que el coach le cargue RM? Sin plan, o con algún lift faltante/≤0/NaN → sí.
 *  Sin RM el motor no puede derivar kg ni prescribir (no se puede avanzar). `!(rms[l] > 0)` cubre
 *  faltante (undefined), ≤0 y NaN sin afirmaciones de tipo. */
export function planNeedsRm(plan: Plan | null | undefined): boolean {
  if (!plan) return true;
  const { rms } = plan;
  return RM_LIFTS.some((l) => !(rms[l] > 0));
}

/** Baja un RM `steps` pasos de `step` kg (la sentadilla baja 1.5×, es más absoluta). Construye la
 *  curva de fuerza entre ciclos. Compartido por el seed del API y el del demo offline (sin drift). */
export function stepDownRm(top: RM, steps: number, step: number): RM {
  return {
    arranque: top.arranque - steps * step,
    envion: top.envion - steps * step,
    sentadilla: top.sentadilla - steps * Math.round(step * 1.5),
    frente: top.frente - steps * step,
  };
}
