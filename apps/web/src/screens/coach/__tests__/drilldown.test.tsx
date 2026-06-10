import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { afterEach } from "vitest";
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

test("'ver como atleta' muestra la Home COMPLETA del atleta (saludo) + la sesión con discos", async () => {
  // The preview's LocalMeClient reads the GLOBAL localStorage; seed it there (not MemStorage) so
  // the toggle finds the seeded athlete. Isolated by clearing before and after.
  localStorage.clear();
  const repo = new LocalRepository(); // global localStorage
  repo.init();
  render(
    <RepositoryProvider repo={repo}>
      <MemoryRouter initialEntries={["/coach/a/kv"]}>
        <Routes><Route path="/coach/a/:id" element={<Drilldown />} /></Routes>
      </MemoryRouter>
    </RepositoryProvider>,
  );
  await waitFor(() => expect(screen.getByText("Kevin A.")).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "Atleta" }));
  // Full athlete home (greeting) AND the money-shot prescription with discs both render.
  expect(await screen.findByText("Hola, Kevin")).toBeInTheDocument();
  expect(screen.getByTestId("atleta-preview")).toBeInTheDocument();
});

afterEach(() => localStorage.clear());

test("no-data athlete (Tomás) shows an empty state, not charts", async () => {
  renderAt("tl");
  await waitFor(() => expect(screen.getByText("Tomás L.")).toBeInTheDocument());
  expect(screen.getByText(/sin datos de monitoreo/i)).toBeInTheDocument();
});

test("ciclo: chip redactado con lúteo REAL (Mara, share full) y CERO fuga de fase/ventanas en el coach", async () => {
  const { container } = renderAt("mv");
  await waitFor(() => expect(screen.getByText(/Ciclo · compartido — contexto lúteo hoy:/)).toBeInTheDocument());
  // seed: día ~20 de un ciclo de 28 → lútea hoy = sí (computado, no placeholder)
  expect(screen.getByText(/contexto lúteo hoy: sí/)).toBeInTheDocument();
  // No-leak: el DOM del coach jamás contiene ventanas/fechas/proyección del ciclo (eso es de la atleta).
  expect(container.textContent ?? "").not.toMatch(/per[íi]odo|proyecci|lastPeriod/i);
});

test("ciclo: share mínimo → chip sin lúteo (Tomás, default min del seed)", async () => {
  // tl NO está en SEED_CYCLE → LocalRepository.init() le aplica el default share:"min" (si algún
  // día tl pasa a "none" como ejemplar sin-ciclo, este test debe mudarse a otro atleta).
  renderAt("tl");
  await waitFor(() => expect(screen.getByText(/Ciclo · compartido \(mínimo\)/)).toBeInTheDocument());
  expect(screen.queryByText(/contexto lúteo/)).toBeNull();
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
