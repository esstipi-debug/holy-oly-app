import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import type { CycleData, MePlanView, WeekHeat } from "@holy-oly/core";
import type { MeClient } from "../../../data/meClient";
import { PlanMapSection } from "../PlanMapSection";

type PlanView = NonNullable<MePlanView["plan"]>;

const daysAgo = (n: number): string => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

// Plan de 4 semanas anclado: la semana 1 arrancó hace 7 días (HOY cae en la semana 2).
const PLAN: PlanView = {
  macroName: "Test", totalWeeks: 4, currentWeek: 2, currentPhase: "Fuerza",
  startDate: daysAgo(7),
  phases: [{ name: "Fuerza", from: 1, to: 4, imr: 80, imrLo: 70, imrHi: 80, volRel: 100, focus: "fuerza" }],
  comps: [],
};

const HEAT: WeekHeat[] = Array.from({ length: 4 }, (_, i) => ({
  week: i + 1,
  days: Array.from({ length: 7 }, (_, d) => (d < 5 ? { topPct: 75, lifts: 20 } : null)),
}));

function client(cycle: CycleData): MeClient {
  return {
    getMePlan: async () => ({ athlete: { nombre: "A", iniciales: "A", sexo: "F" as const }, plan: PLAN }),
    getMeSeries: async () => undefined,
    getDayLog: async () => ({ entry: null, streak: 0, days: [], today: daysAgo(0) }),
    putDayLog: async () => ({ entry: { date: daysAgo(0), fatiga: 3, dolor: 1, estres: 2, humor: 4, motivacion: 4, sueno: 4 }, streak: 1 }),
    getMeSessions: async () => [],
    getMeHeat: async () => HEAT,
    getMeRecorrido: async () => ({ semanas: [] }),
    putMeSession: async () => {},
    getMeCycle: async () => cycle,
    putMeCycle: async () => {},
  };
}

// Período empezó hace 2 días (len 28) → los días 0..4 del ciclo caen dentro del plan.
const CYCLE_OK: CycleData = { share: "none", state: "regular", lastPeriodStart: daysAgo(2), cycleLengthDays: 28 };

test("regular + datos → celdas marcadas en el aria-label + leyenda del ciclo (el overlay es de ELLA, aun con share none)", async () => {
  render(<PlanMapSection plan={PLAN} client={client(CYCLE_OK)} sexo="F" />);
  await waitFor(() => expect(screen.getAllByRole("button", { name: /período \(proy\.\)/i }).length).toBeGreaterThan(0));
  expect(screen.getByText("período (proy.)")).toBeInTheDocument(); // leyenda
  expect(screen.getByText("pre-período")).toBeInTheDocument();
});

test("día marcado seleccionado → línea de contexto (proyección, no regla)", async () => {
  render(<PlanMapSection plan={PLAN} client={client(CYCLE_OK)} sexo="F" />);
  const marked = await screen.findAllByRole("button", { name: /· período \(proy\.\)/i });
  fireEvent.click(marked[0]!);
  expect(await screen.findByText(/\(proyección según tu registro\) — contexto, no regla/i)).toBeInTheDocument();
});

test("regular + datos → línea «Tu próxima ventana» con ambas mitades (pre-período · período)", async () => {
  render(<PlanMapSection plan={PLAN} client={client(CYCLE_OK)} sexo="F" />);
  const line = await screen.findByText(/Tu próxima ventana: pre-período .+ · período .+/i);
  expect(line).toBeInTheDocument();
});

test("sin registro (sin fechas) → SIN línea de próxima ventana ni marcas (opt-in: nada aparece)", async () => {
  render(<PlanMapSection plan={PLAN} client={client({ share: "none", state: "regular" })} sexo="F" />);
  await waitFor(() => expect(screen.getAllByRole("button").length).toBeGreaterThan(20));
  expect(screen.queryByText(/Tu próxima ventana/i)).toBeNull();
  expect(screen.queryByRole("button", { name: /período \(proy\.\)/i })).toBeNull();
});

test("ciclo irregular → SIN marcas ni leyenda (proyectar sería precisión falsa)", async () => {
  render(<PlanMapSection plan={PLAN} client={client({ ...CYCLE_OK, state: "unreliable" })} sexo="F" />);
  // El mapa carga (celdas comunes presentes) pero ninguna con ventana.
  await waitFor(() => expect(screen.getAllByRole("button").length).toBeGreaterThan(20));
  expect(screen.queryByRole("button", { name: /período \(proy\.\)/i })).toBeNull();
  expect(screen.queryByText("período (proy.)")).toBeNull();
  expect(screen.queryByText(/Tu próxima ventana/i)).toBeNull();
});

test("sin startDate → sin overlay (sin fechas no hay verdad)", async () => {
  const { startDate: _omit, ...rest } = PLAN;
  render(<PlanMapSection plan={rest as PlanView} client={client(CYCLE_OK)} sexo="F" />);
  await waitFor(() => expect(screen.getAllByRole("button").length).toBeGreaterThan(20));
  expect(screen.queryByRole("button", { name: /período \(proy\.\)/i })).toBeNull();
});
