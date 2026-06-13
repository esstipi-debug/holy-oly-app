import { render, screen } from "@testing-library/react";
import type { MePlanView } from "@holy-oly/core";
import { PhaseTrack } from "./PhaseTrack";

const PLAN: NonNullable<MePlanView["plan"]> = {
  macroName: "Ruso 5D", totalWeeks: 16, currentWeek: 12, currentPhase: "Fuerza / Potencia",
  phases: [
    { name: "Hipertrofia", from: 1, to: 4, imr: 68, imrLo: 65, imrHi: 72, volRel: 95, focus: "" },
    { name: "Fuerza básica", from: 5, to: 8, imr: 78, imrLo: 75, imrHi: 82, volRel: 85, focus: "" },
    { name: "Fuerza / Potencia", from: 9, to: 12, imr: 88, imrLo: 85, imrHi: 92, volRel: 70, focus: "" },
    { name: "Peaking", from: 13, to: 16, imr: 97, imrLo: 92, imrHi: 102, volRel: 40, focus: "" },
  ],
  comps: [{ name: "Nacional", week: 16 }],
};

test("dibuja una barra por semana del macro (pista de N semanas)", () => {
  const { container } = render(<PhaseTrack plan={PLAN} />);
  expect(container.querySelectorAll(".ho-track__wk").length).toBe(16);
});

test("marca la fase actual con «· hoy» y lista todas las fases en la leyenda", () => {
  render(<PhaseTrack plan={PLAN} />);
  expect(screen.getByText("Fuerza / Potencia · hoy")).toBeInTheDocument();
  expect(screen.getByText("Hipertrofia")).toBeInTheDocument();
  expect(screen.getByText("Fuerza básica")).toBeInTheDocument();
  expect(screen.getByText("Peaking")).toBeInTheDocument();
});
