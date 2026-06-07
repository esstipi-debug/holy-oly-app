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
      macroName: macro.name,
      totalWeeks,
      currentWeek,
      currentPhase: phase?.name ?? "",
      // `imr` (= imrPct high end) drives the ribbon fill; imrLo/imrHi/volRel/focus power the
      // meso detail sheet (the athlete drill-in). All athlete-safe: intensity %, not RPE.
      phases: macro.phaseProfile.map((p) => ({
        name: p.name, from: p.weeks[0], to: p.weeks[1],
        imr: p.imrPct[1], imrLo: p.imrPct[0], imrHi: p.imrPct[1], volRel: p.volRel, focus: p.focus,
      })),
      comps: plan.comps.map((c) => ({ name: c.name, week: c.week })),
    },
  };
}
