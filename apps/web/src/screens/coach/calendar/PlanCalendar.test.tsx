import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PlanCalendar } from "./PlanCalendar";
import { MACROCYCLES } from "@holy-oly/core";
import type { Competencia, SessionLog, SessionView, WeekHeat } from "@holy-oly/core";

const macro = MACROCYCLES.find((m) => m.id === "coreano-5d")!;

function makeHeat(weeks: number): WeekHeat[] {
  return Array.from({ length: weeks }, (_, i) => ({
    week: i + 1,
    days: Array.from({ length: 7 }, (_, d) => (d < 5 ? { topPct: 70 + i, lifts: 30 - d } : null)),
  }));
}
const weekViews = (week: number): SessionView[] => [
  { week, sessionIdx: 2, exercises: [{ movementId: "arranque", movementName: "Arranque", sets: 5, reps: 2, pct: 80, targetKg: 64 }] },
  { week, sessionIdx: 3, exercises: [{ movementId: "cargada-envion", movementName: "Envión", sets: 4, reps: 2, pct: 85, targetKg: 85 }] },
];

// hoy 2026-03-25 (miércoles) cae en la semana 4 del plan que arranca el lunes 2026-03-02.
const base = {
  macro, startDate: "2026-03-02", hoyWeek: 4,
  comps: [{ name: "Nacional", week: 9, date: "2026-05-02" }] as Competencia[],
  marks: [] as SessionLog, perWeek: 5,
  loadHeat: async () => makeHeat(12),
  loadWeek: async (w: number) => weekViews(w),
  sexo: "F" as const,
  today: "2026-03-25",
};

describe("PlanCalendar", () => {
  it("mapa-only: muestra el heatmap directo (sin toggle Mapa/Lista ni colapso)", async () => {
    render(<PlanCalendar {...base} />);
    // La Lista se eliminó: ya no hay toggle Mapa/Lista ni header-colapso.
    expect(screen.queryByRole("button", { name: /^Lista$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /calendario del plan/i })).not.toBeInTheDocument();
    // El heatmap se ve sin abrir nada.
    expect(await screen.findByRole("button", { name: /^Semana 1 Lun$/ })).toBeInTheDocument();
  });

  it("leyenda de fases (reemplazo de la Lista): cada fase con su nombre + rango de semanas", async () => {
    render(<PlanCalendar {...base} />);
    // El panel (que también muestra phaseName) sólo aparece tras cargar el heat → acá, sync, sólo está
    // la leyenda → un único match por nombre de fase.
    for (const p of macro.phaseProfile) {
      expect(screen.getByText(p.name)).toBeInTheDocument();
    }
    const p0 = macro.phaseProfile[0]!;
    expect(screen.getByText(new RegExp(`sem ${p0.weeks[0]}–${p0.weeks[1]}`))).toBeInTheDocument();
    await screen.findByRole("button", { name: /^Semana 1 Lun$/ }); // flush heat load (evita act warning)
  });

  it("leyenda formato GitHub: rampa única por % tope, sin el eje de volumen", async () => {
    render(<PlanCalendar {...base} />);
    await screen.findByRole("button", { name: /^Semana 1 Lun$/ });
    expect(screen.getByText("% tope")).toBeInTheDocument();
    expect(screen.queryByText("volumen")).not.toBeInTheDocument();
  });

  it("Mapa por default: HOY preseleccionado con su desglose", async () => {
    render(<PlanCalendar {...base} />);
    expect(await screen.findByRole("button", { name: /^Semana 1 Lun$/ })).toBeInTheDocument();
    // HOY = miércoles de la semana 4 → marcado en su celda y desglosado en el panel
    expect(screen.getByRole("button", { name: /Semana 4 Mié · HOY/ })).toBeInTheDocument();
    expect(await screen.findByText("64 kg")).toBeInTheDocument(); // sessionIdx 2 = miércoles
    expect(screen.getByText(/Objetivo:/)).toBeInTheDocument();
  });

  it("tap en otro día → desglose con ejercicio, kg y discos", async () => {
    const { container } = render(<PlanCalendar {...base} />);
    fireEvent.click(await screen.findByRole("button", { name: /^Semana 1 Jue$/ }));
    expect(await screen.findByText("Envión")).toBeInTheDocument();
    expect(screen.getByText("85 kg")).toBeInTheDocument();
    expect(container.querySelectorAll("svg").length).toBeGreaterThan(0); // DiscRow oficial
  });

  it("la competencia con fecha queda en su celda (sábado de la semana 9)", async () => {
    render(<PlanCalendar {...base} />);
    expect(await screen.findByRole("button", { name: /Semana 9 Sáb.*competencia Nacional/ })).toBeInTheDocument();
  });

  it("start no-lunes: columnas, HOY y compe comparten el eje de la semana del macro", async () => {
    // start = miércoles 4 mar → col 0 del mapa es Mié. HOY (mié 25 mar) = semana 4, offset 0.
    render(<PlanCalendar {...base} startDate="2026-03-04" today="2026-03-25" />);
    expect(await screen.findByRole("button", { name: /Semana 4 Mié · HOY/ })).toBeInTheDocument();
    // El bug viejo (weekday absoluto) lo habría puesto en la col 2 (rotada = Vie):
    expect(screen.queryByRole("button", { name: /Semana 4 Vie · HOY/ })).not.toBeInTheDocument();
    // Compe sáb 2 may = semana 9 (29 abr–5 may), offset 3 → col "Sáb"
    expect(screen.getByRole("button", { name: /Semana 9 Sáb.*competencia Nacional/ })).toBeInTheDocument();
  });

  it("si el heat falla, muestra error honesto con reintentar", async () => {
    let calls = 0;
    const flaky = async (): Promise<WeekHeat[]> => {
      calls++;
      if (calls === 1) throw new Error("boom");
      return makeHeat(12);
    };
    render(<PlanCalendar {...base} loadHeat={flaky} />);
    expect(await screen.findByText(/No se pudo cargar el mapa/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("button", { name: /^Semana 1 Lun$/ })).toBeInTheDocument();
  });
});
