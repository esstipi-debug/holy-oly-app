import { render, screen, fireEvent } from "@testing-library/react";
import { MACROCYCLES } from "@holy-oly/core";
import { MacroTypicalWeek } from "./MacroTypicalWeek";

const bulgaro = MACROCYCLES.find((m) => m.id === "bulgaro-6d")!;
const coreano = MACROCYCLES.find((m) => m.id === "coreano-5d")!;

test("Búlgaro: muestra las sesiones de la semana tipo, con movimiento y % de intensidad", () => {
  render(<MacroTypicalWeek macro={bulgaro} />);
  expect(screen.getByText("Día 1")).toBeInTheDocument();
  expect(screen.getByText("Día 6")).toBeInTheDocument();
  // el % es la intensidad del template (sin kg de atleta) — debe verse
  expect(screen.getAllByText(/%/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/Arranque|Envión/).length).toBeGreaterThan(0);
});

test("macro multifase: hay un chip por fase y al tocar otro cambia la semana mostrada", () => {
  render(<MacroTypicalWeek macro={coreano} />);
  expect(screen.getByRole("button", { name: "Cimentación" })).toBeInTheDocument();
  const realizacion = screen.getByRole("button", { name: "Realización" });
  expect(realizacion).toBeInTheDocument();
  // cambiar de fase no rompe el render (sigue habiendo sesiones con %)
  fireEvent.click(realizacion);
  expect(screen.getByText("Día 1")).toBeInTheDocument();
  expect(screen.getAllByText(/%/).length).toBeGreaterThan(0);
});
