import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { ResumenDia, type ResumenRow } from "../entreno/ResumenDia";

const ROWS: ResumenRow[] = [
  { movementName: "Cargada y Envión", sets: 5, reps: 2, kg: 90 },
];

test("muestra el botón iniciar y la lista con kg/discos/series×reps", () => {
  render(<ResumenDia rows={ROWS} barKg={15} onStart={() => {}} />);
  expect(screen.getByRole("button", { name: /iniciar entrenamiento/i })).toBeInTheDocument();
  expect(screen.getByText("Cargada y Envión")).toBeInTheDocument();
  expect(screen.getByText(/5 series × 2 repeticiones/)).toBeInTheDocument();
  expect(screen.getByText("90")).toBeInTheDocument();
  expect(document.querySelectorAll("svg").length).toBeGreaterThanOrEqual(1);
});

test("iniciar llama onStart", () => {
  const onStart = vi.fn();
  render(<ResumenDia rows={ROWS} barKg={15} onStart={onStart} />);
  fireEvent.click(screen.getByRole("button", { name: /iniciar entrenamiento/i }));
  expect(onStart).toHaveBeenCalledTimes(1);
});
