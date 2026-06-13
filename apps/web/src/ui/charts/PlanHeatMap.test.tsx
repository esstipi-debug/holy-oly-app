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

  it("por defecto es vertical; con orientation=horizontal cambia el eje y conserva celdas + aria-labels", () => {
    const { container, rerender } = render(<PlanHeatMap {...baseProps} heat={makeHeat()} />);
    expect(container.querySelector('[data-orientation="vertical"]')).toBeInTheDocument();

    rerender(<PlanHeatMap {...baseProps} heat={makeHeat()} orientation="horizontal" />);
    expect(container.querySelector('[data-orientation="horizontal"]')).toBeInTheDocument();
    // mismo invariante de eje y encoding: HOY y la compe siguen en el aria-label de su celda
    expect(screen.getByRole("button", { name: /^Semana 1 Jue$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Semana 2 Lun · HOY/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Semana 2 Sáb.*competencia Nacional/ })).toBeInTheDocument();
  });

  it("eje de días SIEMPRE Lunes-first, aunque el plan arranque a mitad de semana (firstDow≠0)", () => {
    // startDate miércoles → firstDow=2. Antes las filas rotaban (X,J,V,S,D,L,M); ahora L-first fijo.
    const { container } = render(
      <PlanHeatMap {...baseProps} heat={makeHeat()} orientation="horizontal" firstDow={2} />,
    );
    const labels = Array.from(container.querySelectorAll("span"))
      .map((s) => s.textContent)
      .filter((t): t is string => !!t && /^[LMXJVSD]$/.test(t));
    expect(labels).toEqual(["L", "M", "X", "J", "V", "S", "D"]);
    // Los marcadores siguen en su weekday REAL vía offset: HOY (offset 0) = miércoles para un plan
    // que arranca el miércoles; la compe (offset 5) = lunes. Sólo cambió el ORDEN de las filas.
    expect(screen.getByRole("button", { name: /Semana 2 Mié · HOY/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Semana 2 Lun.*competencia Nacional/ })).toBeInTheDocument();
  });
});
