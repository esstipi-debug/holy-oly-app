import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import type { Plan, SessionActual } from "@holy-oly/core";
import { RepositoryProvider } from "../../../data/RepositoryProvider";
import { LocalRepository } from "../../../data/LocalRepository";
import { MemStorage } from "../../../test-utils/MemStorage";
import { RmSection } from "./RmSection";

const PLAN: Plan = {
  atletaId: "x1", macroId: "ruso-5d", startWeek: 1, startDate: "2026-04-01",
  rms: { arranque: 80, envion: 100, sentadilla: 140, frente: 110 }, comps: [],
};
// El baseline de savePlan se estampa con la fecha REAL del sistema (la fecha del acto) →
// el "today" del componente usa la misma fuente para que la vigencia sea determinista.
const TODAY = new Date().toISOString().slice(0, 10);

async function setup(actuals: SessionActual[] = [], onRmsChange = () => {}) {
  const store = new MemStorage();
  store.setItem("ho:actuals:x1", JSON.stringify(actuals));
  const repo = new LocalRepository(store);
  await repo.savePlan(PLAN);
  render(
    <RepositoryProvider repo={repo}>
      <RmSection athleteId="x1" plan={(await repo.getPlan("x1"))!} today={TODAY} onRmsChange={onRmsChange} />
    </RepositoryProvider>,
  );
  return repo;
}

test("muestra los 4 RMs con su vigencia (baseline = el día de la asignación, no el startDate)", async () => {
  await setup();
  await waitFor(() => expect(screen.getByText("Arranque")).toBeInTheDocument());
  expect(screen.getByText("Envión")).toBeInTheDocument();
  expect(screen.getByText("Sentadilla")).toBeInTheDocument();
  expect(screen.getByText("Frente")).toBeInTheDocument();
  expect(screen.getByText("80 kg")).toBeInTheDocument();
  expect(screen.getByText("140 kg")).toBeInTheDocument();
  // Recién asignado → "esta semana" (si el baseline usara el startDate de abril sería falso-stale).
  expect(screen.getAllByText("fijado esta semana")).toHaveLength(4);
});

test("PR por confirmar: card con movimiento + kg + semana; confirmar sube el RM con reason 'pr' y se auto-resuelve", async () => {
  let changed = 0;
  const repo = await setup(
    [{ week: 3, sessionIdx: 0, order: 0, movementId: "arranque.potencia", done: true, actualKg: 86 }],
    () => { changed++; },
  );
  await waitFor(() => expect(screen.getByText(/PRs por confirmar/i)).toBeInTheDocument());
  expect(screen.getByText(/levantó 86 kg · sem 3/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /confirmar/i }));
  const input = await screen.findByLabelText("Arranque");
  fireEvent.change(input, { target: { value: "88" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

  await waitFor(async () => expect((await repo.getPlan("x1"))!.rms.arranque).toBe(88));
  expect((await repo.getRmHistory("x1"))[0]).toMatchObject({ lift: "arranque", kg: 88, reason: "pr" });
  expect(changed).toBe(1);
  // 86 < 88 → el set ya no SUPERA el RM nuevo (regla estricta de core) → el candidato se auto-resuelve.
  await waitFor(() => expect(screen.queryByText(/PRs por confirmar/i)).not.toBeInTheDocument());
});

test("editar manda SOLO los lifts cambiados con reason 'manual'", async () => {
  const repo = await setup();
  await waitFor(() => expect(screen.getByText("Arranque")).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "Editar RMs" }));
  const envion = await screen.findByLabelText("Envión");
  fireEvent.change(envion, { target: { value: "105" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

  await waitFor(async () => expect((await repo.getPlan("x1"))!.rms.envion).toBe(105));
  const hist = await repo.getRmHistory("x1");
  expect(hist[0]).toMatchObject({ lift: "envion", kg: 105, reason: "manual" });
  expect(hist).toHaveLength(5); // 4 baselines + 1 (sólo el cambiado)
});

test("guardar sin cambios queda deshabilitado; error del repo → mensaje y el sheet sigue abierto", async () => {
  class FailingRepo extends LocalRepository {
    async updateRms(): Promise<void> { throw new Error("boom"); }
  }
  const store = new MemStorage();
  const repo = new FailingRepo(store);
  await repo.savePlan(PLAN);
  render(
    <RepositoryProvider repo={repo}>
      <RmSection athleteId="x1" plan={PLAN} today={TODAY} onRmsChange={() => {}} />
    </RepositoryProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Editar RMs" }));
  const save = await screen.findByRole("button", { name: "Guardar" });
  expect(save).toBeDisabled(); // sin cambios
  fireEvent.change(screen.getByLabelText("Arranque"), { target: { value: "90" } });
  expect(save).not.toBeDisabled();
  fireEvent.click(save);
  expect(await screen.findByText(/no se pudo guardar/i)).toBeInTheDocument();
  expect(screen.getByLabelText("Arranque")).toBeInTheDocument(); // sheet abierto
});
