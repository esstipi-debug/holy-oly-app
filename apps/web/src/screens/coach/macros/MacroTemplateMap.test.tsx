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

test("macro generado (cubano): el mapa vive — las 23 recetas salen del ADN de su escuela", () => {
  render(<MacroTemplateMap macro={cubano} />);
  const lunes1 = screen.getByRole("button", { name: /^Semana 1 Lun$/ });
  fireEvent.click(lunes1);
  expect(screen.getByText(/Semana 1 · sesión 1/)).toBeInTheDocument();
});

test("macro fuera de catálogo (sin receta): nota honesta, sin mapa falso", () => {
  // un macro desconocido no tiene receta curada NI generada → empty-state (D13, sin-dato honesto)
  const fantasma = { ...cubano, id: "no-existe" };
  render(<MacroTemplateMap macro={fantasma} />);
  expect(screen.getByText(/aún no tiene el detalle sesión-por-sesión/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /^Semana 1 Lun$/ })).not.toBeInTheDocument();
});
