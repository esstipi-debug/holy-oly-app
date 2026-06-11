import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { NotFound } from "../NotFound";

// Espeja el cableado del router real (router.tsx): catch-all `*` como último child de la raíz.
test("ruta desconocida → 404 del DS en español con CTA al inicio", () => {
  render(
    <MemoryRouter initialEntries={["/esta-ruta-no-existe"]}>
      <Routes>
        <Route path="/" element={<div>home</div>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </MemoryRouter>,
  );
  expect(screen.getByRole("heading", { name: "Esta página no existe" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Volver al inicio" })).toHaveAttribute("href", "/");
});

// W8: una ruta hija desconocida bajo /coach también cae al 404. En el router real el catch-all
// `*` es hijo de la RAÍZ (hermano de /coach, no hijo): como la rama /coach no puede matchear
// "/coach/lo-que-sea" completo, React Router elige el `*` de la raíz → NotFound se renderiza
// SIN el CoachShell alrededor. Espejamos esa anidación exacta de router.tsx.
test("ruta hija desconocida bajo /coach → cae al 404 del catch-all raíz, sin el shell del coach", () => {
  render(
    <MemoryRouter initialEntries={["/coach/esta-subruta-no-existe"]}>
      <Routes>
        <Route path="/">
          <Route path="coach" element={<div>SHELL-COACH</div>}>
            <Route index element={<div>equipo</div>} />
            <Route path="macros" element={<div>macros</div>} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
  expect(screen.getByRole("heading", { name: "Esta página no existe" })).toBeInTheDocument();
  expect(screen.queryByText("SHELL-COACH")).not.toBeInTheDocument();
});
