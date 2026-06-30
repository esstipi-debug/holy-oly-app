import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import * as adminClient from "../../../admin/adminClient";
import { AdminScreen } from "../AdminScreen";

vi.mock("../../../admin/adminClient");

const OVERVIEW: adminClient.AdminOverview = {
  users: [
    { id: "u1", email: "coach@x.com", role: "coach", country: "AR", emailVerified: true, createdAt: "2026-01-02T00:00:00.000Z" },
    { id: "u2", email: "nocountry@x.com", role: "atleta", country: null, emailVerified: false, createdAt: "2026-02-01T00:00:00.000Z" },
  ],
  coaches: [
    {
      id: "c1", name: "Coach Uno", email: "coach@x.com", country: "AR", athleteCount: 1,
      athletes: [{ id: "a1", nombre: "Mara", nivel: "advanced", compite: true, email: "mara@x.com", country: "CL", emailVerified: true }],
    },
  ],
  unlinkedAthletes: [
    { id: "a2", nombre: "Huérfano", nivel: "beginner", compite: false, email: null, country: null, emailVerified: null },
  ],
  totals: { users: 2, coaches: 1, athletes: 2, linkedAthletes: 1 },
};

beforeEach(() => vi.mocked(adminClient.getAdminOverview).mockResolvedValue(OVERVIEW));
afterEach(() => vi.restoreAllMocks());

function renderScreen() {
  return render(<MemoryRouter><AdminScreen /></MemoryRouter>);
}

test("lista usuarios registrados con su país", async () => {
  renderScreen();
  // coach@x.com aparece como usuario y como email del grupo coach → varios matches.
  expect((await screen.findAllByText("coach@x.com")).length).toBeGreaterThan(0);
  // El país aparece como columna (bandera + nombre en español).
  expect(screen.getAllByText("🇦🇷 Argentina").length).toBeGreaterThan(0);
  // Usuario sin país → fila igualmente presente.
  expect(screen.getByText("nocountry@x.com")).toBeInTheDocument();
});

test("agrupa atletas bajo su coach y muestra el conteo", async () => {
  renderScreen();
  expect(await screen.findByText("Coach Uno")).toBeInTheDocument();
  expect(screen.getByText("Mara")).toBeInTheDocument();
  expect(screen.getByText("🇨🇱 Chile")).toBeInTheDocument();
});

test("muestra los atletas sin coach", async () => {
  renderScreen();
  expect(await screen.findByText(/Atletas sin coach/i)).toBeInTheDocument();
  expect(screen.getByText("Huérfano")).toBeInTheDocument();
});

test("muestra un error si la carga falla", async () => {
  vi.mocked(adminClient.getAdminOverview).mockRejectedValue(new Error("forbidden"));
  renderScreen();
  expect(await screen.findByRole("alert")).toHaveTextContent(/no se pudo cargar/i);
});
