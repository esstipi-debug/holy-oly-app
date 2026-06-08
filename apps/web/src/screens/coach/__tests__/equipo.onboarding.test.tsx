import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { RepositoryProvider } from "../../../data/RepositoryProvider";
import { LocalRepository } from "../../../data/LocalRepository";
import { MemStorage } from "../../../test-utils/MemStorage";

// Force real-user mode so the onboarding card (API_ENABLED) renders and the demo card does not.
vi.mock("../../../data/apiConfig", () => ({ API_ENABLED: true, API_BASE: "" }));

// Mockable auth: each test sets what useAuthMaybe returns before rendering.
const useAuthMaybeMock = vi.fn();
vi.mock("../../../auth/AuthContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../auth/AuthContext")>();
  return { ...actual, useAuthMaybe: () => useAuthMaybeMock() };
});

import { Equipo } from "../Equipo";

function renderEquipo() {
  const repo = new LocalRepository(new MemStorage());
  return render(
    <RepositoryProvider repo={repo}>
      <MemoryRouter initialEntries={["/coach"]}>
        <Routes>
          <Route path="/coach" element={<Equipo />} />
          <Route path="/coach/a/:id" element={<div>DRILLDOWN</div>} />
        </Routes>
      </MemoryRouter>
    </RepositoryProvider>,
  );
}

describe("Equipo onboarding (real-user mode)", () => {
  it("shows the coach onboarding card when API is enabled and a user is signed in", async () => {
    useAuthMaybeMock.mockReturnValue({ user: { id: "coach-1" } });
    renderEquipo();
    await screen.findByText(/MEJOR READINESS/i); // roster loaded
    expect(screen.getByTestId("onboarding-card")).toBeInTheDocument();
    expect(screen.getByText(/Este es tu Plantel/)).toBeInTheDocument();
  });

  it("does not show the onboarding card when there is no signed-in user", async () => {
    useAuthMaybeMock.mockReturnValue({ user: null });
    renderEquipo();
    await screen.findByText(/MEJOR READINESS/i);
    expect(screen.queryByTestId("onboarding-card")).not.toBeInTheDocument();
  });

  it("does not show the onboarding card when there is no AuthProvider (useAuthMaybe returns null)", async () => {
    useAuthMaybeMock.mockReturnValue(null);
    renderEquipo();
    await screen.findByText(/MEJOR READINESS/i);
    expect(screen.queryByTestId("onboarding-card")).not.toBeInTheDocument();
  });
});
