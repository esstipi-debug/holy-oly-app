import { test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { RepositoryProvider } from "../../../data/RepositoryProvider";
import { LocalRepository } from "../../../data/LocalRepository";
import { MemStorage } from "../../../test-utils/MemStorage";
import { CompetitionsList } from "./CompetitionsList";
import { CompetitionDetail } from "./CompetitionDetail";

function renderAt(repo: LocalRepository, path: string) {
  return render(
    <RepositoryProvider repo={repo}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/coach/competencias" element={<CompetitionsList />} />
          <Route path="/coach/competencias/:id" element={<CompetitionDetail />} />
        </Routes>
      </MemoryRouter>
    </RepositoryProvider>,
  );
}

test("lista vacía muestra el estado inicial", async () => {
  const repo = new LocalRepository(new MemStorage()); repo.init();
  renderAt(repo, "/coach/competencias");
  expect(await screen.findByText(/Todavía no creaste competencias/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Nueva competencia/i })).toBeInTheDocument();
});

test("la lista trae las competencias creadas con su conteo de atletas", async () => {
  const repo = new LocalRepository(new MemStorage()); repo.init();
  const c = await repo.createCompetition({ name: "Apertura Regional", date: "2026-11-01", place: "Viña" });
  await repo.acoplarAtletas(c.id, [{ athleteId: "kv", role: "pico" }]);
  renderAt(repo, "/coach/competencias");
  expect(await screen.findByText("Apertura Regional")).toBeInTheDocument();
  expect(screen.getByText(/1 atleta/)).toBeInTheDocument();
});

test("el detalle muestra la compe y sus atletas acoplados", async () => {
  const repo = new LocalRepository(new MemStorage()); repo.init();
  const c = await repo.createCompetition({ name: "Nacional Absoluto", date: "2026-12-01", place: "Santiago" });
  await repo.acoplarAtletas(c.id, [{ athleteId: "kv", role: "pico" }]);
  renderAt(repo, `/coach/competencias/${c.id}`);
  expect(await screen.findByRole("heading", { name: "Nacional Absoluto" })).toBeInTheDocument();
  expect(screen.getByText("Santiago")).toBeInTheDocument();
  expect(screen.getByText(/Atletas acoplados · 1/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Acoplar atletas/i })).toBeInTheDocument();
});
