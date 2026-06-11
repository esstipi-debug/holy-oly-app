import { render, screen, fireEvent } from "@testing-library/react";
import { MACROCYCLES } from "@holy-oly/core";
import { MacroTemplateMap } from "./MacroTemplateMap";

const ruso = MACROCYCLES.find((m) => m.id === "ruso-5d")!;
const cubano = MACROCYCLES.find((m) => m.id === "cubano-int-5d")!;

test("macro con receta: pinta el mapa y el tap muestra la sesión (ejercicios con %, sin kg)", () => {
  const { container } = render(<MacroTemplateMap macro={ruso} />);
  const lunes1 = screen.getByRole("button", { name: /^Semana 1 Lun$/ });
  fireEvent.click(lunes1);
  expect(screen.getByText(/Semana 1 · sesión 1/)).toBeInTheDocument();
  expect(screen.getByText(/Objetivo:/)).toBeInTheDocument();
  // sin atleta no hay RMs → kg honesto «—» y CERO discos
  expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  expect(container.querySelectorAll("svg").length).toBe(0);
  expect(screen.getByText(/se derivan de los RMs/)).toBeInTheDocument();
});

test("macro sin receta: nota honesta, sin mapa falso", () => {
  render(<MacroTemplateMap macro={cubano} />);
  // W6: copy neutro — sin exponer roadmap interno («…existe para el Ruso 5D»)
  expect(screen.getByText(/aún no tiene el detalle sesión-por-sesión/)).toBeInTheDocument();
  expect(screen.queryByText(/Ruso 5D/)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /^Semana 1 Lun$/ })).not.toBeInTheDocument();
});
