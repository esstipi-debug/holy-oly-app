import { render, screen } from "@testing-library/react";
import { dnaForFamily } from "@holy-oly/core";
import { MacroComposition } from "./MacroComposition";

const bulgaro = dnaForFamily("Búlgaro")!;
const ruso = dnaForFamily("Ruso")!;

test("muestra los movimientos firma agrupados + el carácter de intensidad", () => {
  render(<MacroComposition dna={bulgaro} />);
  expect(screen.getByText("Levantamientos")).toBeInTheDocument();
  expect(screen.getByText("Sentadillas")).toBeInTheDocument();
  expect(screen.getByText(/techo del corredor/i)).toBeInTheDocument();
  // el gesto de competencia visible como chip firma (texto exacto, no la variante excluida)
  expect(screen.getByText("Arranque")).toBeInTheDocument();
});

test("Búlgaro: muestra «Deja fuera» con lo que la escuela excluye a propósito", () => {
  render(<MacroComposition dna={bulgaro} />);
  expect(screen.getByText(/Deja fuera/i)).toBeInTheDocument();
});

test("Ruso: sin exclusiones → no se muestra la sección «Deja fuera»", () => {
  render(<MacroComposition dna={ruso} />);
  expect(screen.getByText("Complejos")).toBeInTheDocument();
  expect(screen.queryByText(/Deja fuera/i)).not.toBeInTheDocument();
});
