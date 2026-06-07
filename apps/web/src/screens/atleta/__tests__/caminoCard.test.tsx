import { render, screen, fireEvent } from "@testing-library/react";
import type { MePlanView } from "@holy-oly/core";
import { CaminoCard } from "../hoy/CaminoCard";

const PLAN: NonNullable<MePlanView["plan"]> = {
  macroName: "Ruso 5D",
  totalWeeks: 16,
  currentWeek: 11,
  currentPhase: "Fuerza / Potencia",
  phases: [
    { name: "Hipertrofia", from: 1, to: 4, imr: 72, imrLo: 65, imrHi: 72, volRel: 100, focus: "hipertrofia · GPP" },
    { name: "Peaking", from: 13, to: 16, imr: 102, imrLo: 92, imrHi: 102, volRel: 45, focus: "peaking · competencia" },
  ],
  comps: [{ name: "Nacional", week: 16 }],
};

test("con plan: «ver detalle» abre el sheet con las mesos", () => {
  render(<CaminoCard plan={PLAN} />);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /ver detalle/i }));
  const dialog = screen.getByRole("dialog", { name: "Detalle del plan" });
  expect(dialog).toBeInTheDocument();
  // focus text is unique to the sheet (the ribbon shows only names) → proves the meso detail opened
  expect(screen.getByText("hipertrofia · GPP")).toBeInTheDocument();
});

test("sin plan: estado vacío, sin disparador de detalle", () => {
  render(<CaminoCard plan={null} />);
  expect(screen.getByText(/Todavía no tenés un plan asignado/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /ver detalle/i })).not.toBeInTheDocument();
});
