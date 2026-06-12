import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import type { Plan } from "@holy-oly/core";
import { RepositoryProvider } from "../../../data/RepositoryProvider";
import { LocalRepository } from "../../../data/LocalRepository";
import { MemStorage } from "../../../test-utils/MemStorage";
import { PrilepinSection } from "./PrilepinSection";

const RMS = { arranque: 80, envion: 100, sentadilla: 140, frente: 110 };
const TODAY = new Date().toISOString().slice(0, 10);

// ruso-5d (12 semanas). Compe en la semana 12 → countdown 12, la semana 12 es comp_week.
const PLAN: Plan = {
  atletaId: "x1", macroId: "ruso-5d", startWeek: 1, startDate: TODAY,
  rms: RMS, comps: [{ name: "Nacional", week: 12, date: "2026-06-22" }],
};

async function setup(opts: { hoyWeek?: number; plan?: Plan | null } = {}) {
  const store = new MemStorage();
  const repo = new LocalRepository(store);
  if (opts.plan !== null) await repo.savePlan(opts.plan ?? PLAN);
  render(
    <RepositoryProvider repo={repo}>
      <PrilepinSection athleteId="x1" hoyWeek={opts.hoyWeek ?? 12} sexo="F" />
    </RepositoryProvider>,
  );
  return repo;
}

test("renderiza la semana generada: comp_week con sets de % y kg (coach ve %/zonas)", async () => {
  await setup({ hoyWeek: 12 });
  await waitFor(() => expect(screen.getByText("Semana de competencia")).toBeInTheDocument());
  // Encuadre de preview explícito.
  expect(screen.getByText(/no es el plan asignado/i)).toBeInTheDocument();
  // El coach ve % (≥1 set @ algún %) y kg (comp_week prescribe varias zonas).
  expect(screen.getAllByText(/@ \d+%/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/\d+ kg/).length).toBeGreaterThan(0);
  // Jamás RPE.
  expect(screen.queryByText(/rpe/i)).not.toBeInTheDocument();
});

test("una semana temprana es Acumulación", async () => {
  await setup({ hoyWeek: 1 });
  await waitFor(() => expect(screen.getByText("Acumulación")).toBeInTheDocument());
});

test("el selector de lift cambia la prescripción mostrada", async () => {
  await setup({ hoyWeek: 1 });
  await waitFor(() => expect(screen.getByText("Acumulación")).toBeInTheDocument());
  // Cambiar a Sentadilla re-genera (sigue siendo Acumulación en la semana 1, pero el botón queda
  // presionado → confirma que el toggle dispara la carga y la sección se re-renderiza).
  fireEvent.click(screen.getByRole("button", { name: "Sentadilla" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Sentadilla" })).toHaveAttribute("aria-pressed", "true"));
  expect(screen.getByText("Acumulación")).toBeInTheDocument();
});

test("estado sin-datos: semana fuera del rango del macro → fallback 'none' visible", async () => {
  // ruso-5d tiene 12 semanas; pedir la semana 99 → null honesto.
  await setup({ hoyWeek: 99 });
  await waitFor(() => expect(screen.getByText(/Sin datos para generar el preview/i)).toBeInTheDocument());
});

test("sin plan asignado → fallback 'none' (el preview no inventa una semana)", async () => {
  // Sin plan, getPrilepinWeek devuelve null → fallback visible (el guard `plan &&` del Drilldown
  // normalmente evita montar la sección sin plan; acá verificamos que igual degrada honesto).
  await setup({ plan: null });
  await waitFor(() => expect(screen.getByText(/Sin datos para generar el preview/i)).toBeInTheDocument());
});
