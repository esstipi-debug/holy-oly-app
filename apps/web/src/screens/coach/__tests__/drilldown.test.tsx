import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { RepositoryProvider } from "../../../data/RepositoryProvider";
import { LocalRepository } from "../../../data/LocalRepository";
import { MemStorage } from "../../../test-utils/MemStorage";
import type { Atleta } from "@holy-oly/core";
import { Drilldown } from "../Drilldown";

function renderAt(id: string) {
  const repo = new LocalRepository(new MemStorage());
  return render(
    <RepositoryProvider repo={repo}>
      <MemoryRouter initialEntries={[`/coach/a/${id}`]}>
        <Routes><Route path="/coach/a/:id" element={<Drilldown />} /></Routes>
      </MemoryRouter>
    </RepositoryProvider>,
  );
}

test("shows the athlete header, the monitor charts, and the palmarés medals (Mara)", async () => {
  const { container } = renderAt("mv");
  await waitFor(() => expect(screen.getByText("Mara V.")).toBeInTheDocument());
  expect(screen.getByText("ACWR")).toBeInTheDocument();
  expect(screen.getByText(/Recuperación/)).toBeInTheDocument();
  expect(screen.getByText("IMR vs fase")).toBeInTheDocument();
  expect(screen.getByText("Bienestar")).toBeInTheDocument();
  expect(screen.getByText("Cumplimiento")).toBeInTheDocument();
  expect(screen.getByText("Peso vs categoría")).toBeInTheDocument();
  expect(screen.getByText(/Palmar/)).toBeInTheDocument();
  expect(screen.getByText("Nacional Absoluto")).toBeInTheDocument();
  expect(container.querySelectorAll("svg").length).toBeGreaterThan(3);
});

test("el botón 'volver' lleva de vuelta a Atletas (/coach)", async () => {
  const repo = new LocalRepository(new MemStorage());
  render(
    <RepositoryProvider repo={repo}>
      <MemoryRouter initialEntries={["/coach/a/mv"]}>
        <Routes>
          <Route path="/coach" element={<div>ATLETAS-ROSTER</div>} />
          <Route path="/coach/a/:id" element={<Drilldown />} />
        </Routes>
      </MemoryRouter>
    </RepositoryProvider>,
  );
  const back = await screen.findByRole("button", { name: "Volver a Atletas" });
  fireEvent.click(back);
  await waitFor(() => expect(screen.getByText("ATLETAS-ROSTER")).toBeInTheDocument());
});

test("'ver como atleta' (demo) swaps the coach body for the athlete preview, and back", async () => {
  renderAt("mv");
  await waitFor(() => expect(screen.getByText("Mara V.")).toBeInTheDocument());
  expect(screen.getByText("ACWR")).toBeInTheDocument(); // coach body present
  fireEvent.click(screen.getByRole("button", { name: "Atleta" }));
  await waitFor(() => expect(screen.getByTestId("atleta-preview")).toBeInTheDocument());
  expect(screen.queryByText("ACWR")).not.toBeInTheDocument(); // coach charts swapped out
  fireEvent.click(screen.getByRole("button", { name: "Coach" }));
  await waitFor(() => expect(screen.getByText("ACWR")).toBeInTheDocument()); // back to coach
});

test("no-data athlete (Tomás) shows an empty state, not charts", async () => {
  renderAt("tl");
  await waitFor(() => expect(screen.getByText("Tomás L.")).toBeInTheDocument());
  expect(screen.getByText(/sin datos de monitoreo/i)).toBeInTheDocument();
});

test("shows an error state when the athlete fails to load", async () => {
  class FailingRepo extends LocalRepository {
    async getAthlete(): Promise<Atleta | undefined> { throw new Error("boom"); }
  }
  render(
    <RepositoryProvider repo={new FailingRepo(new MemStorage())}>
      <MemoryRouter initialEntries={["/coach/a/mv"]}>
        <Routes><Route path="/coach/a/:id" element={<Drilldown />} /></Routes>
      </MemoryRouter>
    </RepositoryProvider>,
  );
  expect(await screen.findByText(/no se pudo cargar el atleta/i)).toBeInTheDocument();
});
