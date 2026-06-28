import type { MePlanView, Plan } from "../types";
import { MACROCYCLES, phaseForWeek } from "../data/macrocycles";
import { weekOfDate } from "./schedule";

/** Build the athlete-facing plan view: current week (anchored to the plan's startDate, falling
 *  back to startWeek), current phase, the phase ribbon, and the upcoming competitions. Pure: the
 *  caller passes the server's `today`. Returns `plan: null` when there is no plan or no macro. */
export function buildMePlanView(
  athlete: { nombre: string; iniciales: string; sexo: "M" | "F" },
  plan: Plan | undefined,
  today: string,
): MePlanView {
  if (!plan) return { athlete, plan: null };
  const macro = MACROCYCLES.find((m) => m.id === plan.macroId);
  if (!macro) return { athlete, plan: null };
  const last = macro.phaseProfile[macro.phaseProfile.length - 1];
  const totalWeeks = last ? last.weeks[1] : plan.startWeek;
  const currentWeek = plan.startDate
    ? weekOfDate(plan.startDate, today, totalWeeks)
    : Math.min(Math.max(plan.startWeek, 1), totalWeeks);
  const phase = phaseForWeek(macro, currentWeek);
  return {
    athlete,
    plan: {
      macroId: macro.id,
      macroName: macro.name,
      totalWeeks,
      currentWeek,
      currentPhase: phase?.name ?? "",
      currentPhaseKey: phase?.key ?? "",
      ...(plan.startDate ? { startDate: plan.startDate } : {}),
      // `imr` (= imrPct[1], the phase's high-end IMR) drives the ribbon fill in MacroRibbon;
      // imrLo/imrHi expose the full corridor for the meso detail sheet. Invariant: imrHi === imr
      // (both imrPct[1]) — `imr` is the legacy ribbon field, `imrHi` reads as a pair with imrLo.
      // volRel/focus also power the sheet. All athlete-safe: intensity %, never RPE.
      phases: macro.phaseProfile.map((p) => ({
        key: p.key, name: p.name, from: p.weeks[0], to: p.weeks[1],
        imr: p.imrPct[1], imrLo: p.imrPct[0], imrHi: p.imrPct[1], volRel: p.volRel, focus: p.focus,
      })),
      comps: plan.comps.map((c) => ({ name: c.name, week: c.week })),
    },
  };
}
