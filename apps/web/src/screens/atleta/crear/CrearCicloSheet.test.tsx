import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CrearCicloSheet } from "./CrearCicloSheet";
import type { MeClient } from "../../../data/meClient";

function stub(createMyPlan: MeClient["createMyPlan"]): MeClient {
  return {
    getMePlan: async () => ({ athlete: { nombre: "A", iniciales: "A", sexo: "F" as const }, plan: null }),
    getMeSeries: async () => undefined,
    getDayLog: async () => ({ entry: null, streak: 0, days: [], today: "2026-06-01" }),
    putDayLog: async () => ({ entry: { date: "2026-06-01", fatiga: 3, dolor: 1, estres: 2, humor: 4, motivacion: 4, sueno: 4 }, streak: 1 }),
    createMyPlan,
    getMeSessions: async () => [],
    getMeHeat: async () => [],
    getMeRecorrido: async () => ({ semanas: [] }),
    getMeHeatDays: async () => ({ today: "2026-01-01", weeks: [], anchorWeekIdx: 0, macroFromIdx: -1, macroToIdx: -1 }),
    getMeMacroHistory: async () => ({ entries: [], cyclesDone: 0, avgAdherencePct: 0 }),
    putMeSession: async () => {},
    anularMeSession: async () => {},
    desanularMeSession: async () => {},
    getMeCycle: async () => ({ sexo: "M" as const, share: "none" as const, state: "regular" as const, consented: false }),
    putMeCycle: async () => {},
    deleteMeCycle: async () => {},
  };
}

describe("CrearCicloSheet", () => {
  it("crea el ciclo: escuela + RMs + competencia → createMyPlan + onCreated", async () => {
    const createMyPlan = vi.fn().mockResolvedValue(undefined);
    const onCreated = vi.fn();
    const onClose = vi.fn();
    render(<CrearCicloSheet open onClose={onClose} onCreated={onCreated} client={stub(createMyPlan)} today="2026-06-01" />);

    const submit = screen.getByRole("button", { name: "Crear ciclo" });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByRole("radio", { name: "Búlgaro 6D" }));
    fireEvent.change(screen.getByLabelText("Arranque"), { target: { value: "90" } });
    fireEvent.change(screen.getByLabelText("Envión"), { target: { value: "110" } });
    fireEvent.change(screen.getByLabelText("Sentadilla"), { target: { value: "150" } });
    fireEvent.change(screen.getByLabelText("Frente"), { target: { value: "125" } });
    fireEvent.change(screen.getByLabelText("Nombre de la competencia"), { target: { value: "Nacional" } });
    fireEvent.change(screen.getByLabelText("Fecha de la competencia"), { target: { value: "2026-10-01" } });

    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    expect(createMyPlan).toHaveBeenCalledWith({
      macroId: "bulgaro-6d",
      rms: { arranque: 90, envion: 110, sentadilla: 150, frente: 125 },
      comp: { name: "Nacional", date: "2026-10-01" },
    });
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
  });

  it("submit deshabilitado sin RMs válidos (sólo escuela elegida)", () => {
    render(<CrearCicloSheet open onClose={() => {}} onCreated={() => {}} client={stub(vi.fn())} today="2026-06-01" />);
    fireEvent.click(screen.getByRole("radio", { name: "Búlgaro 6D" }));
    expect(screen.getByRole("button", { name: "Crear ciclo" })).toBeDisabled();
  });
});
