import { describe, it, expect } from "vitest";
import { buildMePlanView } from "./mePlan";
import { defaultStartDate } from "./schedule";
import type { Plan } from "../types";

const ATH = { nombre: "Mara V.", iniciales: "MV", sexo: "F" as const };

describe("buildMePlanView", () => {
  it("no plan → plan: null", () => {
    expect(buildMePlanView(ATH, undefined, "2026-06-03")).toEqual({ athlete: ATH, plan: null });
  });

  it("unknown macroId → plan: null", () => {
    const plan: Plan = { atletaId: "mv", macroId: "does-not-exist", startWeek: 1, rms: { arranque: 1, envion: 1, sentadilla: 1, frente: 1 }, comps: [] };
    expect(buildMePlanView(ATH, plan, "2026-06-03").plan).toBeNull();
  });

  it("anchors the current week to the plan's startDate (ruso-5d is 16 weeks)", () => {
    // startDate chosen so today is week 12
    const startDate = defaultStartDate("2026-06-03", 12);
    const plan: Plan = {
      atletaId: "mv", macroId: "ruso-5d", startWeek: 1, startDate,
      rms: { arranque: 80, envion: 100, sentadilla: 140, frente: 110 },
      comps: [{ name: "Nacional", week: 16 }],
    };
    const view = buildMePlanView(ATH, plan, "2026-06-03");
    expect(view.plan).not.toBeNull();
    expect(view.plan!.totalWeeks).toBe(16);
    expect(view.plan!.currentWeek).toBe(12);
    expect(view.plan!.currentPhase).not.toBe("");
    expect(view.plan!.startDate).toBe(startDate); // el atleta ve las fechas reales de SU plan
    expect(view.plan!.phases.length).toBeGreaterThan(0);
    expect(view.plan!.comps).toEqual([{ name: "Nacional", week: 16 }]);
  });

  it("enriquece cada fase con foco, volumen e intensidad (corredor) para el detalle del macro", () => {
    const plan: Plan = { atletaId: "mv", macroId: "ruso-5d", startWeek: 1, rms: { arranque: 80, envion: 100, sentadilla: 140, frente: 110 }, comps: [] };
    const phases = buildMePlanView(ATH, plan, "2026-06-03").plan!.phases;
    // first meso of ruso-5d: Hipertrofia, weeks 1–4, imrPct 65–72, volRel 100
    expect(phases[0]).toEqual({
      name: "Hipertrofia", from: 1, to: 4, imr: 72, imrLo: 65, imrHi: 72, volRel: 100, focus: "hipertrofia · GPP",
    });
    // last meso = Peaking
    expect(phases[phases.length - 1]).toMatchObject({ name: "Peaking", imrLo: 92, imrHi: 102, volRel: 45 });
  });

  it("falls back to startWeek when there is no startDate", () => {
    const plan: Plan = { atletaId: "mv", macroId: "ruso-5d", startWeek: 5, rms: { arranque: 80, envion: 100, sentadilla: 140, frente: 110 }, comps: [] };
    expect(buildMePlanView(ATH, plan, "2026-06-03").plan!.currentWeek).toBe(5);
    expect(buildMePlanView(ATH, plan, "2026-06-03").plan!.totalWeeks).toBe(16);
    expect(buildMePlanView(ATH, plan, "2026-06-03").plan!.startDate).toBeUndefined();
  });
});
