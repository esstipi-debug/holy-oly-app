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
