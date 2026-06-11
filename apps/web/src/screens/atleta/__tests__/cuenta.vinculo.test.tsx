import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Outlet, Routes, Route } from "react-router-dom";

// W8 (la NOTA pendiente de cuenta.test.tsx): ramas API del vínculo (GET /me/vinculo).
// Archivo aparte porque vi.mock es por-archivo y cuenta.test.tsx cubre el modo demo real.
//
// CuentaMin/VincularSection deciden demo↔API por useAuth().apiEnabled, no leen data/apiConfig
// directo → basta el mock parcial de AuthContext (patrón home.onboarding.test.tsx) para forzar
// el modo API sin tocar fetch ni el módulo de config.
vi.mock("../../../auth/AuthContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../auth/AuthContext")>();
  const noop = async (): Promise<void> => {};
  return {
    ...actual,
    useAuth: () => ({
      apiEnabled: true,
      loading: false,
      user: { id: "u1", role: "atleta" as const, coachId: null, athleteId: "a1", email: "mara@example.com" },
      login: noop,
      signup: noop,
      logout: noop,
    }),
  };
});

// El colaborador bajo control: mock por módulo (patrón semana.test.tsx con meClient).
// Ojo: getMyVinculo ya desenvuelve el body {vinculo: ...} → resuelve MeVinculo | null.
vi.mock("../../../data/vinculoClient", () => ({
  getMyVinculo: vi.fn(),
  acceptCode: vi.fn(),
}));

// CicloSection en modo API levanta su propio fetch — fuera del alcance de estos tests.
vi.mock("../CicloSection", () => ({ CicloSection: () => null }));

import * as vc from "../../../data/vinculoClient";
import { CuentaMin } from "../CuentaMin";

// CuentaMin lee skin/variant del Outlet context del shell — este wrapper chico evita montar
// AthleteShell entero (que en API arrastraría sus propios fetches).
function ShellCtx() {
  return <Outlet context={{ skin: "neon", setSkin: () => {}, variant: "tap", setVariant: () => {} }} />;
}

function renderCuentaApi() {
  return render(
    <MemoryRouter initialEntries={["/atleta/cuenta"]}>
      <Routes>
        <Route element={<ShellCtx />}>
          <Route path="/atleta/cuenta" element={<CuentaMin />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(vc.getMyVinculo).mockReset();
});

describe("VincularSection (modo API, 3 ramas de GET /me/vinculo)", () => {
  it("vínculo activo → 'Tu coach' con el nombre, sin form de código", async () => {
    vi.mocked(vc.getMyVinculo).mockResolvedValue({ estado: "activo", coachNombre: "Marcelo" });
    renderCuentaApi();
    expect(await screen.findByText(/Tu coach: Marcelo/)).toBeInTheDocument();
    expect(screen.getByText(/Vínculo activo/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Código de invitación")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enviar solicitud" })).not.toBeInTheDocument();
  });

  it("vínculo pendiente → 'esperando confirmación', sin form de código", async () => {
    vi.mocked(vc.getMyVinculo).mockResolvedValue({ estado: "pendiente", coachNombre: "Marcelo" });
    renderCuentaApi();
    expect(await screen.findByText(/Solicitud enviada/)).toBeInTheDocument();
    expect(screen.getByText(/Esperando confirmación de tu coach/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Código de invitación")).not.toBeInTheDocument();
  });

  it("sin vínculo (null) → form del código visible", async () => {
    vi.mocked(vc.getMyVinculo).mockResolvedValue(null);
    renderCuentaApi();
    expect(await screen.findByLabelText("Código de invitación")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar solicitud" })).toBeInTheDocument();
    expect(screen.queryByText(/Tu coach:/)).not.toBeInTheDocument();
    // sin la línea de fetch fallido — null es "sin vínculo", no error
    expect(screen.queryByText(/No pudimos cargar el estado/)).not.toBeInTheDocument();
  });
});
