import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Outlet, Routes, Route } from "react-router-dom";

// Gap GDPR (W5/D6 — promesas de Privacidad): "Tus datos" ejercita los endpoints reales de
// export y borrado. Acá se prueba la sección con mocks: descarga del export (createObjectURL
// + revoke), confirmación en dos pasos del borrado, cancelar, y el error con role="alert".
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

vi.mock("../../../data/meClient", () => ({
  exportMe: vi.fn(),
  deleteMyAccount: vi.fn(),
}));

// VincularSection levanta su propio fetch en modo API — fuera del alcance de estos tests.
vi.mock("../../../data/vinculoClient", () => ({
  getMyVinculo: vi.fn(async () => null),
  acceptCode: vi.fn(),
}));

// CicloSection en modo API levanta su propio fetch — fuera del alcance de estos tests.
vi.mock("../CicloSection", () => ({ CicloSection: () => null }));

import { exportMe, deleteMyAccount } from "../../../data/meClient";
import { CuentaMin } from "../CuentaMin";

function ShellCtx() {
  return <Outlet context={{ skin: "neon", setSkin: () => {}, variant: "tap", setVariant: () => {} }} />;
}

function renderCuenta() {
  return render(
    <MemoryRouter initialEntries={["/atleta/cuenta"]}>
      <Routes>
        <Route element={<ShellCtx />}>
          <Route path="/atleta/cuenta" element={<CuentaMin />} />
        </Route>
        <Route path="/login" element={<div>LOGIN</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(exportMe).mockReset();
  vi.mocked(deleteMyAccount).mockReset();
  // jsdom no implementa createObjectURL/revokeObjectURL — stub explícito que además espía la limpieza.
  URL.createObjectURL = vi.fn(() => "blob:holy-oly-test");
  URL.revokeObjectURL = vi.fn();
  // Evita el "Not implemented: navigation" de jsdom al click del <a download>.
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("TusDatosSection (export y borrado D3/D6)", () => {
  it("Exportar mis datos → llama exportMe y dispara la descarga (createObjectURL + revoke)", async () => {
    vi.mocked(exportMe).mockResolvedValue({ atleta: { nombre: "Mara" } });
    renderCuenta();

    fireEvent.click(await screen.findByRole("button", { name: "Exportar mis datos" }));

    await waitFor(() => expect(exportMe).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledTimes(1));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:holy-oly-test");
  });

  it("Eliminar mi cuenta → primer click pide confirmación; confirmar llama deleteMyAccount y navega a /login", async () => {
    vi.mocked(deleteMyAccount).mockResolvedValue(undefined);
    renderCuenta();

    // Primer click: NO borra — muestra la confirmación.
    fireEvent.click(await screen.findByRole("button", { name: "Eliminar mi cuenta" }));
    expect(deleteMyAccount).not.toHaveBeenCalled();
    expect(screen.getByText(/¿Segura\? Esto borra todo y no se puede deshacer\./)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sí, eliminar definitivamente" }));
    await waitFor(() => expect(deleteMyAccount).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("LOGIN")).toBeInTheDocument();
  });

  it("Cancelar vuelve atrás sin borrar", async () => {
    renderCuenta();

    fireEvent.click(await screen.findByRole("button", { name: "Eliminar mi cuenta" }));
    expect(screen.getByRole("button", { name: "Sí, eliminar definitivamente" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("button", { name: "Sí, eliminar definitivamente" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Eliminar mi cuenta" })).toBeInTheDocument();
    expect(deleteMyAccount).not.toHaveBeenCalled();
  });

  it("error de deleteMyAccount → role='alert' y sigue en Cuenta", async () => {
    vi.mocked(deleteMyAccount).mockRejectedValue(new Error("boom"));
    renderCuenta();

    fireEvent.click(await screen.findByRole("button", { name: "Eliminar mi cuenta" }));
    fireEvent.click(screen.getByRole("button", { name: "Sí, eliminar definitivamente" }));

    const err = await screen.findByText("No se pudo eliminar la cuenta. Probá de nuevo.");
    expect(err).toHaveAttribute("role", "alert");
    expect(screen.queryByText("LOGIN")).not.toBeInTheDocument();
  });
});
