import type {
  MacroRecipe, Macrocycle, PrescribedExercise, PrescriptionRow, RM, SessionTemplate, SessionView,
} from "../types";
import { phaseForWeek } from "../data/macrocycles";
import { getMovement } from "./movements";

/** Target kg of a prescribed exercise: explicit override wins; else %1RM × the movement's reference RM
 *  (rounded to 1 kg). Accessories (rmRef "none") have no derivation → undefined (use kgOverride/rpe). */
export function resolveTargetKg(ex: PrescribedExercise, rms: RM): number | undefined {
  if (ex.kgOverride != null) return ex.kgOverride;
  const mv = getMovement(ex.movementId);
  if (!mv || mv.rmRef === "none" || ex.pct == null) return undefined;
  return Math.round((ex.pct / 100) * rms[mv.rmRef]);
}

/** The session templates for a given week = the recipe's templates for that week's phase ([] if none). */
export function sessionTemplateFor(recipe: MacroRecipe | undefined, macro: Macrocycle, week: number): SessionTemplate[] {
  if (!recipe) return [];
  const phase = phaseForWeek(macro, week);
  if (!phase) return [];
  return recipe.phases.find((p) => p.phaseKey === phase.key)?.sessions ?? [];
}

/** Instantiate the whole prescription: every week → its phase's session templates → flat rows. */
export function instantiatePrescription(recipes: MacroRecipe[], macro: Macrocycle, totalWeeks: number): PrescriptionRow[] {
  const recipe = recipes.find((r) => r.macroId === macro.id);
  if (!recipe) return [];
  const rows: PrescriptionRow[] = [];
  for (let week = 1; week <= totalWeeks; week++) {
    const sessions = sessionTemplateFor(recipe, macro, week);
    sessions.forEach((session, sessionIdx) => {
      session.exercises.forEach((ex, order) => rows.push({ ...ex, week, sessionIdx, order }));
    });
  }
  return rows;
}

/** Group a set of prescription rows (typically one week) into per-session views with name + derived kg. */
export function buildSessionViews(rows: PrescriptionRow[], rms: RM): SessionView[] {
  const byIdx = new Map<number, PrescriptionRow[]>();
  for (const r of rows) (byIdx.get(r.sessionIdx) ?? byIdx.set(r.sessionIdx, []).get(r.sessionIdx)!).push(r);
  const views: SessionView[] = [];
  for (const [sessionIdx, sRows] of [...byIdx.entries()].sort((a, b) => a[0] - b[0])) {
    const ordered = [...sRows].sort((a, b) => a.order - b.order);
    views.push({
      week: ordered[0]!.week,
      sessionIdx,
      exercises: ordered.map((r) => ({
        movementId: r.movementId, sets: r.sets, reps: r.reps, pct: r.pct, kgOverride: r.kgOverride,
        rpe: r.rpe, flags: r.flags, notes: r.notes,
        movementName: getMovement(r.movementId)?.name ?? r.movementId,
        targetKg: resolveTargetKg(r, rms),
      })),
    });
  }
  return views;
}
