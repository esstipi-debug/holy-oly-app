import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { MacroDetail } from "./MacroDetail";

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/coach/macros" element={<div>CATALOGO SENTINEL</div>} />
        <Route path="/coach/macros/:id" element={<MacroDetail />} />
      </Routes>
    </MemoryRouter>,
  );

test("renders the program detail (header + periodization) for a valid id", () => {
  renderAt("/coach/macros/cubano-int-5d");
  expect(screen.getByText("Cubano Intermedio 5D")).toBeInTheDocument();
  expect(screen.getByText(/Fases en detalle/i)).toBeInTheDocument(); // the MacroPeriodization block
  expect(screen.getByText("INTENSIDAD")).toBeInTheDocument(); // LoadMeters
});

test("redirects to the catalog for an unknown id", () => {
  renderAt("/coach/macros/does-not-exist");
  expect(screen.getByText("CATALOGO SENTINEL")).toBeInTheDocument();
});
