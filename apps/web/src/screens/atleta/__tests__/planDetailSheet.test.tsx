import { render, screen } from "@testing-library/react";
import type { MePlanView } from "@holy-oly/core";
import { PlanDetailSheet } from "../PlanDetailSheet";

type PlanView = NonNullable<MePlanView["plan"]>;

const PLAN: PlanView = {
  macroName: "Ruso 5D",
  totalWeeks: 16,
  currentWeek: 11,
  currentPhase: "Fuerza / Potencia",
  phases: [
    { name: "Hipertrofia", from: 1, to: 4, imr: 72, imrLo: 65, imrHi: 72, volRel: 100, focus: "hipertrofia · GPP" },
    { name: "Fuerza básica", from: 5, to: 8, imr: 82, imrLo: 75, imrHi: 82, volRel: 85, focus: "fuerza base" },
    { name: "Fuerza / Potencia", from: 9, to: 12, imr: 92, imrLo: 85, imrHi: 92, volRel: 65, focus: "fuerza · potencia" },
    { name: "Peaking", from: 13, to: 16, imr: 102, imrLo: 92, imrHi: 102, volRel: 45, focus: "peaking · competencia" },
  ],
  comps: [{ name: "Nacional", week: 16 }],
};

const noop = () => {};

test("lista las 4 mesos con su foco y muestra el header del macro", () => {
  render(<PlanDetailSheet plan={PLAN} open onClose={noop} />);
  expect(screen.getByText("Hipertrofia")).toBeInTheDocument();
  expect(screen.getByText("Fuerza básica")).toBeInTheDocument();
  expect(screen.getByText("Peaking")).toBeInTheDocument();
  expect(screen.getByText("hipertrofia · GPP")).toBeInTheDocument();
  expect(screen.getByText(/semana 11 de 16/)).toBeInTheDocument();
});

test("marca la meso actual como «hoy» y muestra la cuenta regresiva a la comp", () => {
  render(<PlanDetailSheet plan={PLAN} open onClose={noop} />);
  // week 11 falls in Fuerza / Potencia (9–12) → that meso is "hoy"
  expect(screen.getByText(/Fuerza \/ Potencia/)).toBeInTheDocument();
  expect(screen.getAllByText(/hoy/i).length).toBeGreaterThan(0);
  // 16 - 11 = 5 weeks to Nacional
  expect(screen.getByText("5")).toBeInTheDocument();
  expect(screen.getAllByText(/Nacional/).length).toBeGreaterThan(0);
});

test("muestra el corredor de intensidad y la 🚩 en la meso con comp", () => {
  render(<PlanDetailSheet plan={PLAN} open onClose={noop} />);
  // intensity corridor of the first meso
  expect(screen.getByText(/65.*72\s*%/)).toBeInTheDocument();
  // comp (week 16) lands in Peaking (13–16) → flag present
  expect(screen.getAllByText(/🚩/).length).toBeGreaterThan(0);
});

test("NO muestra RPE en ninguna parte (regla intocable del atleta)", () => {
  const { container } = render(<PlanDetailSheet plan={PLAN} open onClose={noop} />);
  expect(container.textContent ?? "").not.toMatch(/rpe/i);
});
