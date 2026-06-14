import { describe, it, expect, vi, afterEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import i18n from "../i18n";
import type { AuthUser } from "./authClient";

// authErrorMessage now takes the auth `t`; test-setup preloads "auth" in es-419 (neutral "tú").
const t = i18n.getFixedT("es-419", "auth");

// googleAuthEnabled hace fetch real (GET /auth/google/config) → mock parcial: deshabilitado.
// El CTA de Google no es el sujeto de estos tests.
vi.mock("./authClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./authClient")>();
  return { ...actual, googleAuthEnabled: vi.fn(async () => false) };
});

// W8: useAuth inyectable (patrón de home.onboarding.test.tsx). AuthScreen sólo lee user/loading
// en render; login/signup recién se usan al enviar el form — acá no se envía.
type SignupFn = (email: string, password: string, role: string, name?: string, website?: string, acceptTerms?: boolean) => Promise<void>;
const noopSignup: SignupFn = async () => {};
const injected = vi.hoisted(() => ({
  current: { user: null as AuthUser | null, loading: false, signup: (async () => {}) as SignupFn },
}));
vi.mock("./AuthContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./AuthContext")>();
  const noop = async (): Promise<void> => {};
  return {
    ...actual,
    useAuth: () => ({
      apiEnabled: true,
      user: injected.current.user,
      loading: injected.current.loading,
      login: noop,
      signup: injected.current.signup,
      logout: noop,
    }),
  };
});

import { AuthScreen, authErrorMessage } from "./AuthScreen";

afterEach(() => {
  injected.current = { user: null, loading: false, signup: noopSignup };
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
      signup: noopSignup,
    };
    renderLogin();
    expect(await screen.findByText("LANDING")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("tu@ejemplo.com")).not.toBeInTheDocument();
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
    expect(screen.getByPlaceholderText("tu@ejemplo.com")).toBeInTheDocument();
    await act(async () => {});
  });

  it("montado en /login sin state no muestra el status de reset", async () => {
    renderLogin();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ingresar" })).toBeInTheDocument();
    await act(async () => {});
  });

  // El bug que reportó el owner: registro con contraseña corta → "invalid input" en inglés y sin
  // pista del requisito. Ahora el mínimo se muestra de entrada en el campo.
  it("en modo registro muestra el mínimo de contraseña como ayuda", async () => {
    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: /Regístrate/ }));
    expect(screen.getByText(/Mínimo 8 caracteres/)).toBeInTheDocument();
    await act(async () => {});
  });

  // PR-L1: no se puede crear cuenta sin aceptar explícitamente Términos + Privacidad.
  it("en modo registro 'Crear cuenta' está deshabilitada hasta aceptar términos", async () => {
    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: /Regístrate/ }));
    const submit = screen.getByRole("button", { name: "Crear cuenta" });
    expect(submit).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: /acepto/i }));
    expect(submit).toBeEnabled();
    await act(async () => {});
  });

  it("al registrarse, signup recibe acceptTerms = true", async () => {
    const spy = vi.fn(async () => {});
    injected.current.signup = spy as unknown as SignupFn;
    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: /Regístrate/ }));
    fireEvent.change(screen.getByPlaceholderText("tu@ejemplo.com"), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), { target: { value: "lawful-pass-9" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /acepto/i }));
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
    await waitFor(() => expect(spy).toHaveBeenCalled());
    // signup(email, password, role, name?, website?, acceptTerms) — la aceptación es el último arg.
    expect(spy).toHaveBeenCalledWith("a@b.com", "lawful-pass-9", "coach", undefined, "", true);
    await act(async () => {});
  });
});

describe("authErrorMessage", () => {
  it("traduce 'weak password' a un mensaje accionable en español", () => {
    expect(authErrorMessage(t, new Error("weak password"))).toMatch(/al menos 8 caracteres/);
  });

  it("traduce 'email already registered' a español", () => {
    expect(authErrorMessage(t, new Error("email already registered"))).toMatch(/ya tiene una cuenta/);
  });

  it("cae a un mensaje genérico cuando el código es desconocido o vacío", () => {
    expect(authErrorMessage(t, new Error(""))).toBe("No se pudo completar.");
  });
});
