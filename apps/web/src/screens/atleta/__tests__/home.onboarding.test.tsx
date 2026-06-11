import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { MeClient } from "../../../data/meClient";

vi.mock("../../../data/apiConfig", () => ({ API_ENABLED: true, API_BASE: "" }));

const useAuthMaybeMock = vi.fn();
vi.mock("../../../auth/AuthContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../auth/AuthContext")>();
  return { ...actual, useAuthMaybe: () => useAuthMaybeMock() };
});

import { HomeScreen } from "../HomeScreen";

// Minimal MeClient stub landing HomeScreen in the "ready" state.
// plan: null → renders "tu coach todavía no te asignó un plan" (still "ready" state).
function stubClient(): MeClient {
  return {
    getMePlan: async () => ({ athlete: { nombre: "Ana Test", iniciales: "AT", sexo: "F" as const }, plan: null }),
    getMeSeries: async () => undefined,
    getDayLog: async () => ({ entry: null, streak: 0, days: [], today: "2026-06-08" }),
    putDayLog: async () => ({ entry: { date: "2026-06-08", fatiga: 3, dolor: 1, estres: 2, humor: 4, motivacion: 4, sueno: 4 }, streak: 1 }),
    getMeSessions: async () => [],
    getMeHeat: async () => [],
    getMeRecorrido: async () => ({ semanas: [] }),
    putMeSession: async () => {},
    getMeCycle: async () => ({ share: "none" as const, state: "regular" as const }),
    putMeCycle: async () => {},
  };
}

function renderHome() {
  return render(
    <MemoryRouter initialEntries={["/atleta"]}>
      <HomeScreen client={stubClient()} variant="tap" />
    </MemoryRouter>,
  );
}

describe("HomeScreen onboarding (real-user mode)", () => {
  it("shows the athlete onboarding card when API is enabled and a user is signed in", async () => {
    useAuthMaybeMock.mockReturnValue({ user: { id: "atleta-1" } });
    renderHome();
    await screen.findByText(/Hola, Ana/);
    expect(screen.getByTestId("onboarding-card")).toBeInTheDocument();
    expect(screen.getByText(/Esto es Hoy/)).toBeInTheDocument();
  });

  it("does not show the onboarding card when there is no signed-in user", async () => {
    useAuthMaybeMock.mockReturnValue({ user: null });
    renderHome();
    await screen.findByText(/Hola, Ana/);
    expect(screen.queryByTestId("onboarding-card")).not.toBeInTheDocument();
  });

  it("does not show the onboarding card in coach preview mode", async () => {
    useAuthMaybeMock.mockReturnValue({ user: { id: "atleta-1" } });
    render(
      <MemoryRouter initialEntries={["/atleta"]}>
        <HomeScreen client={stubClient()} variant="tap" preview />
      </MemoryRouter>,
    );
    await screen.findByText(/Hola, Ana/);
    expect(screen.queryByTestId("onboarding-card")).not.toBeInTheDocument();
  });
});
