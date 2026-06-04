import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";
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

test("D1: muestra real vs prescrito cuando hay actual.kg", async () => {
  const repo = await repoWithPlan();
  vi.spyOn(repo, "getPrescriptionWeek").mockResolvedValue([
    {
      week: 1,
      sessionIdx: 0,
      exercises: [
        {
          movementId: "arranque",
          sets: 5,
          reps: 3,
          pct: 70,
          movementName: "Arranque",
          targetKg: 70,
          actual: { done: true, kg: 72, movementId: "arranque", movementName: "Arranque", substituted: false, desfasado: false },
        },
      ],
    },
  ]);
  render(<RepositoryProvider repo={repo}><SessionsSection athleteId="mv" hoyWeek={1} totalWeeks={16} /></RepositoryProvider>);
  await screen.findByText(/Arranque/);
  expect(screen.getByText(/real 72/)).toBeInTheDocument();
  expect(screen.getByText(/↑/)).toBeInTheDocument();
});

test("D1: no hecho — muestra 'no hecho' y NO muestra real aunque haya kg", async () => {
  const repo = await repoWithPlan();
  vi.spyOn(repo, "getPrescriptionWeek").mockResolvedValue([
    {
      week: 1,
      sessionIdx: 0,
      exercises: [
        {
          movementId: "arranque",
          sets: 5,
          reps: 3,
          pct: 70,
          movementName: "Arranque",
          targetKg: 70,
          actual: { done: false, kg: 70, movementId: "arranque", movementName: "Arranque", substituted: false, desfasado: false },
        },
      ],
    },
  ]);
  render(<RepositoryProvider repo={repo}><SessionsSection athleteId="mv" hoyWeek={1} totalWeeks={16} /></RepositoryProvider>);
  await screen.findByText(/Arranque/);
  expect(screen.getByText(/no hecho/)).toBeInTheDocument();
  expect(screen.queryByText(/real 70/)).not.toBeInTheDocument();
});

test("SP4: muestra sustituido con nombre del movimiento real y SIN marcador de desvío", async () => {
  const repo = await repoWithPlan();
  vi.spyOn(repo, "getPrescriptionWeek").mockResolvedValue([
    {
      week: 1,
      sessionIdx: 0,
      exercises: [
        {
          movementId: "arranque",
          sets: 5,
          reps: 3,
          pct: 70,
          movementName: "Arranque",
          targetKg: 56,
          actual: { done: true, kg: 50, movementId: "arranque.colgado.bajo", movementName: "Arranque colgado (bajo)", substituted: true, desfasado: false },
        },
      ],
    },
  ]);
  render(<RepositoryProvider repo={repo}><SessionsSection athleteId="mv" hoyWeek={1} totalWeeks={16} /></RepositoryProvider>);
  await screen.findByText("Arranque");
  expect(screen.getByText(/sustituido/)).toBeInTheDocument();
  expect(screen.getByText(/Arranque colgado \(bajo\)/)).toBeInTheDocument();
  expect(screen.queryByText(/↑/)).not.toBeInTheDocument();
  expect(screen.queryByText(/↓/)).not.toBeInTheDocument();
});

test("SP4: muestra desfasado con aviso y SIN marcador de desvío", async () => {
  const repo = await repoWithPlan();
  vi.spyOn(repo, "getPrescriptionWeek").mockResolvedValue([
    {
      week: 1,
      sessionIdx: 0,
      exercises: [
        {
          movementId: "arranque",
          sets: 5,
          reps: 3,
          pct: 70,
          movementName: "Arranque",
          targetKg: 56,
          actual: { done: true, kg: 50, movementId: "sentadilla-overhead", movementName: "Sentadilla de arranque", substituted: false, desfasado: true },
        },
      ],
    },
  ]);
  render(<RepositoryProvider repo={repo}><SessionsSection athleteId="mv" hoyWeek={1} totalWeeks={16} /></RepositoryProvider>);
  await screen.findByText(/Arranque/);
  expect(screen.getByText(/desfasado/)).toBeInTheDocument();
  expect(screen.queryByText(/↑/)).not.toBeInTheDocument();
  expect(screen.queryByText(/↓/)).not.toBeInTheDocument();
});

test("D1: muestra nota del atleta cuando actual.note está presente", async () => {
  const repo = await repoWithPlan();
  vi.spyOn(repo, "getPrescriptionWeek").mockResolvedValue([
    {
      week: 1,
      sessionIdx: 0,
      exercises: [
        {
          movementId: "arranque",
          sets: 5,
          reps: 3,
          pct: 70,
          movementName: "Arranque",
          targetKg: 70,
          actual: { done: true, kg: 68, note: "molestia en rodilla", movementId: "arranque", movementName: "Arranque", substituted: false, desfasado: false },
        },
      ],
    },
  ]);
  render(<RepositoryProvider repo={repo}><SessionsSection athleteId="mv" hoyWeek={1} totalWeeks={16} /></RepositoryProvider>);
  await screen.findByText(/Arranque/);
  expect(screen.getByText(/molestia en rodilla/)).toBeInTheDocument();
});
