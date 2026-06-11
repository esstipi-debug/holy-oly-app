import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { AuthUser } from "./authClient";

// googleAuthEnabled hace fetch real (GET /auth/google/config) → mock parcial: deshabilitado.
// El CTA de Google no es el sujeto de estos tests.
vi.mock("./authClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./authClient")>();
  return { ...actual, googleAuthEnabled: vi.fn(async () => false) };
});

// W8: useAuth inyectable (patrón de home.onboarding.test.tsx). AuthScreen sólo lee user/loading
// en render; login/signup recién se usan al enviar el form — acá no se envía.
const injected = vi.hoisted(() => ({
  current: { user: null as AuthUser | null, loading: false },
}));
vi.mock("./AuthContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./AuthContext")>();
  const noop = async (): Promise<void> => {};
  return {
    ...actual,
    useAuth: () => ({ apiEnabled: true, ...injected.current, login: noop, signup: noop, logout: noop }),
  };
});

import { AuthScreen } from "./AuthScreen";

afterEach(() => {
  injected.current = { user: null, loading: false };
});

function renderLogin(entry: string | { pathname: string; state: unknown } = "/login") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/" element={<div>LANDING</div>} />
        <Route path="/login" element={<AuthScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AuthScreen", () => {
  // W3 ítem 2: con sesión ya activa el form de login no aplica — Navigate a "/" (RoleLanding
  // despacha por rol). Antes quedabas mirando un login que al enviar te rebotaba.
  it("con sesión activa no renderiza el form y navega a '/'", async () => {
    injected.current = {
      user: { id: "u1", role: "coach", coachId: "c1", athleteId: null },
      loading: false,
    };
    renderLogin();
    expect(await screen.findByText("LANDING")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("vos@ejemplo.com")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ingresar" })).not.toBeInTheDocument();
    // flush del effect de googleAuthEnabled (queda colgando un microtask del mock async)
    await act(async () => {});
  });

  // W3 (ResetPassword → rama resetOk): tras el reset, ResetPasswordScreen navega a /login con
  // state.resetOk → el form muestra la confirmación como role="status" (anunciable, no alert).
  it("montado en /login con state.resetOk muestra 'Contraseña actualizada' como status", async () => {
    renderLogin({ pathname: "/login", state: { resetOk: true } });
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Contraseña actualizada");
    // el form sigue ahí (la confirmación no reemplaza el login)
    expect(screen.getByPlaceholderText("vos@ejemplo.com")).toBeInTheDocument();
    await act(async () => {});
  });

  it("montado en /login sin state no muestra el status de reset", async () => {
    renderLogin();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ingresar" })).toBeInTheDocument();
    await act(async () => {});
  });
});
