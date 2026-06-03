import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AthleteShell } from "../AthleteShell";

function renderShell(initial = "/atleta") {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/atleta" element={<AthleteShell />}>
          <Route index element={<div>HOY-STUB</div>} />
          <Route path="cuenta" element={<div>CUENTA-STUB</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

test("renderiza la marca, las 3 pestañas y el contenido de la ruta", () => {
  renderShell();
  expect(screen.getByText("Holy Oly")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Hoy" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Mi progreso" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Cuenta" })).toBeInTheDocument();
  expect(screen.getByText("HOY-STUB")).toBeInTheDocument();
});

test("aplica la skin guardada en localStorage", () => {
  localStorage.setItem("holy-oly:atleta-skin", "plates");
  const { container } = renderShell();
  expect(container.querySelector(".ho-shell")?.classList.contains("wl--plates")).toBe(true);
  localStorage.clear();
});
