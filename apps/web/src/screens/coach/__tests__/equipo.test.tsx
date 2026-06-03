import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { RepositoryProvider } from "../../../data/RepositoryProvider";
import { LocalRepository } from "../../../data/LocalRepository";
import { MemStorage } from "../../../test-utils/MemStorage";
import type { Atleta } from "@holy-oly/core";
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

test("muestra la carta hero del mejor readiness + el plantel", async () => {
  renderEquipo();
  expect(await screen.findByText(/MEJOR READINESS/i)).toBeInTheDocument();
  expect(screen.getByText("El plantel")).toBeInTheDocument();
  expect(screen.getByText(/8 ATLETAS/)).toBeInTheDocument();
});

test("tocar la carta hero navega al drill-down", async () => {
  renderEquipo();
  const hero = await screen.findByRole("button", { name: /mejor readiness/i });
  fireEvent.click(hero);
  await waitFor(() => expect(screen.getByText("DRILLDOWN")).toBeInTheDocument());
});

test("una mini-card del plantel también navega al drill-down", async () => {
  renderEquipo();
  await screen.findByText(/MEJOR READINESS/i);
  const minis = screen.getAllByRole("button", { name: /· readiness/i }); // mini-cards (no el hero "mejor readiness")
  expect(minis.length).toBeGreaterThan(0);
  fireEvent.click(minis[0]!);
  await waitFor(() => expect(screen.getByText("DRILLDOWN")).toBeInTheDocument());
});

test("estado de error cuando el roster falla", async () => {
  class FailingRepo extends LocalRepository {
    async getRoster(): Promise<Atleta[]> { throw new Error("boom"); }
  }
  render(
    <RepositoryProvider repo={new FailingRepo(new MemStorage())}>
      <MemoryRouter initialEntries={["/coach"]}>
        <Routes><Route path="/coach" element={<Equipo />} /></Routes>
      </MemoryRouter>
    </RepositoryProvider>,
  );
  expect(await screen.findByText(/no se pudo cargar/i)).toBeInTheDocument();
});
