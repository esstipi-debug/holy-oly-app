import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RepositoryProvider } from "../../../data/RepositoryProvider";
import { LocalRepository } from "../../../data/LocalRepository";
import { MemStorage } from "../../../test-utils/MemStorage";
import { SessionsSection } from "../sessions/SessionsSection";

async function repoWithPlan() {
  const repo = new LocalRepository(new MemStorage());
  await repo.savePlan({ atletaId: "mv", macroId: "ruso-5d", startWeek: 1, startDate: "2026-04-01", rms: { arranque: 80, envion: 100, sentadilla: 140, frente: 110 }, comps: [] });
  return repo;
}

test("muestra las sesiones de la semana con kg derivado", async () => {
  const repo = await repoWithPlan();
  render(<RepositoryProvider repo={repo}><SessionsSection athleteId="mv" hoyWeek={1} totalWeeks={16} /></RepositoryProvider>);
  expect((await screen.findAllByText(/Arranque/)).length).toBeGreaterThan(0);
  expect(screen.getByText(/54 kg/)).toBeInTheDocument(); // 68% of 80
});

test("editar una sesión la persiste y re-renderiza", async () => {
  const repo = await repoWithPlan();
  render(<RepositoryProvider repo={repo}><SessionsSection athleteId="mv" hoyWeek={1} totalWeeks={16} /></RepositoryProvider>);
  await screen.findAllByText(/Arranque/);
  fireEvent.click(screen.getAllByRole("button", { name: /editar sesión/i })[0]!);
  fireEvent.click(screen.getByRole("button", { name: "Guardar sesión" }));
  await waitFor(() => expect(screen.getAllByText(/Arranque/).length).toBeGreaterThan(0));
});
