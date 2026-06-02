import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../../../auth/AuthContext";
import { CuentaStub } from "./CuentaStub";

test("renders the account stub with logout and an invitaciones link", () => {
  render(
    <MemoryRouter>
      <AuthProvider><CuentaStub /></AuthProvider>
    </MemoryRouter>,
  );
  expect(screen.getByText("Cuenta")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /cerrar sesión/i })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /invitaciones/i })).toBeInTheDocument();
});
