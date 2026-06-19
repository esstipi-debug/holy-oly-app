import type {
  MacroRecipe, Macrocycle, PrescribedExercise, PrescriptionRow, RM, SessionTemplate, SessionView,
} from "../types";
import { phaseForWeek } from "../data/macrocycles";
import { getMovement } from "./movements";
import { getComplex, complexWeakRmKg, isComplexId } from "./complexes";
import { warmupForExercise } from "./warmup";
import { recipeFor } from "../data/recipesAll";
import type { PlanWeek } from "./adaptivePlan";

/** Target kg of a prescribed exercise: explicit override wins; else %1RM × the movement's reference RM
 *  (rounded to 1 kg). Complejos ("cx.*"): %×RM del eslabón MÁS DÉBIL (D6 — una barra, el techo lo
 *  pone el eslabón que falla primero). Explicit override → kgOverride; sin pct / id desconocido →
 *  undefined (sin-dato honesto). */
export function resolveTargetKg(ex: PrescribedExercise, rms: RM): number | undefined {
  if (ex.kgOverride != null) return ex.kgOverride;
  if (ex.pct == null) return undefined;
  if (isComplexId(ex.movementId)) {
    const cx = getComplex(ex.movementId);
    const weak = cx ? complexWeakRmKg(cx, rms) : undefined;
    return weak == null ? undefined : Math.round((ex.pct / 100) * weak);
  }
  const mv = getMovement(ex.movementId);
  if (!mv || mv.rmRef === "none") return undefined;
  return Math.round((ex.pct / 100) * rms[mv.rmRef]);
}

/** Display name de un id programable: variante de la librería o complejo (con su notación). */
export function programmableName(id: string): string {
  if (isComplexId(id)) return getComplex(id)?.name ?? id;
  return getMovement(id)?.name ?? id;
}

/** The session templates for a given week = the recipe's templates for that week's phase ([] if none). */
export function sessionTemplateFor(recipe: MacroRecipe | undefined, macro: Macrocycle, week: number): SessionTemplate[] {
  if (!recipe) return [];
  const phase = phaseForWeek(macro, week);
  if (!phase) return [];
  return recipe.phases.find((p) => p.phaseKey === phase.key)?.sessions ?? [];
}

/** Instantiate the whole prescription: every week → its phase's session templates → flat rows.
 *  `readonly`: sólo lee — ALL_RECIPES (congelado) entra directo, sin spreads defensivos.
 *  Con `plan` (periodización adaptativa): cada semana usa la fase que el plan le asigna (su `phaseKey`)
 *  en vez del `phaseProfile` fijo — así la prescripción real refleja la compresión/expansión hacia la
 *  compe. Sin `plan`: comportamiento clásico (fase por `phaseForWeek`, semanas 1..totalWeeks). */
export function instantiatePrescription(
  recipes: readonly MacroRecipe[],
  macro: Macrocycle,
  totalWeeks: number,
  plan?: readonly PlanWeek[],
): PrescriptionRow[] {
  const recipe = recipes.find((r) => r.macroId === macro.id);
  if (!recipe) return [];
  const weeks: readonly PlanWeek[] = plan && plan.length > 0
    ? plan
    : Array.from({ length: totalWeeks }, (_, i) => ({ week: i + 1, phaseKey: phaseForWeek(macro, i + 1)?.key ?? "" }));
  const rows: PrescriptionRow[] = [];
  for (const { week, phaseKey } of weeks) {
    const sessions = recipe.phases.find((p) => p.phaseKey === phaseKey)?.sessions ?? [];
    sessions.forEach((session, sessionIdx) => {
      session.exercises.forEach((ex, order) => rows.push({ ...ex, week, sessionIdx, order }));
    });
  }
  return rows;
}

/** Layout de días de una semana: (day, turno) por sessionIdx, derivado de la RECETA (D8 — no
 *  se persiste; los dobles son ADN de escuela, no edición por atleta). Receta mono-diaria →
 *  day = idx+1. Semana fuera del rango del macro o sin templates → null (sin-dato honesto;
 *  el caller decide el fallback legacy). A diferencia de phaseForWeek, NO hay fallback a la
 *  última fase — week 999 es semana inválida, no peaking. */
export function dayLayoutFor(macro: Macrocycle, week: number, phaseKey?: string): { day: number; turno?: "AM" | "PM" }[] | null {
  const recipe = recipeFor(macro.id);
  if (!recipe) return null;
  // La fase la manda el plan ADAPTATIVO (`phaseKey`) cuando se provee; si no, lookup estricto por el
  // phaseProfile natural (compat). Sin el override, una semana comprimida/estirada resolvería la fase
  // equivocada (o null fuera del rango natural) → layout de días AM/PM desalineado con la prescripción.
  const key = phaseKey ?? macro.phaseProfile.find((p) => week >= p.weeks[0] && week <= p.weeks[1])?.key;
  if (key == null) return null;
  const sessions = recipe.phases.find((p) => p.phaseKey === key)?.sessions ?? [];
  if (sessions.length === 0) return null;
  return sessions.map((s, i) => ({ day: s.day ?? i + 1, ...(s.turno ? { turno: s.turno } : {}) }));
}

/** Group a set of prescription rows (typically one week) into per-session views with name + derived kg
 *  + the calentamiento (rampa) of each exercise. `barKg` = barra del atleta (20 ♂ / 15 ♀). */
export function buildSessionViews(rows: PrescriptionRow[], rms: RM, barKg = 20): SessionView[] {
  const byIdx = new Map<number, PrescriptionRow[]>();
  for (const r of rows) {
    if (!byIdx.has(r.sessionIdx)) byIdx.set(r.sessionIdx, []);
    byIdx.get(r.sessionIdx)!.push(r);
  }
  const views: SessionView[] = [];
  for (const [sessionIdx, sRows] of [...byIdx.entries()].sort((a, b) => a[0] - b[0])) {
    const ordered = [...sRows].sort((a, b) => a.order - b.order);
    views.push({
      week: ordered[0]!.week,
      sessionIdx,
      exercises: ordered.map((r, i) => ({
        movementId: r.movementId, sets: r.sets, reps: r.reps, pct: r.pct, kgOverride: r.kgOverride,
        flags: r.flags,
        // HR-2 para complejos: la rampa se ejecuta con el PRIMER eslabón, no el complejo entero
        // — sin la nota, "5 reps de rampa" se lee como 5 vueltas del complejo (El Carnicero).
        notes: r.notes ?? (isComplexId(r.movementId)
          ? `Calentamiento: rampa con ${getMovement(getComplex(r.movementId)?.links[0]?.movementId ?? "")?.name ?? "el primer movimiento"}`
          : undefined),
        movementName: programmableName(r.movementId),
        targetKg: resolveTargetKg(r, rms),
        warmup: warmupForExercise({ movementId: r.movementId, pct: r.pct, order: i }, rms, barKg),
      })),
    });
  }
  return views;
}
