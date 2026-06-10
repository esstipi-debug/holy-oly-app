import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PlanHeatMap } from "./PlanHeatMap";
import type { WeekHeat } from "@holy-oly/core";

function makeHeat(): WeekHeat[] {
  const day = (topPct: number, lifts: number) => ({ topPct, lifts });
  return [
    { week: 1, days: [day(70, 30), day(68, 24), null, day(72, 28), day(65, 18), null, null] },
    { week: 2, days: [day(85, 20), day(80, 16), null, day(88, 14), day(75, 12), null, null] },
  ];
}

const baseProps = {
  hoy: { week: 2, day: 0 },
  selected: { week: 1, day: 0 },
  onSelectDay: () => {},
  phaseIndexFor: () => 0,
  comps: new Map([[2, { name: "Nacional", day: 5 }]]),
};

describe("PlanHeatMap", () => {
  it("renderiza una celda accesible por (semana, día) y el tap reporta la posición", () => {
    const picks: Array<[number, number]> = [];
    render(<PlanHeatMap {...baseProps} heat={makeHeat()} onSelectDay={(w, d) => picks.push([w, d])} />);
    fireEvent.click(screen.getByRole("button", { name: /^Semana 1 Jue$/ }));
    expect(picks).toEqual([[1, 3]]);
  });

  it("marca HOY y la competencia con fecha en el aria-label de su celda", () => {
    render(<PlanHeatMap {...baseProps} heat={makeHeat()} />);
    expect(screen.getByRole("button", { name: /Semana 2 Lun · HOY/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Semana 2 Sáb.*competencia Nacional/ })).toBeInTheDocument();
  });

  it("los descansos quedan etiquetados como descanso (sin desglose falso)", () => {
    render(<PlanHeatMap {...baseProps} heat={makeHeat()} />);
    expect(screen.getByRole("button", { name: /^Semana 1 Mié · descanso$/ })).toBeInTheDocument();
  });
});
