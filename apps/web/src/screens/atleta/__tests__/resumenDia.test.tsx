import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { ResumenDia, type ResumenRow } from "../entreno/ResumenDia";

const ROWS: ResumenRow[] = [
  { movementId: "cargada-envion", movementName: "Envión", sets: 5, reps: 2, kg: 90 },
];

test("muestra el botón iniciar y la lista con kg/discos/series×reps", () => {
  render(<ResumenDia rows={ROWS} barKg={15} onStart={() => {}} />);
  expect(screen.getByRole("button", { name: /iniciar entrenamiento/i })).toBeInTheDocument();
  expect(screen.getByText("Envión")).toBeInTheDocument(); // mn("cargada-envion") en es → "Envión"
  expect(screen.getByText(/5×2/)).toBeInTheDocument();
  expect(screen.getByText("90")).toBeInTheDocument();
  expect(document.querySelectorAll("svg").length).toBeGreaterThanOrEqual(1);
});

test("muestra el % de intensidad junto al kg cuando está presente", () => {
  render(<ResumenDia rows={[{ movementId: "arranque", movementName: "Arranque", sets: 6, reps: 1, kg: 86, pct: 78 }]} barKg={20} onStart={() => {}} />);
  expect(screen.getByText(/78%/)).toBeInTheDocument();
});

test("no muestra % cuando pct está ausente", () => {
  render(<ResumenDia rows={ROWS} barKg={15} onStart={() => {}} />);
  expect(screen.queryByText(/%/)).toBeNull();
});

test("iniciar llama onStart", () => {
  const onStart = vi.fn();
  render(<ResumenDia rows={ROWS} barKg={15} onStart={onStart} />);
  fireEvent.click(screen.getByRole("button", { name: /iniciar entrenamiento/i }));
  expect(onStart).toHaveBeenCalledTimes(1);
});
