import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../../../auth/AuthContext";
import { CuentaStub } from "./CuentaStub";

// VITE_API_URL is unset in the test env → apiEnabled=false (modo demo). Invitaciones y logout
// son superficies 100% API (W3 ítems 4-5): en demo NO se renderizan — sólo identidad + legal.
test("modo demo: identidad + legal, SIN logout ni invitaciones (gateados por API)", () => {
  render(
    <MemoryRouter>
      <AuthProvider><CuentaStub /></AuthProvider>
    </MemoryRouter>,
  );
  expect(screen.getByText("Cuenta")).toBeInTheDocument();
  expect(screen.getByText("modo demo")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /cerrar sesión/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /invitaciones/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /suscripción/i })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: /privacidad/i })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /términos/i })).toBeInTheDocument();
});
