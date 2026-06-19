import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../../../auth/AuthContext";
import { CuentaCoach } from "./CuentaCoach";

// VITE_API_URL is unset in the test env → apiEnabled=false (modo demo). Invitaciones, logout,
// identidad y "Tus datos" son superficies 100% API (W3/W5): en demo NO se renderizan — sólo
// el aviso de demo + legal.
test("modo demo: identidad + legal, SIN logout ni invitaciones ni Tus datos (gateados por API)", () => {
  render(
    <MemoryRouter>
      <AuthProvider><CuentaCoach /></AuthProvider>
    </MemoryRouter>,
  );
  expect(screen.getByText("Cuenta")).toBeInTheDocument();
  expect(screen.getByText("modo demo")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /cerrar sesión/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /invitaciones/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /suscripción/i })).not.toBeInTheDocument();
  expect(screen.queryByText(/tus datos/i)).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /cambiar contraseña/i })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: /privacidad/i })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /términos/i })).toBeInTheDocument();
});

test("el selector de apariencia/skin está disponible (pref local, también en demo)", () => {
  render(
    <MemoryRouter>
      <AuthProvider><CuentaCoach /></AuthProvider>
    </MemoryRouter>,
  );
  expect(screen.getByText("Apariencia · skin")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Skin Legend" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Skin Plates" })).toBeInTheDocument();
});
