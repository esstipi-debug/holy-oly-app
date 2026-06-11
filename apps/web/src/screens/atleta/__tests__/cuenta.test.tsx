import { afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "../../../auth/AuthContext";
import { AthleteShell } from "../AthleteShell";
import { CuentaMin } from "../CuentaMin";

function renderCuenta() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/atleta/cuenta"]}>
        <Routes>
          <Route path="/atleta" element={<AthleteShell />}>
            <Route path="cuenta" element={<CuentaMin />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

afterEach(() => localStorage.clear());

test("muestra la sección de vínculo, el toggle de variante y los skins", () => {
  renderCuenta();
  expect(screen.getByText("tus datos son tuyos")).toBeInTheDocument();
  // W5: en demo el vínculo no es real → card estática, NO el form de código (100% API).
  expect(screen.getByText(/Vinculada a tu coach \(demo\)/)).toBeInTheDocument();
  expect(screen.queryByLabelText("Código de invitación")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Skin Plates" })).toBeInTheDocument();
  // W3 ítem 5: el logout es 100% API → en modo demo (apiEnabled=false) NO se renderiza.
  expect(screen.queryByRole("button", { name: "Cerrar sesión" })).not.toBeInTheDocument();
  // W5: "Tus datos" (export/borrado) es 100% API → gateado en demo; legal footer SIEMPRE visible.
  expect(screen.queryByRole("button", { name: "Exportar mis datos" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Eliminar mi cuenta" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Privacidad" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Términos" })).toBeInTheDocument();
});
// NOTA W8: las ramas API del vínculo (pendiente/activo vía GET /me/vinculo) y el flujo de
// export/borrado necesitan infra de mocks de fetch que este archivo no tiene — cubrir en W8.

test("elegir una skin la aplica al shell y la persiste", () => {
  const { container } = renderCuenta();
  fireEvent.click(screen.getByRole("button", { name: "Skin Plates" }));
  expect(container.querySelector(".ho-shell")?.classList.contains("wl--plates")).toBe(true);
  expect(localStorage.getItem("holy-oly:atleta-skin")).toBe("plates");
});
