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
  expect(screen.getByText("vos sos dueña de tus datos")).toBeInTheDocument();
  expect(screen.getByLabelText("Código de invitación")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Skin Plates" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeInTheDocument();
});

test("elegir una skin la aplica al shell y la persiste", () => {
  const { container } = renderCuenta();
  fireEvent.click(screen.getByRole("button", { name: "Skin Plates" }));
  expect(container.querySelector(".ho-shell")?.classList.contains("wl--plates")).toBe(true);
  expect(localStorage.getItem("holy-oly:atleta-skin")).toBe("plates");
});
