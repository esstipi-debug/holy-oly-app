import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { AuthUser } from "./authClient";
import { AuthProvider } from "./AuthContext";
import { RequireAuth } from "./RequireAuth";

// W8: estado inyectable para los casos API — si un test lo setea, useAuth lo devuelve; en null
// cae al useAuth REAL (el caso standalone usa el AuthProvider de verdad). Mismo patrón de mock
// parcial de AuthContext que home.onboarding.test.tsx / equipo.onboarding.test.tsx.
const injected = vi.hoisted(() => ({
  current: null as null | { apiEnabled: boolean; user: AuthUser | null; loading: boolean },
}));
vi.mock("./AuthContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./AuthContext")>();
  const noop = async (): Promise<void> => {};
  return {
    ...actual,
    useAuth: () =>
      injected.current
        ? { ...injected.current, login: noop, signup: noop, logout: noop }
        : actual.useAuth(),
  };
});

afterEach(() => {
  injected.current = null;
});

// VITE_API_URL is unset in the test env → apiEnabled=false → the guard is a pass-through
// (standalone localStorage mode). The API-gated path is covered by the browser e2e (Fase 6).
describe("RequireAuth (standalone, no API)", () => {
  it("renders children when the API is disabled", () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <RequireAuth role="coach"><div>PROTECTED</div></RequireAuth>
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText("PROTECTED")).toBeInTheDocument();
  });
});

// W3 ítem 1 / W8: en modo API el guard distingue "sin sesión" (→ /login) de "sesión con OTRO
// rol" (→ "/", donde RoleLanding despacha por rol) — antes el mismatch caía al form de login
// con sesión activa y el AuthScreen lo devolvía a "/" en loop.
describe("RequireAuth (API)", () => {
  function renderGuard() {
    return render(
      <MemoryRouter initialEntries={["/coach"]}>
        <Routes>
          <Route path="/" element={<div>LANDING</div>} />
          <Route path="/login" element={<div>LOGIN</div>} />
          <Route path="/coach" element={<RequireAuth role="coach"><div>PROTECTED</div></RequireAuth>} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it("atleta autenticada en ruta de coach → redirige a '/', NUNCA a /login", async () => {
    injected.current = {
      apiEnabled: true,
      loading: false,
      user: { id: "u1", role: "atleta", coachId: null, athleteId: "a1" },
    };
    renderGuard();
    expect(await screen.findByText("LANDING")).toBeInTheDocument();
    expect(screen.queryByText("LOGIN")).not.toBeInTheDocument();
    expect(screen.queryByText("PROTECTED")).not.toBeInTheDocument();
  });

  it("sin sesión → redirige a /login", async () => {
    injected.current = { apiEnabled: true, loading: false, user: null };
    renderGuard();
    expect(await screen.findByText("LOGIN")).toBeInTheDocument();
    expect(screen.queryByText("PROTECTED")).not.toBeInTheDocument();
    expect(screen.queryByText("LANDING")).not.toBeInTheDocument();
  });
});
