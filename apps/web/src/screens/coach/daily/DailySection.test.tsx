import { render, screen, waitFor } from "@testing-library/react";
import type { DailyCheckin, SessionActual, SessionMark, Plan } from "@holy-oly/core";
import { RepositoryProvider } from "../../../data/RepositoryProvider";
import { LocalRepository } from "../../../data/LocalRepository";
import { MemStorage } from "../../../test-utils/MemStorage";
import { DailySection } from "./DailySection";

const TODAY = new Date().toISOString().slice(0, 10);
// startDate = HOY → la semana 1 del plan cae hoy y entra a la ventana del día a día (window [1..1]).
const PLAN: Plan = {
  atletaId: "x1", macroId: "ruso-5d", startWeek: 1, startDate: TODAY,
  rms: { arranque: 80, envion: 100, sentadilla: 140, frente: 110 }, comps: [],
};

const checkin = (over: Partial<DailyCheckin> = {}): DailyCheckin => ({
  date: TODAY, fatiga: 2, dolor: 1, estres: 2, humor: 4, motivacion: 5, sueno: 4, ...over,
});

async function setup(opts: { checkins?: DailyCheckin[]; actuals?: SessionActual[]; marks?: SessionMark[]; withPlan?: boolean } = {}) {
  const store = new MemStorage();
  const repo = new LocalRepository(store);
  if (opts.withPlan !== false) await repo.savePlan(PLAN); // instancia la prescripción (sesiones planificadas)
  if (opts.checkins) store.setItem("ho:daylog:x1", JSON.stringify(opts.checkins));
  if (opts.actuals) store.setItem("ho:actuals:x1", JSON.stringify(opts.actuals));
  if (opts.marks) store.setItem("ho:sessions:x1", JSON.stringify(opts.marks));
  render(
    <RepositoryProvider repo={repo}>
      <DailySection athleteId="x1" />
    </RepositoryProvider>,
  );
  return repo;
}

test("muestra la tendencia de check-ins (bienestar + peso + 6 ítems) sin RPE", async () => {
  await setup({ checkins: [checkin({ weight: 61 })] });
  await waitFor(() => expect(screen.getByText(/Check-in diario · bienestar/i)).toBeInTheDocument());
  expect(screen.getByText("61 kg", { exact: false })).toBeInTheDocument();
  // Los 6 ítems crudos como chips (1..5), jamás RPE.
  expect(screen.getByText(/Fatiga 2\/5/)).toBeInTheDocument();
  expect(screen.getByText(/Sueño 4\/5/)).toBeInTheDocument();
  expect(screen.queryByText(/rpe/i)).not.toBeInTheDocument();
});

test("adherencia reconciliada: el actual del atleta marca origen '✓ del atleta'", async () => {
  await setup({
    actuals: [{ week: 1, sessionIdx: 0, order: 0, movementId: "arranque", done: true }],
  });
  await waitFor(() => expect(screen.getByText(/Adherencia reconciliada/i)).toBeInTheDocument());
  expect(screen.getByText(/Sem 1 · sesión 1 — hecha/)).toBeInTheDocument();
  expect(screen.getByText(/✓ del atleta/)).toBeInTheDocument();
});

test("sin actuals, cae a la marca del coach con origen 'marca del coach'", async () => {
  await setup({ marks: [{ week: 1, idx: 0, status: "done" }] });
  await waitFor(() => expect(screen.getByText(/Adherencia reconciliada/i)).toBeInTheDocument());
  expect(screen.getByText(/Sem 1 · sesión 1 — hecha/)).toBeInTheDocument();
  expect(screen.getByText(/marca del coach/)).toBeInTheDocument();
});

test("estado vacío: sin check-ins y sin datos de sesión → fallbacks visibles (none, nunca inventar)", async () => {
  await setup({}); // plan asignado pero cero check-ins / actuals / marks
  await waitFor(() => expect(screen.getByText(/Sin check-ins en las últimas semanas/i)).toBeInTheDocument());
  expect(screen.getByText(/Sin datos de sesiones en las últimas semanas/i)).toBeInTheDocument();
});
